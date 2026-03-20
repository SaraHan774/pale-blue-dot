import type { RepoConfig, GitHubFile, Page, CacheMetadata, FileMetadata } from '@/types';
import { parseMarkdownFile } from './parserService';
import { savePages, saveImage, saveRepoConfig, loadCacheMetadata, saveCacheMetadata, getImagePath } from './cacheService';
import { loadToken } from './tokenService';

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Parallel download configuration
 * - Conservative (5): Better for slower connections, less memory usage
 * - Balanced (10): Good for most users (default)
 * - Aggressive (20): Fast connections, more memory, may hit rate limits
 */
const PARALLEL_DOWNLOAD_BATCH_SIZE = 10; // Download 10 files concurrently

/**
 * Get GitHub API headers with optional authentication
 */
async function getHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };

  const token = await loadToken();
  console.log('Loading token for API call...');
  console.log('Token found:', token ? 'Yes' : 'No');
  if (token) {
    console.log('Token length:', token.length);
    console.log('Token prefix:', token.substring(0, 11));

    // Fine-grained tokens (github_pat_) use Bearer, classic tokens (ghp_) use token
    if (token.startsWith('github_pat_')) {
      console.log('Using Bearer auth (fine-grained token)');
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.log('Using token auth (classic token)');
      headers['Authorization'] = `token ${token}`;
    }
  }

  return headers;
}

/**
 * Parse GitHub repo URL into RepoConfig
 */
export function parseRepoUrl(url: string): RepoConfig | null {
  try {
    // Support formats:
    // - https://github.com/owner/repo
    // - https://github.com/owner/repo/tree/branch
    // - owner/repo
    const urlPattern = /(?:https?:\/\/github\.com\/)?([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?/;
    const match = url.match(urlPattern);

    if (!match) {
      return null;
    }

    return {
      owner: match[1],
      repo: match[2].replace('.git', ''),
      branch: match[3] || 'main',
    };
  } catch (error) {
    console.error('Failed to parse repo URL:', error);
    return null;
  }
}

/**
 * Fetch repository contents from GitHub
 */
async function fetchRepoContents(
  config: RepoConfig,
  path: string = ''
): Promise<GitHubFile[]> {
  const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch || 'main'}`;

  try {
    const headers = await getHeaders();
    console.log('Fetching:', url);
    console.log('Has token:', headers['Authorization'] ? 'Yes' : 'No');

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('GitHub API error:', response.status, errorBody);

      if (response.status === 404) {
        throw new Error(`Repository not found or no access. Status: ${response.status}`);
      } else if (response.status === 401) {
        throw new Error('Invalid or expired token. Please check your GitHub token.');
      } else if (response.status === 403) {
        throw new Error('Access forbidden. Token may lack required permissions.');
      }

      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch repo contents:', error);
    throw error;
  }
}

/**
 * Download file content from GitHub
 */
async function downloadFile(downloadUrl: string): Promise<string> {
  try {
    const headers = await getHeaders();
    const response = await fetch(downloadUrl, { headers });
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Failed to download file:', error);
    throw error;
  }
}

/**
 * Parse an LFS pointer file content to extract OID and size
 */
function parseLfsPointer(content: string): { oid: string; size: number } | null {
  try {
    if (!content.startsWith('version https://git-lfs.github.com/spec/v1')) {
      return null;
    }
    const oidMatch = content.match(/oid sha256:([a-f0-9]+)/);
    const sizeMatch = content.match(/size (\d+)/);
    if (!oidMatch || !sizeMatch) return null;
    return { oid: oidMatch[1], size: parseInt(sizeMatch[1], 10) };
  } catch {
    return null;
  }
}

/**
 * Use Git LFS Batch API to get download URLs for LFS objects.
 * Returns a map of OID -> download URL with auth headers.
 */
async function getLfsDownloadUrls(
  config: RepoConfig,
  objects: { oid: string; size: number }[]
): Promise<Map<string, { href: string; headers: Record<string, string> }>> {
  const result = new Map<string, { href: string; headers: Record<string, string> }>();
  if (objects.length === 0) return result;

  const headers = await getHeaders();
  const lfsUrl = `https://github.com/${config.owner}/${config.repo}.git/info/lfs/objects/batch`;

  console.log(`Requesting LFS download URLs for ${objects.length} objects`);

  const response = await fetch(lfsUrl, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.git-lfs+json',
    },
    body: JSON.stringify({
      operation: 'download',
      transfers: ['basic'],
      objects: objects.map(o => ({ oid: o.oid, size: o.size })),
    }),
  });

  if (!response.ok) {
    console.error('LFS batch API failed:', response.status);
    throw new Error(`LFS batch API error: ${response.status}`);
  }

  const data = await response.json();
  for (const obj of data.objects || []) {
    if (obj.error) {
      console.warn(`LFS object ${obj.oid.substring(0, 12)} error:`, obj.error.message);
      continue;
    }
    const download = obj.actions?.download;
    if (download?.href) {
      result.set(obj.oid, {
        href: download.href,
        headers: download.header || {},
      });
    }
  }

  console.log(`Got ${result.size}/${objects.length} LFS download URLs`);
  return result;
}

