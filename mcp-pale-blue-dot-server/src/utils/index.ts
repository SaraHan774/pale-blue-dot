import crypto from 'crypto';
import path from 'path';

// Workspace path - configurable via environment variable
export const WORKSPACE_PATH = process.env.PALE_BLUE_DOT_WORKSPACE || path.join(process.cwd(), '../workspace');

// Helper: Generate unique ID (UUID v4 format matching codebase)
export function generateId(): string {
  return crypto.randomUUID();
}

// Helper: Sanitize filename (matching pageService.sanitizeFileName)
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
