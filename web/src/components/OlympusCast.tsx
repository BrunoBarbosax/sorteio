import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import '../styles/olympus.css';

/* Figura de trovoa: um deus do trovao original (SVG proprio, obra autoral)
   que ergue a mao e desfere um raio contra o ganhador a cada revelacao.
   O alvo do raio e o proprio elemento do ganhador na tela ([data-oly-target]). */

interface Props {
  /** A fase de revelacao esta ativa (figura visivel, braco erguido). */
  active: boolean;
  /** Incrementado a cada ganhador: remonta o raio e reinicia as animacoes. */
  strikeKey: number;
  /** Sem flash/tremor quando o usuario prefere menos movimento. */
  reduced: boolean;
}

interface BoltPath {
  main: string;
  branches: string[];
}

/** Gera um caminho serrilhado (com ramos) entre dois pontos em pixels. */
function jaggedPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
): BoltPath {
  const segs = 10;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const rand = (() => {
    let s = seed * 9301 + 49297;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  })();

  // zigue-zague tipico do raio: segmentos alternando de lado, com variacao caotica
  const pts: string[] = [`${x1.toFixed(1)},${y1.toFixed(1)}`];
  let lastSide = rand() < 0.5 ? 1 : -1;
  for (let i = 1; i < segs; i += 1) {
    const p = i / segs;
    // 18% de chance de "quebrar" o padrao (mesmo lado duas vezes)
    if (rand() > 0.18) lastSide = -lastSide;
    const strength = 20 + rand() * rand() * 200; // caotico: poucos picos altos
    const amp = lastSide * strength * Math.pow(Math.sin(Math.PI * p), 0.55);
    pts.push(
      `${(x1 + dx * p + nx * amp).toFixed(1)},${(y1 + dy * p + ny * amp).toFixed(1)}`,
    );
  }
  pts.push(`${x2.toFixed(1)},${y2.toFixed(1)}`);

  // ramos secundarios saindo do tronco principal
  const branches: string[] = [];
  for (const bp0 of [0.34, 0.62]) {
    const bp = bp0 + rand() * 0.08;
    const bx = x1 + dx * bp;
    const by = y1 + dy * bp;
    const side = rand() < 0.5 ? 1 : -1;
    const spread = 70 + rand() * 60;
    branches.push(
      [
        `${bx.toFixed(1)},${by.toFixed(1)}`,
        `${(bx + nx * side * spread * 0.5 + dx * 0.05).toFixed(1)},${(by + ny * side * spread * 0.5 + dy * 0.05).toFixed(1)}`,
        `${(bx + nx * side * spread * 0.34 - dx * 0.02).toFixed(1)},${(by + ny * side * spread * 0.34 - dy * 0.02).toFixed(1)}`,
        `${(bx + nx * side * spread + dx * 0.1).toFixed(1)},${(by + ny * side * spread + dy * 0.1).toFixed(1)}`,
      ].join(' '),
    );
  }

  return { main: pts.join(' '), branches };
}