/**
 * Process items in parallel batches
 */
async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = PARALLEL_DOWNLOAD_BATCH_SIZE
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(item => processor(item))
    );

    // Collect successful results, log failures
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`Batch item ${i + j} failed:`, result.reason);
      }
    }
  }

  return results;
}

/**
 * Check if file needs to be downloaded based on cache metadata
 */
function needsDownload(
  file: GitHubFile,
  cachedMetadata: Record<string, FileMetadata> | undefined
): boolean {
  if (!cachedMetadata) return true;

  const cached = cachedMetadata[file.name];
  if (!cached) return true;

  // Download if SHA changed or size changed
  return cached.sha !== file.sha || cached.size !== file.size;
}

/**
 * Download all markdown files from repository (with intelligent caching)
 */
async function downloadMarkdownFiles(
  config: RepoConfig
): Promise<{ pages: Page[]; fileMetadata: Record<string, FileMetadata> }> {
  try {
    // Try to get workspace folder contents first
    let contents;
    try {
      contents = await fetchRepoContents(config, 'workspace');
      console.log('Found workspace folder, using workspace/ path');
    } catch (error) {
      // If workspace folder doesn't exist, use root
      console.log('No workspace folder, using root path');
      contents = await fetchRepoContents(config);
    }

    // Filter markdown files (exclude folders like .images)
    const mdFiles = contents.filter(
      item => item.type === 'file' && item.name.endsWith('.md')
    );

    console.log(`Found ${mdFiles.length} markdown files`);

    // TEMPORARY FIX: Always download all files to prevent data loss
    // TODO: Implement proper filename -> page ID mapping in cache metadata
    console.log('SAFE MODE: Downloading all files (intelligent caching disabled temporarily)');

    // Download ALL files in parallel batches
    const downloadedPages = await processBatch<GitHubFile, { file: GitHubFile; content: string; page: Page }>(
      mdFiles,
      async (file: GitHubFile) => {
        if (!file.download_url) {
          throw new Error(`No download URL for ${file.name}`);
        }
        const content = await downloadFile(file.download_url);
        const page = parseMarkdownFile(file.name, content);
        return { file, content, page };
      }
    );

    // Extract all pages
    const allPages = downloadedPages.map(({ page }) => page);

    // Build complete file metadata map for ALL files
    const fileMetadata: Record<string, FileMetadata> = {};
    for (const file of mdFiles) {
      fileMetadata[file.name] = {
        name: file.name,
        sha: file.sha,
        size: file.size,
        lastSynced: new Date().toISOString(),
      };
    }

    console.log(`Total pages: ${allPages.length} (all downloaded in safe mode)`);

    return { pages: allPages, fileMetadata };
  } catch (error) {
    console.error('Failed to download markdown files:', error);
    throw error;
  }
}

