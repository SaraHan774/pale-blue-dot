interface PaleBlueDotLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function PaleBlueDotLogo({ size = 32, showText = false, className = '' }: PaleBlueDotLogoProps) {
  return (
    <div className={`pale-blue-dot-logo ${className}`} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Pale Blue Dot Logo"
      >
        {/* First dot - dark blue */}
        <circle
          cx="50"
          cy="60"
          r="22"
          fill="#5B8AB8"
        />

        {/* Second dot - bright pale blue (overlapping) */}
        <circle
          cx="70"
          cy="60"
          r="22"
          fill="#91C4F2"
        />
      </svg>

      {showText && (
        <span
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 600,
            fontSize: size > 32 ? '18px' : '16px',
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em'
          }}
        >
          Pale Blue Dot
        </span>
      )}
    </div>
  );
}
