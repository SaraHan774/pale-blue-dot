import { Extension } from '@tiptap/core';

/**
 * Matches the existing PageEditor shortcuts:
 * - Cmd+B: Bold
 * - Cmd+I: Italic
 * - Cmd+E: Inline Code
 * - Cmd+S: Save (handled in TiptapEditorWrapper)
 */
export const KeyboardShortcuts = Extension.create({
  name: 'keyboardShortcuts',

  addKeyboardShortcuts() {
    return {
      // Cmd+E or Ctrl+E for inline code
      'Mod-e': () => this.editor.commands.toggleCode(),

      // Override default Cmd+B to ensure it works
      'Mod-b': () => this.editor.commands.toggleBold(),

      // Override default Cmd+I to ensure it works
      'Mod-i': () => this.editor.commands.toggleItalic(),

      // Cmd+Shift+X for strikethrough (bonus)
      'Mod-Shift-x': () => this.editor.commands.toggleStrike(),
    };
  },
});
