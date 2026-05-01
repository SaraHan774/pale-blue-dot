/**
 * ResolvableImage – Tiptap Image extension that resolves `.images/` paths to blob URLs.
 *
 * Images in the workspace are stored as `.images/hash.ext` in markdown.
 * The browser cannot load these directly – they must be read from the
 * virtual filesystem and converted to blob URLs.  This extension handles
 * that transparently: the ProseMirror document keeps the original `.images/`
 * src, but the rendered `<img>` element gets a blob URL.
 *
 * It also supports paste / drag-and-drop of image files.
 */

import Image from '@tiptap/extension-image';
import { Plugin, PluginKey, Selection } from '@tiptap/pm/state';

export interface ResolvableImageOptions {
  /** Resolve a `.images/...` path to a displayable URL (blob URL). */
  resolveImageSrc?: (src: string) => Promise<string>;
  /** Save a dropped/pasted image file → returns the markdown-relative path. */
  saveImage?: (file: File) => Promise<string>;
}

/**
 * In-flight resolution tracker so we don't resolve the same src twice
 * concurrently.
 */
const resolving = new Map<string, Promise<string>>();
const resolved = new Map<string, string>();

export const ResolvableImage = Image.extend<ResolvableImageOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      inline: true,
      allowBase64: true,
      resolveImageSrc: undefined,
      saveImage: undefined,
    };
  },

  addProseMirrorPlugins() {
    const plugins = this.parent?.() ?? [];
    const resolveImageSrc = this.options.resolveImageSrc;
    const saveImageFn = this.options.saveImage;

    // Plugin that resolves `.images/` src attributes on the rendered DOM.
    if (resolveImageSrc) {
      const imageResolverKey = new PluginKey('imageResolver');

      plugins.push(
        new Plugin({
          key: imageResolverKey,
          view() {
            return {
              update(view) {
                // Query all img elements and filter by getAttribute('src') —
                // CSS attribute selector img[src^=".images/"] does NOT work
                // because browsers normalize relative paths to absolute URLs
                // before attribute comparison.
                const allImgs = view.dom.querySelectorAll<HTMLImageElement>('img');

                allImgs.forEach((img) => {
                  // Use getAttribute to get the raw (non-normalized) value
                  const attrSrc = img.getAttribute('src') ?? '';
                  const dataOriginal = img.getAttribute('data-original-src') ?? '';

                  // Determine which key to look up: prefer data-original-src if set
                  const originalSrc = dataOriginal || (attrSrc.startsWith('.images/') ? attrSrc : '');
                  if (!originalSrc) return;

                  // Already resolved — ensure the blob URL is applied
                  if (resolved.has(originalSrc)) {
                    const blobUrl = resolved.get(originalSrc)!;
                    if (img.src !== blobUrl) {
                      img.src = blobUrl;
                      img.setAttribute('data-original-src', originalSrc);
                      img.style.opacity = '1';
                    }
                    return;
                  }

                  // In-flight
                  if (resolving.has(originalSrc)) return;

                  // Hide image while resolving to avoid broken icon flash
                  img.style.opacity = '0';
                  img.style.transition = 'opacity 0.2s';

                  const promise = resolveImageSrc(originalSrc);

                  promise
                    .then((blobUrl) => {
                      resolved.set(originalSrc, blobUrl);
                      // Re-query by data-original-src or matching getAttribute src
                      view.dom
                        .querySelectorAll<HTMLImageElement>('img')
                        .forEach((el) => {
                          const elAttr = el.getAttribute('src') ?? '';
                          const elOriginal = el.getAttribute('data-original-src') ?? '';
                          if (elOriginal === originalSrc || elAttr === originalSrc) {
                            el.src = blobUrl;
                            el.setAttribute('data-original-src', originalSrc);
                            el.style.opacity = '1';
                          }
                        });
                    })
                    .catch(() => {
                      img.style.opacity = '1';
                    })
                    .finally(() => {
                      resolving.delete(originalSrc);
                    });

                  resolving.set(originalSrc, promise);
                });
              },
            };
          },
        }),
      );
    }

    // Plugin for paste / drag-drop image handling
    if (saveImageFn) {
      const imageDropKey = new PluginKey('imageDrop');

      plugins.push(
        new Plugin({
          key: imageDropKey,
          props: {
            handlePaste(view, event) {
              const items = event.clipboardData?.items;
              if (!items) return false;

              for (const item of Array.from(items)) {
                if (item.type.startsWith('image/')) {
                  event.preventDefault();
                  const file = item.getAsFile();
                  if (!file) continue;

                  saveImageFn(file).then((relativePath) => {
                    const { schema } = view.state;
                    const imageNode = schema.nodes.image.create({ src: relativePath });
                    // Wrap the image in its own paragraph and add an empty paragraph after
                    // so the cursor lands on a fresh line (enabling input rules like `> `).
                    const imgParagraph = schema.nodes.paragraph.create(null, imageNode);
                    const emptyParagraph = schema.nodes.paragraph.create();
                    const { from, to } = view.state.selection;
                    const tr = view.state.tr.replaceWith(from, to, [imgParagraph, emptyParagraph]);
                    // Place cursor in the empty paragraph after the image
                    tr.setSelection(
                      Selection.near(tr.doc.resolve(tr.mapping.map(from) + imgParagraph.nodeSize))
                    );
                    view.dispatch(tr);
                  });
                  return true;
                }
              }
              return false;
            },

            handleDrop(view, event) {
              const files = event.dataTransfer?.files;
              if (!files || files.length === 0) return false;

              const imageFiles = Array.from(files).filter((f) =>
                f.type.startsWith('image/'),
              );
              if (imageFiles.length === 0) return false;

              event.preventDefault();
              const coords = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });

              imageFiles.forEach((file) => {
                saveImageFn(file).then((relativePath) => {
                  const { schema } = view.state;
                  const imageNode = schema.nodes.image.create({ src: relativePath });
                  const imgParagraph = schema.nodes.paragraph.create(null, imageNode);
                  const emptyParagraph = schema.nodes.paragraph.create();
                  const pos = coords?.pos ?? view.state.selection.from;
                  const tr = view.state.tr.replaceWith(pos, pos, [imgParagraph, emptyParagraph]);
                  tr.setSelection(
                    Selection.near(tr.doc.resolve(tr.mapping.map(pos) + imgParagraph.nodeSize))
                  );
                  view.dispatch(tr);
                });
              });

              return true;
            },
          },
        }),
      );
    }

    return plugins;
  },
});

/**
 * Clear the resolved image cache (call on page navigation).
 */
export function clearResolvedImageCache(): void {
  resolved.clear();
  resolving.clear();
}
