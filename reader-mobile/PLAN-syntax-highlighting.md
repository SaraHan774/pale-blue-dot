# Add Syntax Highlighting to Code Blocks

## Context
Code blocks in the reader-mobile app render as plain monospace text with no color differentiation. The user wants syntax highlighting so code is easier to read. The `marked` library already generates `class="language-xxx"` attributes on `<code>` tags, but they're currently unused.

## Approach: Native `react-native-syntax-highlighter`
Use `react-native-syntax-highlighter` which renders highlighted code as native `<Text>` components (no WebView). This keeps code blocks inside the existing `ScrollView` flow without iframe/WebView overhead or height-measurement hacks.

## Files to Modify
- **`components/MarkdownRenderer.tsx`** — Replace `PreRenderer` with a custom renderer that extracts code + language, then renders via `SyntaxHighlighter`

## Steps

### 1. Install dependency
```
npm install react-native-syntax-highlighter react-syntax-highlighter
```
(`react-syntax-highlighter` is a peer dep; types are included)

### 2. Rewrite `PreRenderer` in `MarkdownRenderer.tsx`
- Extract the raw code text and language from the `<pre><code class="language-xxx">` tnode
- Render using `SyntaxHighlighter` from `react-native-syntax-highlighter` with a dark theme (e.g., `atomOneDark` or `dracula`) that matches the app's `#2a2a2a` background
- Wrap in horizontal `ScrollView` (already present) for long lines
- Fallback: if no language detected, render with auto-detection or plain style

### 3. Keep existing styles
- Preserve the `codeBlockStyles` container (background, border-radius, margins)
- The highlighter theme handles token colors; the container handles layout

## Verification
- Run `npx tsc --noEmit` to check for compile errors
- Reload on device via adb (already connected at `192.168.45.103:37695`)
- Open a page with code blocks and verify colored syntax highlighting appears
- Test code blocks with and without language specifiers
