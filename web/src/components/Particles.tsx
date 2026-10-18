import { useEffect, useRef } from 'react';

interface ParticlesProps {
  /** quantidade relativa de particulas (1 = padrao) */
  density?: number;
  /** 0..1 - intensidade dos brilhos e feixes de luz */
  intensity?: number;
  className?: string;
  /** desliga tudo quando o usuario prefere reduzir movimentos */
  respectReducedMotion?: boolean;
}

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
  hue: number;
}

interface Beam {
  x: number;
  width: number;
  speed: number;
  alpha: number;
}

/**
 * Fundo cinematografico: particulas luminosas e feixes de luz em Canvas,
 * acelerado por GPU (transform/fill apenas), pausado quando a aba oculta
 * e respeitando `prefers-reduced-motion`.
 */
export default function Particles({
  density = 1,
  intensity = 0.7,
  className,
  respectReducedMotion = true,
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef(intensity);

  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced =
      respectReducedMotion && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    const particles: Particle[] = [];
    const beams: Beam[] = [];

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.round(Math.min(140, Math.max(30, (width * height) / 12000)) * density);
      particles.length = 0;
      for (let i = 0; i < target; i += 1) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 2.2 + 0.5,
          vx: (Math.random() - 0.5) * 0.22,
          vy: -(Math.random() * 0.28 + 0.05),
          a: Math.random() * 0.6 + 0.2,
          // 355 = vermelho vivo | 20 = brasa/laranja
          hue: Math.random() < 0.6 ? 355 : 20,
        });
      }

      beams.length = 0;
      const beamCount = 4;
      for (let i = 0; i < beamCount; i += 1) {
        beams.push({
          x: Math.random() * width,
          width: Math.random() * 120 + 60,
          speed: (Math.random() * 0.25 + 0.08) * (Math.random() < 0.5 ? -1 : 1),
          alpha: Math.random() * 0.08 + 0.03,
        });
      }
    };

    build();
    const observer = new ResizeObserver(build);
    observer.observe(canvas);

    let frame = 0;
    let raf = 0;
    let running = true;

    const draw = () => {
      const power = intensityRef.current;
      ctx.clearRect(0, 0, width, height);

      // feixes de luz
      for (const beam of beams) {
        beam.x += beam.speed * (reduced ? 0.3 : 1);
        if (beam.x > width + beam.width) beam.x = -beam.width;
        if (beam.x < -beam.width) beam.x = width + beam.width;
        const gradient = ctx.createLinearGradient(beam.x - beam.width / 2, 0, beam.x + beam.width / 2, 0);
        gradient.addColorStop(0, 'rgba(255,45,63,0)');
        gradient.addColorStop(0.5, `rgba(255,45,63,${(beam.alpha * (0.5 + power)).toFixed(4)})`);
        gradient.addColorStop(1, 'rgba(255,45,63,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(beam.x - beam.width / 2, 0, beam.width, height);
      }

      // particulas
      for (const p of particles) {
        if (!reduced) {
          p.x += p.vx * (0.6 + power);
          p.y += p.vy * (0.6 + power);
        }
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const flicker = reduced ? 1 : 0.75 + Math.sin((frame + p.x) / 40) * 0.25;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.8 + power * 0.5), 0, Math.PI * 2);
        ctx.fillStyle =
          p.hue === 355
            ? `rgba(255,90,110,${(p.a * flicker * (0.5 + power * 0.6)).toFixed(3)})`
            : `rgba(255,150,90,${(p.a * flicker * 0.5).toFixed(3)})`;
        ctx.fill();
      }

      frame += 1;
      if (running) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [density, respectReducedMotion]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" style={canvasStyle} />;
}

const canvasStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
};
