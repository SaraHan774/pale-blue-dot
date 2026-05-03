import fs from 'fs/promises';
import path from 'path';

import { WORKSPACE_PATH } from '../utils/index.js';

export async function handleListImages() {
  const imagesPath = path.join(WORKSPACE_PATH, '.images');
  try {
    const files = await fs.readdir(imagesPath);
    const imageFiles = files.filter(f =>
      /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(f)
    );

    const imagesInfo = await Promise.all(
      imageFiles.map(async (filename) => {
        const stats = await fs.stat(path.join(imagesPath, filename));
        return {
          filename,
          size: stats.size,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
        };
      })
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              count: imagesInfo.length,
              images: imagesInfo,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        content: [
          {
            type: 'text',
            text: 'No .images folder found',
          },
        ],
      };
    }
    throw error;
  }
}

export async function handleReadImage(args: { filename: string }) {
  const { filename } = args;
  const imagePath = path.join(WORKSPACE_PATH, '.images', filename);

  try {
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // Determine media type from extension
    const ext = path.extname(filename).toLowerCase();
    const mediaTypeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
    };
    const mediaType = mediaTypeMap[ext] || 'image/png';

    return {
      content: [
        {
          type: 'image',
          data: base64Image,
          mimeType: mediaType,
        },
      ],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Image not found: ${filename}`);
    }
    throw error;
  }
}