/**
 * LFS pointer size threshold. Files from GitHub Contents API listing
 * with size below this are likely LFS pointer files (~130 bytes).
 */
const LFS_POINTER_SIZE_THRESHOLD = 200;

/**
 * Download all images from .images directory (with LFS support)
 */
async function downloadImages(
  config: RepoConfig,
  metadata: CacheMetadata | null,
  onProgress?: (current: number, total: number) => void
): Promise<{ imageMap: Map<string, string>; imageMetadata: Record<string, FileMetadata> }> {
  const imageMap = new Map<string, string>();

  try {
    // Try workspace/.images first, then .images
    let contents;
    try {
      contents = await fetchRepoContents(config, 'workspace/.images');
      console.log('Found workspace/.images folder');
    } catch (error) {
      try {
        contents = await fetchRepoContents(config, '.images');
        console.log('Found .images folder in root');
      } catch (error2) {
        console.log('No .images directory found');
        return { imageMap, imageMetadata: {} };
      }
    }

    const imageFiles = contents.filter(item => item.type === 'file');
    const total = imageFiles.length;
    console.log(`Found ${total} images`);

    // Check which images need downloading
    const imagesToDownload = imageFiles.filter(file =>
      needsDownload(file, metadata?.images)
    );
    console.log(`${imagesToDownload.length} images need downloading (${total - imagesToDownload.length} unchanged)`);

    const headers = await getHeaders();

    // Separate LFS files from regular files based on listing size
    const lfsFiles = imagesToDownload.filter(f => f.size < LFS_POINTER_SIZE_THRESHOLD);
    const regularFiles = imagesToDownload.filter(f => f.size >= LFS_POINTER_SIZE_THRESHOLD);
    console.log(`Image types: ${lfsFiles.length} LFS, ${regularFiles.length} regular`);

    // For LFS files: download pointer content, parse OIDs, then batch-fetch real URLs
    let lfsUrlMap = new Map<string, { href: string; headers: Record<string, string> }>();
    const lfsFileOidMap = new Map<string, string>(); // filename -> oid

    if (lfsFiles.length > 0) {
      // Download all LFS pointer files in parallel to get their OIDs
      const pointerResults = await processBatch(lfsFiles, async (file: GitHubFile) => {
        if (!file.download_url) throw new Error(`No download URL for ${file.name}`);
        const pointerContent = await downloadFile(file.download_url);
        const parsed = parseLfsPointer(pointerContent);
        return { name: file.name, lfs: parsed };
      });

      // Collect all LFS objects for batch API request
      const lfsObjects: { oid: string; size: number }[] = [];
      for (const { name, lfs } of pointerResults) {
        if (lfs) {
          lfsObjects.push(lfs);
          lfsFileOidMap.set(name, lfs.oid);
        } else {
          console.warn(`Could not parse LFS pointer for ${name}, treating as regular file`);
          regularFiles.push(imagesToDownload.find(f => f.name === name)!);
        }
      }

      // Get real download URLs via LFS Batch API
      if (lfsObjects.length > 0) {
        try {
          lfsUrlMap = await getLfsDownloadUrls(config, lfsObjects);
        } catch (error) {
          console.error('LFS batch API failed, LFS images will not be available:', error);
        }
      }
    }

    // Download all images in parallel batches
    let processed = 0;
    const allFilesToDownload = [...regularFiles, ...lfsFiles.filter(f => lfsFileOidMap.has(f.name))];

    const downloadedImages = await processBatch<GitHubFile, { name: string; path: string }>(
      allFilesToDownload,
      async (file: GitHubFile) => {
        let localPath: string;

        const oid = lfsFileOidMap.get(file.name);
        if (oid) {
          // LFS file: use the download URL from the batch API
          const lfsInfo = lfsUrlMap.get(oid);
          if (!lfsInfo) {
            throw new Error(`No LFS download URL for ${file.name} (oid: ${oid.substring(0, 12)})`);
          }
          // Merge LFS auth headers with our standard headers
          const lfsHeaders = { ...headers, ...lfsInfo.headers };
          localPath = await saveImage(file.name, lfsInfo.href, lfsHeaders);
        } else {
          // Regular file: use download_url directly
          if (!file.download_url) {
            throw new Error(`No download URL for ${file.name}`);
          }
          localPath = await saveImage(file.name, file.download_url, headers);
        }

        processed++;
        if (onProgress) {
          onProgress(processed, allFilesToDownload.length);
        }
        return { name: file.name, path: localPath };
      }
    );

    // Build image map and metadata
    const imageMetadata: Record<string, FileMetadata> = {};
    for (const file of imageFiles) {
      imageMetadata[file.name] = {
        name: file.name,
        sha: file.sha,
        size: file.size,
        lastSynced: new Date().toISOString(),
      };

      const downloaded = downloadedImages.find(img => img.name === file.name);
      if (downloaded) {
        imageMap.set(file.name, downloaded.path);
      } else {
        const localPath = getImagePath(file.name);
        imageMap.set(file.name, localPath);
      }
    }

    console.log(`Total images: ${imageMap.size} (${downloadedImages.length} downloaded, ${imageMap.size - downloadedImages.length} from cache)`);
    return { imageMap, imageMetadata };
  } catch (error) {
    console.log('Error accessing images directory:', error);
    return { imageMap, imageMetadata: {} };
  }
}

