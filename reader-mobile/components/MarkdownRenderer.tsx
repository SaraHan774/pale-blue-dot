import React, { useMemo, useState, useCallback } from 'react';
import { useWindowDimensions, Linking, Alert, ScrollView, StyleSheet, Image, View, Text, TouchableOpacity } from 'react-native';
import ImageView from 'react-native-image-viewing';
import RenderHTML, { CustomBlockRenderer, defaultHTMLElementModels, HTMLContentModel } from 'react-native-render-html';
import { marked } from 'marked';
import {
  bgSecondary,
  bgTertiary,
  textPrimary,
  textSecondary,
  border,
  accentPrimary,
} from '@/constants/colors';

interface MarkdownRendererProps {
  content: string;
}

// ─── Table parsing from HTML string ──────────────────────────────────

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function parseTableHtml(tableHtml: string): ParsedTable {
  const headers: string[] = [];
  const rows: string[][] = [];

  // Extract header cells from <thead>
  const theadMatch = tableHtml.match(/<thead>([\s\S]*?)<\/thead>/i);
  if (theadMatch) {
    const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    let thMatch;
    while ((thMatch = thRegex.exec(theadMatch[1])) !== null) {
      headers.push(stripHtmlTags(thMatch[1]));
    }
  }

  // Extract body rows from <tbody>
  const tbodyMatch = tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  const bodyHtml = tbodyMatch ? tbodyMatch[1] : tableHtml;

  const trRegex = /<tr>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  // Skip the first <tr> if we already got headers from <thead>
  let isFirst = true;
  while ((trMatch = trRegex.exec(bodyHtml)) !== null) {
    if (isFirst && theadMatch) {
      // If tbody exists, don't skip; if no tbody, skip first tr (it's header)
      if (!tbodyMatch) { isFirst = false; continue; }
    }
    isFirst = false;

    const row: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
      row.push(stripHtmlTags(tdMatch[1]));
    }
    if (row.length > 0) {
      rows.push(row);
    }
  }

  return { headers, rows };
}

// ─── CJK-aware column width calculation ──────────────────────────────

function isCJK(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (
    (code >= 0xAC00 && code <= 0xD7AF) ||
    (code >= 0x3000 && code <= 0x9FFF) ||
    (code >= 0xF900 && code <= 0xFAFF) ||
    (code >= 0x1100 && code <= 0x11FF) ||
    (code >= 0x3130 && code <= 0x318F)
  );
}

function measureTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of text) {
    width += isCJK(ch) ? fontSize : fontSize * 0.55;
  }
  return width;
}

function calculateColumnWidths(
  headers: string[],
  rows: string[][],
  availableWidth: number
): number[] {
  const colCount = headers.length || (rows[0]?.length ?? 0);
  if (colCount === 0) return [];

  const FONT_SIZE = 13;
  const CELL_PADDING = 24;
  const MIN_COL_WIDTH = 70;

  const naturalWidths: number[] = [];
  for (let col = 0; col < colCount; col++) {
    let maxWidth = measureTextWidth(headers[col] || '', FONT_SIZE);
    for (const row of rows) {
      maxWidth = Math.max(maxWidth, measureTextWidth(row[col] || '', FONT_SIZE));
    }
    naturalWidths.push(Math.max(MIN_COL_WIDTH, maxWidth + CELL_PADDING));
  }

  const totalNatural = naturalWidths.reduce((a, b) => a + b, 0);
  if (totalNatural <= availableWidth) {
    const scale = availableWidth / totalNatural;
    return naturalWidths.map((w) => Math.floor(w * scale));
  }
  return naturalWidths;
}

// ─── Native Table Component ──────────────────────────────────────────

