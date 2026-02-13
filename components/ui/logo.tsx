/**
 * Pump Match Logo - Two overlapping pill shapes forming a match/connection symbol.
 * Colors: Neon Emerald (#10b981) + Deep Purple (#a855f7)
 */
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Glow filter for neon effect */}
      <defs>
        <filter id="pm-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="pm-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id="pm-grad-2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>

      {/* Left pill - Emerald (tilted left) */}
      <rect
        x="6"
        y="8"
        width="18"
        height="34"
        rx="9"
        fill="url(#pm-grad-1)"
        opacity="0.9"
        transform="rotate(-12 15 25)"
        filter="url(#pm-glow)"
      />

      {/* Right pill - Purple (tilted right) */}
      <rect
        x="24"
        y="8"
        width="18"
        height="34"
        rx="9"
        fill="url(#pm-grad-2)"
        opacity="0.85"
        transform="rotate(12 33 25)"
        filter="url(#pm-glow)"
      />

      {/* Center overlap highlight - the "match" point */}
      <ellipse
        cx="24"
        cy="24"
        rx="5"
        ry="8"
        fill="white"
        opacity="0.25"
      />
    </svg>
  );
}
