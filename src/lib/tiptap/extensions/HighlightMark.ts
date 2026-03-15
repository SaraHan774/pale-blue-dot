import { Mark, mergeAttributes } from '@tiptap/core';

export interface HighlightMarkOptions {
  HTMLAttributes: Record<string, any>;
  onHighlightClick?: (highlightId: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    highlight: {
      /**
       * Set a highlight mark with color and ID
       */
      setHighlight: (attributes: { id: string; color: string; style: string }) => ReturnType;
      /**
       * Remove highlight mark
       */
      unsetHighlight: () => ReturnType;
      /**
       * Toggle highlight mark
       */
      toggleHighlight: (attributes: { id: string; color: string; style: string }) => ReturnType;
    };
  }
}

/**
 * Highlight Mark extension for Tiptap
 * Native ProseMirror marks - no offset mapping needed!
 */
export const HighlightMark = Mark.create<HighlightMarkOptions>({
  name: 'highlight',

  addOptions() {
    return {
      HTMLAttributes: {},
      onHighlightClick: undefined,
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize: {
          open(_state: any, mark: any) {
            const attrs = mark.attrs || {};
            const parts = [`<mark data-highlight-id="${attrs.id || ''}"`];
            parts.push(`data-highlight-color="${attrs.color || '#FFEB3B'}"`);
            parts.push(`data-highlight-style="${attrs.style || 'highlight'}"`);
            if (attrs.createdAt) {
              parts.push(`data-highlight-created="${attrs.createdAt}"`);
            }
            return parts.join(' ') + '>';
          },
          close: '</mark>',
        },
        parse: {
          // Parsing handled by parseHTML() via tiptap-markdown's html:true mode
        },
      },
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-highlight-id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {};
          }

          return {
            'data-highlight-id': attributes.id,
          };
        },
      },
      color: {
        default: '#FFEB3B',
        parseHTML: element => element.getAttribute('data-highlight-color'),
        renderHTML: attributes => {
          return {
            'data-highlight-color': attributes.color,
          };
        },
      },
      style: {
        default: 'highlight',
        parseHTML: element => element.getAttribute('data-highlight-style'),
        renderHTML: attributes => {
          return {
            'data-highlight-style': attributes.style,
          };
        },
      },
      createdAt: {
        default: null,
        parseHTML: element => element.getAttribute('data-highlight-created'),
        renderHTML: attributes => {
          if (!attributes.createdAt) {
            return {};
          }

          return {
            'data-highlight-created': attributes.createdAt,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'mark[data-highlight-id]',
        priority: 60,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const style = HTMLAttributes['data-highlight-style'] || 'highlight';
    const color = HTMLAttributes['data-highlight-color'] || '#FFEB3B';

    // Helper function to calculate brightness of a color
    const getBrightness = (hexColor: string): number => {
      const hex = hexColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      // Calculate perceived brightness (0-255)
      return (r * 299 + g * 587 + b * 114) / 1000;
    };

    // Apply style based on highlight type
    let bgColor = color;
    let textColor = 'inherit';
    let textDecoration = 'none';

    if (style === 'underline') {
      bgColor = 'transparent';
      textDecoration = `underline ${color} 2px`;
    } else {
      // For highlight style, check if color is bright and adjust text color
      const brightness = getBrightness(color);
      // If brightness > 180, use dark text for better contrast
      if (brightness > 180) {
        textColor = '#1a1a1a'; // Dark text for bright backgrounds
      }
    }

    return [
      'mark',
      mergeAttributes(
        {
          class: 'highlight-mark',
          style: `background-color: ${bgColor}; color: ${textColor}; text-decoration: ${textDecoration};`,
        },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      0,
    ];
  },

  addCommands() {
    return {
      setHighlight:
        attributes =>
        ({ commands }) => {
          return commands.setMark(this.name, {
            ...attributes,
            createdAt: new Date().toISOString(),
          });
        },
      unsetHighlight:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      toggleHighlight:
        attributes =>
        ({ commands }) => {
          return commands.toggleMark(this.name, {
            ...attributes,
            createdAt: new Date().toISOString(),
          });
        },
    };
  },

  // Store highlight data for serialization
  onSelectionUpdate() {
    // This will be used to track active highlights
  },
});