function NativeTable({ table, availableWidth }: { table: ParsedTable; availableWidth: number }) {
  const { headers, rows } = table;
  const colWidths = useMemo(
    () => calculateColumnWidths(headers, rows, availableWidth),
    [headers, rows, availableWidth]
  );

  const totalTableWidth = colWidths.reduce((a, b) => a + b, 0);
  const needsScroll = totalTableWidth > availableWidth;

  const tableContent = (
    <View style={[tableStyles.table, needsScroll ? { width: totalTableWidth } : undefined]}>
      {headers.length > 0 && (
        <View style={tableStyles.headerRow}>
          {headers.map((header, i) => (
            <View
              key={`th-${i}`}
              style={[
                tableStyles.headerCell,
                needsScroll ? { width: colWidths[i] } : { flex: colWidths[i] },
                i < headers.length - 1 && tableStyles.cellBorderRight,
              ]}
            >
              <Text style={tableStyles.headerText}>{header}</Text>
            </View>
          ))}
        </View>
      )}
      {rows.map((row, rowIdx) => (
        <View
          key={`tr-${rowIdx}`}
          style={[
            tableStyles.bodyRow,
            rowIdx % 2 === 1 && tableStyles.bodyRowAlt,
          ]}
        >
          {row.map((cell, colIdx) => (
            <View
              key={`td-${rowIdx}-${colIdx}`}
              style={[
                tableStyles.bodyCell,
                needsScroll ? { width: colWidths[colIdx] } : { flex: colWidths[colIdx] },
                colIdx < row.length - 1 && tableStyles.cellBorderRight,
              ]}
            >
              <Text style={tableStyles.bodyText}>{cell}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  if (needsScroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        nestedScrollEnabled={true}
        bounces={false}
        style={tableStyles.scrollWrapper}
      >
        {tableContent}
      </ScrollView>
    );
  }

  return tableContent;
}

// ─── Pre/Code Renderer ───────────────────────────────────────────────

const PreRenderer: CustomBlockRenderer = ({ TDefaultRenderer, ...props }) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={true}
      nestedScrollEnabled={true}
      style={codeBlockStyles.scrollContainer}
      contentContainerStyle={codeBlockStyles.scrollContent}
    >
      <TDefaultRenderer
        {...props}
        style={{
          flexShrink: 0,
          flexGrow: 1,
          padding: 12,
        }}
      />
    </ScrollView>
  );
};

// ─── Image Viewer (with pinch-to-zoom) ──────────────────────────────
// Note: This uses react-native-image-viewing which provides:
// - Pinch to zoom
// - Double tap to zoom
// - Swipe to dismiss
// - Smooth animations

// ─── Image Renderer ──────────────────────────────────────────────────

const ImageRenderer = (props: any) => {
  const { tnode } = props;
  const { src, alt } = tnode.attributes;
  const [hasError, setHasError] = React.useState(false);
  const [viewerVisible, setViewerVisible] = React.useState(false);

  if (!src) {
    return <Text style={{ color: '#666', fontStyle: 'italic' }}>No image source</Text>;
  }

  if (hasError) {
    return (
      <View style={imageStyles.errorContainer}>
        <Text style={imageStyles.errorText}>Image could not be loaded</Text>
        <Text style={imageStyles.errorSubtext}>{alt || src.split('/').pop()}</Text>
      </View>
    );
  }

  return (
    <View style={{ marginVertical: 12 }}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setViewerVisible(true)}>
        <Image
          source={{ uri: src }}
          style={imageStyles.image}
          resizeMode="contain"
          onLoad={() => console.log('✅ Image loaded:', src)}
          onError={(error) => {
            console.error('❌ Image failed:', src, JSON.stringify(error.nativeEvent));
            setHasError(true);
          }}
        />
      </TouchableOpacity>
      <ImageView
        images={[{ uri: src }]}
        imageIndex={0}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
        presentationStyle="overFullScreen"
        swipeToCloseEnabled={true}
        doubleTapToZoomEnabled={true}
      />
    </View>
  );
};

// ─── RenderHTML Config ───────────────────────────────────────────────

const renderers = {
  img: ImageRenderer,
  pre: PreRenderer,
};

const customHTMLElementModels = {
  pre: defaultHTMLElementModels.pre.extend({
    contentModel: HTMLContentModel.mixed,
  }),
};

// ─── Main Component ─────────────────────────────────────────────────

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const { width } = useWindowDimensions();
  const availableWidth = width - 32;

  // Convert markdown to HTML and extract tables
  const { htmlParts, tables } = useMemo(() => {
    try {
      let result = marked(content, {
        breaks: true,
        gfm: true,
      }) as string;

      // Extract tables and replace with placeholders
      const extractedTables: ParsedTable[] = [];
      const tableRegex = /<table>([\s\S]*?)<\/table>/gi;

      const parts = result.split(tableRegex);
      // split with capture group gives: [before, tableInner, between, tableInner, after, ...]
      // But we need the full <table>...</table> match. Let's use a different approach.

      const allTables: ParsedTable[] = [];
      let tableMatch;
      const fullTableRegex = /<table>([\s\S]*?)<\/table>/gi;
      while ((tableMatch = fullTableRegex.exec(result)) !== null) {
        allTables.push(parseTableHtml(tableMatch[0]));
      }

      // Replace tables with placeholder
      const PLACEHOLDER = '___TABLE_PLACEHOLDER___';
      const htmlWithPlaceholders = result.replace(fullTableRegex, PLACEHOLDER);
      const splitParts = htmlWithPlaceholders.split(PLACEHOLDER);

      return { htmlParts: splitParts, tables: allTables };
    } catch (error) {
      console.error('Failed to parse markdown:', error);
      return { htmlParts: [content], tables: [] };
    }
  }, [content]);

  const handleLinkPress = async (_event: any, href: string) => {
    try {
      const supported = await Linking.canOpenURL(href);
      if (supported) {
        await Linking.openURL(href);
      } else {
        Alert.alert('Error', `Cannot open URL: ${href}`);
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
      Alert.alert('Error', 'Failed to open link');
    }
  };

  // Interleave HTML sections with native table components
  const elements: React.ReactNode[] = [];
  for (let i = 0; i < htmlParts.length; i++) {
    const htmlPart = htmlParts[i].trim();
    if (htmlPart) {
      elements.push(
        <RenderHTML
          key={`html-${i}`}
          contentWidth={availableWidth}
          source={{ html: htmlPart }}
          tagsStyles={tagsStyles}
          baseStyle={baseStyle}
          renderers={renderers}
          customHTMLElementModels={customHTMLElementModels}
          renderersProps={{
            a: { onPress: handleLinkPress },
          }}
          enableExperimentalMarginCollapsing={true}
        />
      );
    }
    if (i < tables.length) {
      elements.push(
        <NativeTable key={`table-${i}`} table={tables[i]} availableWidth={availableWidth} />
      );
    }
  }

  return <>{elements}</>;
}

// ─── Styles ──────────────────────────────────────────────────────────

const baseStyle = {
  color: textPrimary,
  fontSize: 14,
  lineHeight: 22,
};

const tagsStyles = {
  body: {
    color: textPrimary,
    fontSize: 14,
  },
  h1: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    marginTop: 16,
    marginBottom: 12,
  },
  h2: {
    color: '#ffffff',
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '700' as const,
    marginTop: 14,
    marginBottom: 10,
  },
  h3: {
    color: '#ffffff',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700' as const,
    marginTop: 12,
    marginBottom: 8,
  },
  h4: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    marginTop: 10,
    marginBottom: 6,
  },
  h5: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600' as const,
    marginTop: 8,
    marginBottom: 6,
  },
  h6: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
    marginTop: 8,
    marginBottom: 6,
  },
  p: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
    color: textPrimary,
  },
  code: {
    backgroundColor: bgTertiary,
    color: accentPrimary,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: 'monospace',
    whiteSpace: 'pre' as const,
  },
  pre: {
    backgroundColor: bgTertiary,
    borderRadius: 6,
    marginVertical: 8,
    padding: 0,
    overflow: 'hidden' as const,
    whiteSpace: 'pre' as const,
  },
  blockquote: {
    backgroundColor: bgTertiary,
    borderLeftWidth: 4,
    borderLeftColor: accentPrimary,
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },
  ul: {
    marginVertical: 8,
  },
  ol: {
    marginVertical: 8,
  },
  li: {
    marginBottom: 4,
  },
  a: {
    color: accentPrimary,
    textDecorationLine: 'underline' as const,
  },
  img: {
    marginVertical: 12,
    borderRadius: 6,
  },
  hr: {
    backgroundColor: border,
    height: 1,
    marginVertical: 16,
  },
  strong: {
    fontWeight: 'bold' as const,
    color: '#ffffff',
  },
  em: {
    fontStyle: 'italic' as const,
  },
  del: {
    textDecorationLine: 'line-through' as const,
  },
};

const tableStyles = StyleSheet.create({
  scrollWrapper: {
    marginVertical: 10,
  },
  table: {
    overflow: 'hidden',
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: bgTertiary,
    borderBottomWidth: 2,
    borderBottomColor: border,
  },
  headerCell: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  headerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  bodyRow: {
    flexDirection: 'row',
    backgroundColor: bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  bodyRowAlt: {
    backgroundColor: bgTertiary,
  },
  bodyCell: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  bodyText: {
    color: textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  cellBorderRight: {
    borderRightWidth: 1,
    borderRightColor: border,
  },
});

const codeBlockStyles = StyleSheet.create({
  scrollContainer: {
    backgroundColor: bgTertiary,
    borderRadius: 6,
    marginVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});

const imageStyles = StyleSheet.create({
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    marginVertical: 12,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  errorContainer: {
    backgroundColor: bgTertiary,
    borderRadius: 6,
    padding: 24,
    marginVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: textSecondary,
    fontSize: 14,
  },
  errorSubtext: {
    color: textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
});

// Zoom styles removed - handled by react-native-image-viewing library
