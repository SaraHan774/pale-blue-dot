import React from 'react';
import Svg, { Circle } from 'react-native-svg';

interface LogoProps {
  width?: number;
  height?: number;
}

export default function Logo({ width = 40, height = 40 }: LogoProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 120 120" fill="none">
      {/* First dot - dark blue */}
      <Circle cx="50" cy="60" r="22" fill="#5B8AB8" />

      {/* Second dot - bright pale blue (overlapping) */}
      <Circle cx="70" cy="60" r="22" fill="#91C4F2" />
    </Svg>
  );
}
