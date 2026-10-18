interface LogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

/**
 * Marca do Gorjeta 77 Lukas: medalhao dourado com "77" e troféu estilizado.
 * Vetorial (SVG), sem imagens externas — carrega rapido em qualquer dispositivo.
 */
export default function Logo({ size = 64, animate = false, className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Gorjeta 77 Lukas"
      style={animate ? { animation: 'logo-enter 1.1s cubic-bezier(0.2, 0.9, 0.2, 1) both' } : undefined}
    >
      <defs>
        <linearGradient id="gj-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd9dd" />
          <stop offset="45%" stopColor="#ff2d3f" />
          <stop offset="100%" stopColor="#7d0b16" />
        </linearGradient>
        <radialGradient id="gj-core" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#2a0510" />
          <stop offset="100%" stopColor="#0a0305" />
        </radialGradient>
        <filter id="gj-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* aura */}
      <circle cx="60" cy="60" r="56" fill="none" stroke="url(#gj-gold)" strokeWidth="1.4" opacity="0.55" />

      {/* medalhao */}
      <circle cx="60" cy="60" r="46" fill="url(#gj-core)" stroke="url(#gj-gold)" strokeWidth="3.4" filter="url(#gj-glow)" />

      {/* raios internos */}
      <g opacity="0.5" stroke="url(#gj-gold)" strokeWidth="1">
        <line x1="60" y1="20" x2="60" y2="30" />
        <line x1="60" y1="90" x2="60" y2="100" />
        <line x1="20" y1="60" x2="30" y2="60" />
        <line x1="90" y1="60" x2="100" y2="60" />
      </g>

      {/* trofeu estilizado */}
      <g filter="url(#gj-glow)">
        <path
          d="M49 40h22v9a11 11 0 0 1-22 0z"
          fill="none"
          stroke="url(#gj-gold)"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <path d="M49 42h-7a7 7 0 0 0 7 7M71 42h7a7 7 0 0 1-7 7" fill="none" stroke="url(#gj-gold)" strokeWidth="2.2" />
        <line x1="60" y1="60" x2="60" y2="70" stroke="url(#gj-gold)" strokeWidth="2.6" />
        <path d="M50 74h20l-3-4H53z" fill="url(#gj-gold)" />
      </g>

      {/* "77" dourado */}
      <text
        x="60"
        y="93"
        textAnchor="middle"
        fontFamily="Cinzel, serif"
        fontWeight="900"
        fontSize="26"
        fill="url(#gj-gold)"
        filter="url(#gj-glow)"
      >
        77
      </text>
    </svg>
  );
}
