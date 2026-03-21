/**
 * Pale Blue Dot Color Palette
 * Matches the desktop application's theme
 * Inspired by Carl Sagan's "Pale Blue Dot" - Earth from space
 */

export const Colors = {
  // ─── Light Theme (Minimalist Pale) ───────────────────────────────────
  light: {
    // Backgrounds
    bgPrimary: '#fafbfc',       // Softer white with hint of blue
    bgSecondary: '#f0f4f8',     // Pale blue-grey
    bgTertiary: '#e1e8ed',      // Slightly deeper pale blue

    // Text
    textPrimary: '#1a2332',     // Deep space navy for text
    textSecondary: '#5a6c7d',   // Muted blue-grey

    // Borders & Dividers
    border: '#d0dae5',          // Soft pale blue border
    divider: '#e1e8ed',

    // Accent - Pale Blue (Earth from space)
    accentPrimary: '#7BA5D1',   // Pale blue - the pale blue dot
    accentHover: '#5B8AB8',     // Deeper pale blue on hover
    accentSubtle: '#A3C4E0',    // Lighter pale blue for backgrounds

    // Shadows
    shadowLight: 'rgba(123, 165, 209, 0.08)',
    shadowMedium: 'rgba(123, 165, 209, 0.12)',
    shadowStrong: 'rgba(123, 165, 209, 0.15)',

    // Status Colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#7BA5D1',
  },

  // ─── Dark Theme (Deep Space) ─────────────────────────────────────────
  dark: {
    // Backgrounds
    bgPrimary: '#0f1419',       // Deep space black
    bgSecondary: '#1a2332',     // Dark cosmic blue
    bgTertiary: '#243447',      // Lighter cosmic blue

    // Text
    textPrimary: '#e8f0f8',     // Soft white
    textSecondary: '#8a9ba8',   // Muted blue-grey

    // Borders & Dividers
    border: '#2d3f52',          // Dark border
    divider: '#243447',

    // Accent - Glowing Pale Blue
    accentPrimary: '#91C4F2',   // Brighter pale blue for dark
    accentHover: '#B3D9FF',     // Lighter on hover
    accentSubtle: '#5B8AB8',    // Darker pale blue for backgrounds

    // Shadows
    shadowLight: 'rgba(145, 196, 242, 0.15)',
    shadowMedium: 'rgba(145, 196, 242, 0.2)',
    shadowStrong: 'rgba(145, 196, 242, 0.25)',

    // Status Colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#91C4F2',
  },
} as const;

// ─── Default Export (Dark Mode) ──────────────────────────────────────
// Since the mobile app currently uses dark mode, export dark as default
export default Colors.dark;

// ─── Individual Exports for Convenience ──────────────────────────────
export const {
  bgPrimary,
  bgSecondary,
  bgTertiary,
  textPrimary,
  textSecondary,
  border,
  divider,
  accentPrimary,
  accentHover,
  accentSubtle,
  shadowLight,
  shadowMedium,
  shadowStrong,
  success,
  warning,
  error,
  info,
} = Colors.dark;
