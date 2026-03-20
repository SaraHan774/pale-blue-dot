export interface Page {
  id: string;
  title: string;
  content: string;
  parentId?: string;
  kanbanColumn?: string;
  tags?: string[];
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  viewType?: 'document' | 'kanban';
  pinned?: boolean;
  pinnedAt?: string;
}

export interface RepoConfig {
  owner: string;
  repo: string;
  branch?: string;
}

export interface CachedData {
  pages: Page[];
  images: Map<string, string>; // filename -> local path
  lastUpdated: string;
  repoConfig: RepoConfig;
}

export interface FileMetadata {
  name: string;
  sha: string;
  size: number;
  lastSynced: string;
}

export interface CacheMetadata {
  files: Record<string, FileMetadata>; // filename -> metadata
  images: Record<string, FileMetadata>; // filename -> metadata
  lastSyncedCommit?: string;
  lastSyncTime: string;
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  download_url: string | null;
  type: 'file' | 'dir';
}
