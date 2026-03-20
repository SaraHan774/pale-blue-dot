import React, { useMemo } from 'react';
import { useWindowDimensions, Linking, Alert, ScrollView, StyleSheet, Image, View, Text } from 'react-native';
import RenderHTML, { CustomBlockRenderer, defaultHTMLElementModels, HTMLContentModel, TNode } from 'react-native-render-html';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
}

// Custom renderer for pre/code blocks to enable horizontal scrolling
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

// Custom renderer for images to handle local file URIs
const ImageRenderer = (props: any) => {
  const { tnode } = props;
  const { src, alt } = tnode.attributes;
  const [hasError, setHasError] = React.useState(false);

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
    </View>
  );
};

const renderers = {
  img: ImageRenderer,
  pre: PreRenderer,
};

const customHTMLElementModels = {
  pre: defaultHTMLElementModels.pre.extend({
    contentModel: HTMLContentModel.mixed,
  }),
};

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const { width } = useWindowDimensions();

  // Convert markdown to HTML
  const html = useMemo(() => {
    try {
      const result = marked(content, {
        breaks: true,
        gfm: true,
      }) as string;

      // Log image tags in HTML
      const imgMatches = result.match(/<img[^>]+>/g);
      if (imgMatches) {
        console.log('Found img tags in HTML:', imgMatches.length);
        imgMatches.forEach(tag => console.log('IMG tag:', tag));
      } else {
        console.log('No img tags found in HTML');
      }

      return result;
    } catch (error) {
      console.error('Failed to parse markdown:', error);
      return content;
    }
  }, [content]);

  // Handle link press - open in external browser
  const handleLinkPress = async (event: any, href: string) => {
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

  return (
    <RenderHTML
      contentWidth={width - 32} // Account for padding
      source={{ html }}
      tagsStyles={tagsStyles}
      baseStyle={baseStyle}
      renderers={renderers}
      customHTMLElementModels={customHTMLElementModels}
      renderersProps={{
        a: {
          onPress: handleLinkPress,
        },
      }}
      enableExperimentalMarginCollapsing={true}
    />
  );
}

const baseStyle = {
  color: '#e0e0e0',
  fontSize: 16,
  lineHeight: 26,
};

const tagsStyles = {
  body: {
    color: '#e0e0e0',
    fontSize: 16,
  },
  h1: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700' as const,
    marginTop: 20,
    marginBottom: 16,
  },
  h2: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700' as const,
    marginTop: 18,
    marginBottom: 12,
  },
  h3: {
    color: '#ffffff',
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '700' as const,
    marginTop: 16,
    marginBottom: 10,
  },
  h4: {
    color: '#ffffff',
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '600' as const,
    marginTop: 14,
    marginBottom: 8,
  },
  h5: {
    color: '#ffffff',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600' as const,
    marginTop: 12,
    marginBottom: 8,
  },
  h6: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    marginTop: 12,
    marginBottom: 8,
  },
  p: {
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 14,
    color: '#e0e0e0',
  },
  code: {
    backgroundColor: '#2a2a2a',
    color: '#4fc3f7',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: 'monospace',
  },
  pre: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    marginVertical: 8,
    padding: 0,
    overflow: 'hidden' as const,
  },
  blockquote: {
    backgroundColor: '#2a2a2a',
    borderLeftWidth: 4,
    borderLeftColor: '#4fc3f7',
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
    color: '#4fc3f7',
    textDecorationLine: 'underline' as const,
  },
  img: {
    marginVertical: 12,
    borderRadius: 6,
  },
  table: {
    borderWidth: 1,
    borderColor: '#444',
    marginVertical: 8,
  },
  th: {
    padding: 8,
    fontWeight: 'bold' as const,
    color: '#ffffff',
    backgroundColor: '#2a2a2a',
  },
  td: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  hr: {
    backgroundColor: '#444',
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

const codeBlockStyles = StyleSheet.create({
  scrollContainer: {
    backgroundColor: '#2a2a2a',
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
    backgroundColor: '#2a2a2a',
  },
  errorContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    padding: 24,
    marginVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#999',
    fontSize: 14,
  },
  errorSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
});