export default function OlympusCast({ active, strikeKey, reduced }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<SVGCircleElement>(null);
  const [bolt, setBolt] = useState<BoltPath | null>(null);
  const [aim, setAim] = useState({ x: 50, y: 45 });
  const [embers, setEmbers] = useState<
    { id: number; left: number; top: number; delay: number; ex: number; size: number }[]
  >([]);

  const compute = useCallback(() => {
    const root = rootRef.current;
    const hand = handRef.current;
    if (!root || !hand) return;
    const r = root.getBoundingClientRect();
    const h = hand.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;

    const x1 = h.left + h.width / 2 - r.left;
    const y1 = h.top + h.height / 2 - r.top;

    const targetEl = root.querySelector('[data-oly-target]');
    const tr = targetEl?.getBoundingClientRect();
    const x2 = tr ? tr.left + tr.width / 2 - r.left : r.width * 0.5;
    const y2 = tr ? tr.top + tr.height / 2 - r.top : r.height * 0.45;

    setBolt(jaggedPath(x1, y1, x2, y2, strikeKey + 7));
    setAim({
      x: Math.min(96, Math.max(4, (x2 / r.width) * 100)),
      y: Math.min(96, Math.max(4, (y2 / r.height) * 100)),
    });
    setEmbers(
      Array.from({ length: 14 }, (_, i) => {
        const s = Math.sin((strikeKey + 1) * (i + 3)) * 43758.5453;
        const rnd = s - Math.floor(s);
        const s2 = Math.cos((strikeKey + 2) * (i + 5)) * 12345.678;
        const rnd2 = s2 - Math.floor(s2);
        return {
          id: i,
          left: x2 + (rnd - 0.5) * 90,
          top: y2 + (rnd2 - 0.5) * 40,
          delay: rnd * 0.5,
          ex: (rnd2 - 0.5) * 70,
          size: 3 + rnd * 5,
        };
      }),
    );
  }, [strikeKey]);

  // recalcula o alvo quando a figura entra ou quando chega um novo ganhador
  useLayoutEffect(() => {
    if (active) compute();
  }, [active, strikeKey, compute]);

  useEffect(() => {
    if (!active) return undefined;
    const onResize = () => compute();
    window.addEventListener('resize', onResize);
    const id = window.setTimeout(compute, 900); // apos as animacoes do ganhador assentarem
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(id);
    };
  }, [active, compute]);

  const striking = active && strikeKey > 0 && bolt !== null;

  return (
    <div
      ref={rootRef}
      className={`oly ${active ? 'oly-active' : ''}`}
      aria-hidden="true"
    >
      <svg className="oly-fig" viewBox="0 0 300 420" role="presentation">
        <defs>
          <linearGradient id="oly-robe" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#33060f" />
            <stop offset="60%" stopColor="#14030a" />
            <stop offset="100%" stopColor="#080205" />
          </linearGradient>
          <linearGradient id="oly-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffd9dd" />
            <stop offset="55%" stopColor="#ff2d3f" />
            <stop offset="100%" stopColor="#7d0b16" />
          </linearGradient>
        </defs>

        {/* manto / corpo */}
        <path
          d="M150 118 C 208 128, 236 212, 248 420 L 52 420 C 64 212, 92 128, 150 118 Z"
          fill="url(#oly-robe)"
          stroke="url(#oly-rim)"
          strokeWidth="3"
        />
        {/* dobras do manto */}
        <path
          d="M118 210 C 112 280, 108 350, 106 420 M150 200 L150 420 M182 210 C 188 280, 192 350, 194 420"
          fill="none"
          stroke="rgba(255, 45, 63, 0.35)"
          strokeWidth="2"
        />
        {/* barba */}
        <path
          d="M116 92 C 108 152, 126 192, 150 204 C 174 192, 192 152, 184 92 Z"
          fill="#0f0308"
          stroke="url(#oly-rim)"
          strokeWidth="2.4"
        />
        {/* cabeca */}
        <circle cx="150" cy="82" r="35" fill="#0f0308" stroke="url(#oly-rim)" strokeWidth="3" />
        {/* coroa de raios */}
        <path
          d="M110 58 L118 26 L131 52 L150 18 L169 52 L182 26 L190 58 Z"
          fill="#ff2d3f"
          opacity="0.92"
        />
        <path
          d="M110 58 L118 26 L131 52 L150 18 L169 52 L182 26 L190 58 Z"
          fill="none"
          stroke="#ffd9dd"
          strokeWidth="1.6"
        />
        {/* olhos */}
        <g className="oly-eyes">
          <rect x="132" y="76" width="13" height="4.5" rx="2.2" fill="#fff0f2" />
          <rect x="155" y="76" width="13" height="4.5" rx="2.2" fill="#fff0f2" />
        </g>
        {/* ombro */}
        <circle cx="190" cy="168" r="20" fill="#12040a" stroke="url(#oly-rim)" strokeWidth="2.6" />

        {/* braco com mao erguida */}
        <g className="oly-arm">
          <path
            d="M190 168 C 226 154, 252 118, 262 76"
            fill="none"
            stroke="url(#oly-robe)"
            strokeWidth="28"
            strokeLinecap="round"
          />
          <path
            d="M190 168 C 226 154, 252 118, 262 76"
            fill="none"
            stroke="url(#oly-rim)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* palma + energia */}
          <circle
            ref={handRef}
            cx="264"
            cy="66"
            r="17"
            fill="#12040a"
            stroke="url(#oly-rim)"
            strokeWidth="3"
          />
          <circle className="oly-palm-glow" cx="264" cy="66" r="15" fill="rgba(255,45,63,0.55)" />
          <circle className="oly-palm" cx="264" cy="66" r="7" fill="#ffffff" />
        </g>
      </svg>

      {striking && (
        <svg className="oly-bolt" key={`bolt-${strikeKey}`}>
          <polyline className="oly-bolt-glow" points={bolt.main} />
          {bolt.branches.map((b, i) => (
            <polyline className="oly-bolt-branch" points={b} key={`br-${i}`} />
          ))}
          <polyline className="oly-bolt-core" points={bolt.main} />
        </svg>
      )}

      {striking && !reduced && (
        <div
          className="oly-flash"
          key={`flash-${strikeKey}`}
          style={
            {
              '--fx': `${aim.x}%`,
              '--fy': `${aim.y}%`,
            } as CSSProperties
          }
        />
      )}

      {striking && !reduced && (
        <div className="oly-embers" key={`embers-${strikeKey}`}>
          {embers.map((e) => (
            <span
              key={e.id}
              className="oly-ember"
              style={
                {
                  left: `${e.left}px`,
                  top: `${e.top}px`,
                  width: e.size,
                  height: e.size,
                  animationDelay: `${e.delay}s`,
                  '--ex': `${e.ex}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
