import * as FileSystem from 'expo-file-system/legacy';
import type { CachedData, Page, RepoConfig, CacheMetadata } from '@/types';

const CACHE_DIR = `${FileSystem.documentDirectory}cache/`;
const IMAGES_DIR = `${CACHE_DIR}images/`;
const PAGES_FILE = `${CACHE_DIR}pages.json`;
const CONFIG_FILE = `${CACHE_DIR}config.json`;
const METADATA_FILE = `${CACHE_DIR}metadata.json`;

/**
 * Initialize cache directories
 */
export async function initializeCache(): Promise<void> {
  try {
    // Create cache and images directories if they don't exist
    const cacheInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!cacheInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }

    const imagesInfo = await FileSystem.getInfoAsync(IMAGES_DIR);
    if (!imagesInfo.exists) {
      await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('Failed to initialize cache:', error);
    throw error;
  }
}

/**
 * Save pages to cache
 */
export async function savePages(pages: Page[]): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(
      PAGES_FILE,
      JSON.stringify(pages, null, 2)
    );
  } catch (error) {
    console.error('Failed to save pages:', error);
    throw error;
  }
}

/**
 * Load pages from cache
 */
export async function loadPages(): Promise<Page[]> {
  try {
    const info = await FileSystem.getInfoAsync(PAGES_FILE);
    if (!info.exists) {
      return [];
    }

    const content = await FileSystem.readAsStringAsync(PAGES_FILE);
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load pages:', error);
    return [];
  }
}

/**
 * Minimum valid image file size in bytes.
 * LFS pointer files are ~130 bytes, HTML error pages vary.
 * Real images are almost always > 1KB.
 */
const MIN_VALID_IMAGE_SIZE = 1024;

/**
 * Check if a cached image file is valid (not an LFS pointer, HTML error, etc.)
 * Reads the file as base64 and checks for known image format magic bytes.
 */
async function isValidImageFile(path: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return false;
    // Files under 1KB are almost certainly not real images
    if (info.size && info.size < 1024) {
      console.log(`Image file too small (${info.size} bytes):`, path);
      return false;
    }

    // Read entire file as base64, then check first few bytes for magic numbers
    const base64Content = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Decode just the first 16 chars of base64 (= 12 bytes, enough for magic bytes)
    const headerB64 = base64Content.substring(0, 24);
    const bytes = atob(headerB64);
    const b = Array.from(bytes, (c) => c.charCodeAt(0));

    // Check known image format magic bytes
    const isPNG = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
    const isJPEG = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
    const isGIF = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
    const isWebP = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46;
    const isBMP = b[0] === 0x42 && b[1] === 0x4D;

    const isValid = isPNG || isJPEG || isGIF || isWebP || isBMP;

    if (!isValid) {
      const hexBytes = b.slice(0, 8).map(v => v.toString(16).padStart(2, '0')).join(' ');
      console.warn(`Invalid image (magic: ${hexBytes}, size: ${info.size}):`, path);
      // Try to log text content for debugging
      try {
        const textContent = await FileSystem.readAsStringAsync(path);
        console.warn('File content preview:', textContent.substring(0, 200));
      } catch { /* ignore */ }
    }

    return isValid;
  } catch (error) {
    console.warn('Failed to validate image file:', path, error);
    return false;
  }
}

/**
 * Save image to local cache
 */
export async function saveImage(
  filename: string,
  downloadUrl: string,
  headers?: Record<string, string>
): Promise<string> {
  try {
    const localPath = `${IMAGES_DIR}${filename}`;
    console.log('Saving image:', filename, 'to:', localPath);

    // Check if already exists AND is valid
    const existingValid = await isValidImageFile(localPath);
    if (existingValid) {
      console.log('Valid image already cached:', localPath);
      return localPath;
    }

    // Delete invalid cached file if it exists
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) {
      console.log('Removing invalid cached image:', localPath);
      await FileSystem.deleteAsync(localPath, { idempotent: true });
    }

    // Download and save with headers
    console.log('Downloading from:', downloadUrl);
    const downloadResult = await FileSystem.downloadAsync(downloadUrl, localPath, {
      headers: headers || {},
    });
    console.log(`Download result for ${filename}: status=${downloadResult.status}, uri=${downloadResult.uri}`);

    // Verify the downloaded file is a valid image
    const valid = await isValidImageFile(localPath);
    if (!valid) {
      const verifyInfo = await FileSystem.getInfoAsync(localPath);
      const fileSize = verifyInfo.exists && 'size' in verifyInfo ? verifyInfo.size : 0;
      console.warn(`Downloaded file appears invalid (size: ${fileSize || 0} bytes):`, localPath);
      // Don't delete - caller may want to retry with different URL
      throw new Error(`Downloaded file is not a valid image (size: ${fileSize || 0} bytes)`);
    }

    console.log('Image downloaded successfully:', localPath);
    return localPath;
  } catch (error) {
    console.error('Failed to save image:', filename, error);
    throw error;
  }
}

/**
 * Get local path for image
 */
export function getImagePath(filename: string): string {
  return `${IMAGES_DIR}${filename}`;
}

/**
 * Save repo configuration
 */
export async function saveRepoConfig(config: RepoConfig): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(
      CONFIG_FILE,
      JSON.stringify(config, null, 2)
    );
  } catch (error) {
    console.error('Failed to save repo config:', error);
    throw error;
  }
}

/**
 * Load repo configuration
 */
export async function loadRepoConfig(): Promise<RepoConfig | null> {
  try {
    const info = await FileSystem.getInfoAsync(CONFIG_FILE);
    if (!info.exists) {
      return null;
    }

    const content = await FileSystem.readAsStringAsync(CONFIG_FILE);
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load repo config:', error);
    return null;
  }
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      await initializeCache();
    }
  } catch (error) {
    console.error('Failed to clear cache:', error);
    throw error;
  }
}

/**
 * Get cache size in MB
 */
export async function getCacheSize(): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!info.exists) {
      return 0;
    }

    // This is a rough estimate - actual implementation would need to recursively calculate
    return 0; // TODO: Implement recursive size calculation
  } catch (error) {
    console.error('Failed to get cache size:', error);
    return 0;
  }
}

/**
 * Save cache metadata
 */
export async function saveCacheMetadata(metadata: CacheMetadata): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(
      METADATA_FILE,
      JSON.stringify(metadata, null, 2)
    );
  } catch (error) {
    console.error('Failed to save cache metadata:', error);
    throw error;
  }
}

/**
 * Load cache metadata
 */
export async function loadCacheMetadata(): Promise<CacheMetadata | null> {
  try {
    const info = await FileSystem.getInfoAsync(METADATA_FILE);
    if (!info.exists) {
      return null;
    }

    const content = await FileSystem.readAsStringAsync(METADATA_FILE);
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load cache metadata:', error);
    return null;
  }
}
