import { useEffect, useMemo, useRef, useState } from 'react';
import type { Draw, DrawStyle, PoolEntry } from '../lib/types';
import { DrawAudio } from '../lib/audio';
import { formatDate } from '../lib/format';
import Logo from './Logo';
import Particles from './Particles';
import OlympusCast from './OlympusCast';
import '../styles/drawshow.css';

/* Apresentacao cinematografica do sorteio (tela cheia, para projetor).
   O resultado final vem do backend; aqui apenas exibimos na ordem de `position`. */

type Phase = 'intro' | 'reel' | 'countdown' | 'reveal' | 'final';

interface Timeline {
  introEnd: number;
  reelEnd: number;
  countEnd: number;
  revealEnd: number;
}

/** Suspense antes do primeiro ganhador ("E O GANHADOR É..."). */
const REVEAL_LEAD_MS = 2000;
/** Tempo de cada ganhador na tela. */
const REVEAL_STEP_MS = 3500;
/** Garantia minima da fase de revelacao: ~6s + 3,5s por ganhador. */
const revealMin = (n: number) => 6000 + 3500 * n;

const CONFETTI_COLORS: Record<DrawStyle, string[]> = {
  classic: ['#ff2d3f', '#ffd9dd', '#ffffff', '#8b0f1a'],
  neon: ['#ff3b5c', '#ff9ad5', '#ffffff', '#b3126a'],
  gala: ['#ff6a3d', '#ffe4d1', '#ffffff', '#a3260f'],
};

function buildTimeline(durationSeconds: number, winnerCount: number): Timeline {
  const n = Math.max(1, winnerCount);
  const revealDur = REVEAL_LEAD_MS + REVEAL_STEP_MS * n;
  let intro = 4500;
  let countdown = 3200;
  const minReel = 4000;
  // o show nunca dura menos que o minimo necessario para revelar com folga
  const total = Math.max(durationSeconds * 1000, revealMin(n) + 3200 + 2400 + minReel);
  let reel = total - intro - countdown - revealDur;
  if (reel < minReel) {
    const deficit = minReel - reel;
    intro = Math.max(3200, intro - deficit * 0.6);
    countdown = Math.max(2400, countdown - deficit * 0.4);
    reel = total - intro - countdown - revealDur;
    if (reel < 0) reel = 0;
  }
  const introEnd = intro;
  const reelEnd = introEnd + reel;
  const countEnd = reelEnd + countdown;
  const revealEnd = countEnd + revealDur;
  return { introEnd, reelEnd, countEnd, revealEnd };
}

interface ConfettiPiece {
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  rot: number;
}