/**
 * Sync repository data to local cache (with intelligent caching)
 */
export async function syncRepository(
  repoUrl: string,
  onProgress?: (stage: string, current?: number, total?: number) => void
): Promise<{ pages: Page[]; imageCount: number; stats: { filesDownloaded: number; filesCached: number; imagesDownloaded: number; imagesCached: number } }> {
  try {
    // Parse repo URL
    const config = parseRepoUrl(repoUrl);
    if (!config) {
      throw new Error('Invalid GitHub repository URL');
    }

    // Save repo config
    await saveRepoConfig(config);

    // Load existing cache metadata
    if (onProgress) onProgress('Checking cache...');
    const metadata = await loadCacheMetadata();

    // Download markdown files AND images in parallel for maximum speed
    if (onProgress) onProgress('Syncing files...');

    const [
      { pages, fileMetadata },
      { imageMap, imageMetadata }
    ] = await Promise.all([
      downloadMarkdownFiles(config).then(result => {
        if (onProgress) onProgress('Pages synced ✓');
        return result;
      }),
      downloadImages(config, metadata, (current, total) => {
        if (onProgress) onProgress(`Syncing images (${current}/${total})...`);
      }).then(result => {
        if (onProgress) onProgress('Images synced ✓');
        return result;
      })
    ]);

    // Save pages and metadata
    await savePages(pages);
    const newMetadata: CacheMetadata = {
      files: fileMetadata,
      images: imageMetadata,
      lastSyncTime: new Date().toISOString(),
    };
    await saveCacheMetadata(newMetadata);

    // Calculate stats (SAFE MODE: all files downloaded)
    const stats = {
      filesDownloaded: pages.length,
      filesCached: 0, // Safe mode: no caching
      imagesDownloaded: imageMap.size,
      imagesCached: 0, // Safe mode: no caching
    };

    console.log('Sync complete:', stats);

    return {
      pages,
      imageCount: imageMap.size,
      stats,
    };
  } catch (error) {
    console.error('Failed to sync repository:', error);
    throw error;
  }
}

/**
 * Validate GitHub repository URL
 */
export async function validateRepoUrl(repoUrl: string): Promise<boolean> {
  try {
    const config = parseRepoUrl(repoUrl);
    if (!config) {
      console.error('Failed to parse repo URL:', repoUrl);
      return false;
    }

    // Try to fetch repo info
    const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}`;
    const headers = await getHeaders();
    console.log('Validating repo:', url);
    console.log('Has token:', headers['Authorization'] ? 'Yes' : 'No');

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Validation failed:', response.status, errorBody);
    }

    return response.ok;
  } catch (error) {
    console.error('Validation error:', error);
    return false;
  }
}
