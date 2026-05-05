// Type declarations for modules missing type definitions

declare module 'marked' {
  export interface MarkedOptions {
    breaks?: boolean;
    gfm?: boolean;
    headerIds?: boolean;
    mangle?: boolean;
    pedantic?: boolean;
    sanitize?: boolean;
    silent?: boolean;
    smartLists?: boolean;
    smartypants?: boolean;
    xhtml?: boolean;
  }

  export function marked(src: string, options?: MarkedOptions): string | Promise<string>;
  export namespace marked {
    function setOptions(options: MarkedOptions): void;
    function use(extension: object): void;
  }
}

declare module '@expo/vector-icons' {
  import { ComponentProps } from 'react';
  import { TextProps } from 'react-native';

  export interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }

  export class Ionicons extends React.Component<IconProps> {}
  export class MaterialIcons extends React.Component<IconProps> {}
  export class FontAwesome extends React.Component<IconProps> {}
  export class AntDesign extends React.Component<IconProps> {}
  export class Feather extends React.Component<IconProps> {}
  export class MaterialCommunityIcons extends React.Component<IconProps> {}
}