export default function DrawShow({ draw, onExit }: { draw: Draw; onExit: () => void }) {
  const winners = useMemo(
    () => [...draw.winners].sort((a, b) => a.position - b.position),
    [draw.winners],
  );

  /* Pool visual para o reel. Se o backend nao enviou, repetimos os ganhadores
     apenas para manter o efeito (o resultado em si nunca e alterado). */
  const pool = useMemo<PoolEntry[]>(() => {
    const source = draw.visualPool;
    if (source && source.length > 0) return source;
    if (winners.length === 0) return [];
    const entries: PoolEntry[] = [];
    const reps = Math.max(24, winners.length * 8);
    for (let i = 0; i < reps; i += 1) {
      const w = winners[i % winners.length];
      entries.push({ name: w.name, externalId: w.externalId ?? '', isWinner: true });
    }
    // embaralha apenas o pool decorativo (nunca os ganhadores)
    for (let i = entries.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = entries[i];
      entries[i] = entries[j];
      entries[j] = tmp;
    }
    return entries;
  }, [draw.visualPool, winners]);

  const timeline = useMemo(
    () => buildTimeline(draw.durationSeconds, winners.length),
    [draw.durationSeconds, winners.length],
  );

  const confetti = useMemo<ConfettiPiece[]>(() => {
    const colors = CONFETTI_COLORS[draw.style];
    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < 70; i += 1) {
      pieces.push({
        left: Math.random() * 100,
        delay: Math.random() * 1.6,
        duration: 2.6 + Math.random() * 2.4,
        size: 5 + Math.random() * 7,
        color: colors[i % colors.length],
        rot: Math.random() * 360,
      });
    }
    return pieces;
  }, [draw.style]);

  const reduced = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const [phase, setPhase] = useState<Phase>('intro');
  const [reelIdx, setReelIdx] = useState(0);
  const [countdownNum, setCountdownNum] = useState(3);
  const [winnerIdx, setWinnerIdx] = useState(-1);
  const [particleIntensity, setParticleIntensity] = useState(0.35);
  const [flashKey, setFlashKey] = useState(0);
  const [softFlash, setSoftFlash] = useState(0);
  const [strikeKey, setStrikeKey] = useState(0);
  const [strikeShake, setStrikeShake] = useState(false);
  const [muted, setMuted] = useState(!draw.soundEnabled);

  const audioRef = useRef<DrawAudio | null>(null);
  const elapsedRef = useRef(0);
  const phaseRef = useRef<Phase>('intro');
  const reelIdxRef = useRef(0);
  const countNumRef = useRef(3);
  const winnerIdxRef = useRef(-1);
  const intensityQRef = useRef(-1);
  const mutedRef = useRef(muted);
  const fsHeldRef = useRef(false);
  const fsPendingRef = useRef(false);
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const reelNameRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
    audioRef.current?.setMuted(muted);
  }, [muted]);

  /* tremor de tela no instante do impacto do raio (desligado no reduced-motion) */
  useEffect(() => {
    if (strikeKey === 0 || reduced) return undefined;
    setStrikeShake(true);
    const id = window.setTimeout(() => setStrikeShake(false), 650);
    return () => window.clearTimeout(id);
  }, [strikeKey, reduced]);

  /* reinicia o show se trocarem de sorteio com o overlay aberto */
  useEffect(() => {
    elapsedRef.current = 0;
    phaseRef.current = 'intro';
    reelIdxRef.current = 0;
    countNumRef.current = 3;
    winnerIdxRef.current = -1;
    setPhase('intro');
    setReelIdx(0);
    setCountdownNum(3);
    setWinnerIdx(-1);
    setStrikeKey(0);
    setFlashKey((k) => k + 1);
  }, [draw.id]);

  /* ---------- ciclo de vida: audio, fullscreen e atalhos ---------- */
  useEffect(() => {
    const wakeAudio = () => {
      if (!audioRef.current) audioRef.current = new DrawAudio();
      audioRef.current.startAmbient();
      audioRef.current.setMuted(mutedRef.current);
      audioRef.current.setIntensity(0.3);
    };
    const tryFullscreen = () => {
      if (fsHeldRef.current || fsPendingRef.current) return;
      fsPendingRef.current = true;
      try {
        const el = document.documentElement;
        if (!document.fullscreenElement && typeof el.requestFullscreen === 'function') {
          const p = el.requestFullscreen();
          if (p) {
            p.then(() => {
              fsHeldRef.current = true;
              fsPendingRef.current = false;
            }).catch(() => {
              fsPendingRef.current = false; // permite nova tentativa no proximo gesto
            });
          } else {
            fsPendingRef.current = false;
          }
        } else {
          fsPendingRef.current = false;
        }
      } catch {
        /* navegador pode bloquear; segue em janela normal */
        fsPendingRef.current = false;
      }
    };
    // fullscreen tenta tambem na montagem (falha silenciosa sem gesto)
    tryFullscreen();
    const onGesture = () => {
      tryFullscreen();
      wakeAudio();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExitRef.current();
        return;
      }
      wakeAudio();
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onKey);
      audioRef.current?.dispose();
      audioRef.current = null;
      if (fsHeldRef.current && document.fullscreenElement) {
        try {
          const p = document.exitFullscreen();
          if (p) p.catch(() => undefined);
        } catch {
          /* ignora */
        }
      }
    };
  }, []);

  /* ---------- loop unico de animacao ---------- */
  useEffect(() => {
    let raf = 0;
    let running = true;
    let last = performance.now();
    let nextReel = timeline.introEnd;
    let nextFlash = 2400;

    const loop = (now: number) => {
      const dt = Math.min(120, now - last);
      last = now;
      elapsedRef.current += dt;
      const t = elapsedRef.current;
      const audio = audioRef.current;

      // fase atual
      let phase: Phase = 'final';
      if (t < timeline.introEnd) phase = 'intro';
      else if (t < timeline.reelEnd) phase = 'reel';
      else if (t < timeline.countEnd) phase = 'countdown';
      else if (t < timeline.revealEnd) phase = 'reveal';

      if (phase !== phaseRef.current) {
        phaseRef.current = phase;
        setPhase(phase);
        if (phase === 'reel') {
          nextReel = t;
          audio?.whoosh();
        }
        if (phase === 'countdown') {
          countNumRef.current = 3;
          setCountdownNum(3);
          audio?.countdownBeep(false);
        }
        if (phase === 'reveal') {
          audio?.charge(); // carregamento de energia antes do raio
        }
        if (phase === 'final') {
          audio?.fanfare();
        }
      }

      let targetIntensity = 0.4;

      if (phase === 'reel') {
        const span = Math.max(1, timeline.reelEnd - timeline.introEnd);
        const p = Math.min(1, Math.max(0, (t - timeline.introEnd) / span));
        const eased = p * p * p;
        const interval = 70 + (700 - 70) * eased; // desacelera do reel
        if (t >= nextReel) {
          nextReel = t + interval;
          reelIdxRef.current += 1;
          setReelIdx(reelIdxRef.current);
          audio?.tick();
        }
        const blur = reduced ? 0 : (1 - eased) * 5;
        reelNameRef.current?.style.setProperty('--ds-blur', `${blur.toFixed(2)}px`);
        // tremor de tela sutil proporcional a velocidade
        if (stageRef.current) {
          if (reduced) {
            stageRef.current.style.transform = '';
          } else {
            const amp = (1 - eased) * 2.2;
            stageRef.current.style.transform = `translate3d(${((Math.random() - 0.5) * amp).toFixed(2)}px, ${((Math.random() - 0.5) * amp).toFixed(2)}px, 0)`;
          }
        }
        targetIntensity = 0.35 + eased * 0.6;
        // flashes de luz ocasionais durante a suspense (desligados com reduced-motion)
        if (!reduced && t >= nextFlash) {
          nextFlash = t + 1800 + Math.random() * 2600;
          setSoftFlash((k) => k + 1);
        }
      } else if (stageRef.current && stageRef.current.style.transform) {
        stageRef.current.style.transform = '';
      }

      if (phase === 'countdown') {
        const step = (timeline.countEnd - timeline.reelEnd) / 3;
        const num = 3 - Math.min(2, Math.floor((t - timeline.reelEnd) / step));
        if (num !== countNumRef.current) {
          countNumRef.current = num;
          setCountdownNum(num);
          setFlashKey((k) => k + 1);
          audio?.countdownBeep(num === 1);
        }
        // luzes "dimming" no ultimo instante antes da revelacao
        targetIntensity = Math.max(0.08, 0.5 - (t - timeline.reelEnd) / (timeline.countEnd - timeline.reelEnd) * 0.42);
      }

      if (phase === 'reveal') {
        targetIntensity = 1;
        const tp = t - timeline.countEnd;
        if (tp >= REVEAL_LEAD_MS) {
          const idx = Math.min(winners.length - 1, Math.floor((tp - REVEAL_LEAD_MS) / REVEAL_STEP_MS));
          if (idx !== winnerIdxRef.current) {
            winnerIdxRef.current = idx;
            setWinnerIdx(idx);
            setStrikeKey((k) => k + 1);
            setFlashKey((k) => k + 1);
            audio?.lightning(); // trovao do raio
            audio?.revealChord(idx);
            audio?.coins(); // jingle de vitoria (com delay proprio)
          }
        }
      }

      if (phase === 'final' && phaseRef.current === 'final' && winnerIdxRef.current < winners.length - 1) {
        // chegou ao final por pulo/encerramento: garante o ultimo estado
        winnerIdxRef.current = winners.length - 1;
        setWinnerIdx(winners.length - 1);
      }
      if (phase === 'final') targetIntensity = 0.5;

      // intensidade quantizada (evita re-render a cada frame)
      const q = Math.round(targetIntensity * 20) / 20;
      if (q !== intensityQRef.current) {
        intensityQRef.current = q;
        audio?.setIntensity(q);
        setParticleIntensity(q);
      }

      progressRef.current?.style.setProperty(
        '--ds-progress',
        String(Math.min(1, t / Math.max(1, timeline.revealEnd))),
      );

      if (running) raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [timeline, winners.length, reduced]);

  const current = pool[reelIdx % pool.length];
  const winner = winnerIdx >= 0 ? winners[Math.min(winnerIdx, winners.length - 1)] : null;
  const announcement = winner ? `Ganhador revelado: ${winner.name}, ${winner.position}º lugar.` : '';

  const marqueeNames = useMemo(() => {
    const unique: string[] = [];
    for (const entry of pool) {
      if (!unique.includes(entry.name)) unique.push(entry.name);
      if (unique.length >= 24) break;
    }
    return unique;
  }, [pool]);

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    if (!next && !audioRef.current) {
      audioRef.current = new DrawAudio();
      audioRef.current.startAmbient();
    }
    audioRef.current?.setMuted(next);
  };

  const skip = () => {
    if (phaseRef.current === 'final') return;
    elapsedRef.current = timeline.revealEnd;
    if (winnerIdxRef.current !== winners.length - 1) {
      winnerIdxRef.current = winners.length - 1;
      setWinnerIdx(winners.length - 1);
    }
  };

  if (winners.length === 0) return null;

  const marquee = (extra: string) => (
    <div className={`ds-marquee ${extra}`} aria-hidden="true">
      <div className="ds-marquee-track">
        {[...marqueeNames, ...marqueeNames].map((name, i) => (
          <span className="ds-marquee-item" key={`${extra}-${i}`}>{name}</span>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className={`ds-root ds-theme-${draw.style}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Apresentação do sorteio ${draw.name}`}
    >
      <Particles
        className="ds-particles"
        density={1.2}
        intensity={particleIntensity}
        respectReducedMotion={reduced}
      />
      <div className="ds-sweep" aria-hidden="true" />
      <div className="ds-vignette" aria-hidden="true" />

      {/* figura do trovao: ergue a mao e lanca o raio em cada ganhador */}
      <OlympusCast active={phase === 'reveal'} strikeKey={strikeKey} reduced={reduced} />

      <div
        className={`ds-stage${strikeShake ? ' ds-stage-shake' : ''}`}
        ref={stageRef}
      >
        {phase === 'intro' && (
          <section className="ds-intro">
            <Logo size={140} animate />
            <h1 className="ds-intro-title">{draw.name}</h1>
            <p className="ds-kicker">PREPARE-SE</p>
            <p className="ds-sub">O SORTEIO VAI COMEÇAR</p>
          </section>
        )}

        {phase === 'reel' && current && (
          <section className="ds-reel">
            {marquee('ds-marquee-left')}
            <div className="ds-reel-center" ref={reelNameRef}>
              <p className="ds-reel-label">SORTEANDO</p>
              <div className="ds-reel-name">{current.name}</div>
              {current.externalId ? <div className="ds-reel-id">{current.externalId}</div> : null}
              <div className="ds-digital" aria-hidden="true">
                <span className="ds-digital-dot" />
                <span className="ds-digital-text">
                  PARTICIPANTES {String(pool.length).padStart(3, '0')} · CANAL SEGURO
                </span>
                <span className="ds-digital-dot" />
              </div>
            </div>
            {marquee('ds-marquee-right')}
          </section>
        )}

        {phase === 'countdown' && (
          <section className="ds-count">
            <p className="ds-count-label">A CONTAGEM COMEÇA EM</p>
            <div className="ds-count-num" key={`c-${countdownNum}`}>{countdownNum}</div>
          </section>
        )}

        {phase === 'reveal' && (
          <section className="ds-reveal">
            {!winner ? (
              <p className="ds-suspense">E O GANHADOR É…</p>
            ) : (
              <div className="ds-winner" key={`w-${winnerIdx}`} data-oly-target="true">
                <p className="ds-winner-kicker">GANHADOR {winner.position}º LUGAR</p>
                <div className="ds-winner-name">{winner.name}</div>
                {winner.externalId ? <div className="ds-winner-id">{winner.externalId}</div> : null}
                <div className="ds-confetti" aria-hidden="true">
                  {confetti.map((piece, i) => (
                    <span
                      key={i}
                      className="ds-confetti-piece"
                      style={{
                        left: `${piece.left}%`,
                        width: piece.size,
                        height: piece.size * 1.6,
                        background: piece.color,
                        animationDelay: `${piece.delay}s`,
                        animationDuration: `${piece.duration}s`,
                        transform: `rotate(${piece.rot}deg)`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {phase === 'final' && (
          <section className="ds-final">
            <Logo size={96} />
            <p className="ds-final-kicker">PARABÉNS</p>
            <h2 className="ds-final-title">{draw.name}</h2>
            <p className="ds-final-date">{formatDate(draw.executedAt ?? draw.createdAtIso)}</p>
            <div className="ds-final-grid">
              {winners.map((w) => (
                <article className="ds-win-card" key={w.id ?? `${w.position}-${w.name}`}>
                  <span className="ds-win-pos">{w.position}º LUGAR</span>
                  <span className="ds-win-name">{w.name}</span>
                  {w.externalId ? <span className="ds-win-id">{w.externalId}</span> : null}
                </article>
              ))}
            </div>
            <div className="ds-final-actions">
              <button type="button" className="btn btn-gold" onClick={onExit}>
                Voltar ao painel
              </button>
              {draw.publicResults && (
                <a
                  className="btn btn-ghost"
                  href={`/sorteio/${draw.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver resultado público
                </a>
              )}
            </div>
            <div className="ds-confetti ds-confetti-final" aria-hidden="true">
              {confetti.map((piece, i) => (
                <span
                  key={i}
                  className="ds-confetti-piece"
                  style={{
                    left: `${piece.left}%`,
                    width: piece.size,
                    height: piece.size * 1.6,
                    background: piece.color,
                    animationDelay: `${piece.delay}s`,
                    animationDuration: `${piece.duration}s`,
                    transform: `rotate(${piece.rot}deg)`,
                  }}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* flash de luz a cada evento marcante (desligado no CSS com reduced-motion) */}
      {flashKey > 0 && !reduced && <div className="ds-flash" key={flashKey} aria-hidden="true" />}
      {softFlash > 0 && !reduced && (
        <div className="ds-flash ds-flash-soft" key={softFlash} aria-hidden="true" />
      )}

      <div className="ds-progress" aria-hidden="true">
        <div className="ds-progress-fill" ref={progressRef} />
      </div>

      <div className="ds-controls">
        <button type="button" className="btn btn-ghost btn-sm" onClick={toggleSound}>
          {muted ? '🔇 Mudo' : '🔊 Som'}
        </button>
        {phase !== 'final' && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={skip}>
            Pular animação
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onExit}>
          Sair
        </button>
      </div>

      <div className="ds-live" aria-live="polite" role="status">{announcement}</div>
    </div>
  );
}
