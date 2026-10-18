/* Motor de audio sintetizado (Web Audio API) para a apresentacao de sorteio.
   Sem arquivos externos: todos os sons sao gerados em tempo real.
   O AudioContext e criado de forma lazy (somente apos gesto do usuario) e
   todos os metodos sao a prova de navegadores sem suporte. */

/** Volume maximo do master gain (moderado, evita sustos). */
const MAX_GAIN = 0.25;

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

export class DrawAudio {
  /** Cria o motor sem tocar nada: o AudioContext so nasce no primeiro gesto. */
  constructor() {
    this.muted = false;
    this.intensity = 0;
  }

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientOsc: OscillatorNode[] = [];
  private noiseBuf: AudioBuffer | null = null;
  private muted = false;
  private intensity = 0;
  private ambientStarted = false;

  /** Cria (ou reutiliza) o AudioContext de forma segura. */
  private ensure(): AudioContext | null {
    if (this.ctx) {
      this.resumeSafe(this.ctx);
      return this.ctx;
    }
    try {
      const w = window as WindowWithWebkit;
      const Ctor = window.AudioContext || w.webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : MAX_GAIN;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.resumeSafe(ctx);
    } catch {
      this.ctx = null;
      this.master = null;
      return null;
    }
    return this.ctx;
  }

  private resumeSafe(ctx: AudioContext): void {
    try {
      if (ctx.state === 'suspended') {
        const p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => undefined);
      }
    } catch {
      /* navegador pode recusar; os sons ficam silentes ate o proximo gesto */
    }
  }

  /** Buffer de ruido branco reutilizado (whoosh, acordes, fanfarra). */
  private noiseBuffer(): AudioBuffer | null {
    const ctx = this.ensure();
    if (!ctx) return null;
    if (!this.noiseBuf) {
      try {
        const len = Math.floor(ctx.sampleRate * 1.5);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
      } catch {
        return null;
      }
    }
    return this.noiseBuf;
  }

  /** Nota simples com envelope curto (usada por varios efeitos). */
  private tone(
    ctx: AudioContext,
    at: number,
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
  ): void {
    if (!this.master) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(at);
      osc.stop(at + dur + 0.05);
    } catch {
      /* ignora falhas isoladas de síntese */
    }
  }

  /** Rajada curta de ruido filtrado (impacto dos acordes). */
  private noiseHit(ctx: AudioContext, at: number, dur: number, vol: number): void {
    const buf = this.noiseBuffer();
    if (!buf || !this.master) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1500, at);
      bp.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(bp);
      bp.connect(gain);
      gain.connect(this.master);
      src.start(at);
      src.stop(at + dur + 0.05);
    } catch {
      /* ignora */
    }
  }

  /** Pad ambiente: 3 osciladores desafinados + lowpass; ganho segue a intensidade. */
  startAmbient(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.ambientStarted) return;
    this.ambientStarted = true;
    try {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 480;
      filter.Q.value = 0.7;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.gain.setTargetAtTime(Math.max(0.0002, this.intensity * 0.9), ctx.currentTime, 0.9);
      filter.connect(gain);
      gain.connect(this.master);
      const freqs = [55, 82.4, 110.6];
      for (const f of freqs) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        osc.detune.value = (Math.random() - 0.5) * 16;
        osc.connect(filter);
        osc.start();
        this.ambientOsc.push(osc);
      }
      this.ambientFilter = filter;
      this.ambientGain = gain;
    } catch {
      this.ambientStarted = false;
    }
  }

  /** 0..1 — controla o volume do pad ambiente e a pressão sonora geral. */
  setIntensity(v: number): void {
    const value = Math.min(1, Math.max(0, v));
    this.intensity = value;
    const ctx = this.ctx;
    if (!ctx || !this.ambientGain) return;
    try {
      this.ambientGain.gain.setTargetAtTime(Math.max(0.0002, value * 0.9), ctx.currentTime, 0.3);
      if (this.ambientFilter) {
        this.ambientFilter.frequency.setTargetAtTime(360 + value * 900, ctx.currentTime, 0.3);
      }
    } catch {
      /* ignora */
    }
  }

  /** Tick curto do reel de nomes. */
  tick(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    this.tone(ctx, t, 1150 + Math.random() * 260, 0.05, 'triangle', 0.5);
  }

  /** Whoosh a cada mudanca de fase / desaceleracao do reel. */
  whoosh(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const buf = this.noiseBuffer();
    if (!buf) return;
    try {
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(220, t);
      bp.frequency.exponentialRampToValueAtTime(2600, t + 0.5);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.7, t + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      src.connect(bp);
      bp.connect(gain);
      gain.connect(this.master);
      src.start(t);
      src.stop(t + 0.65);
    } catch {
      /* ignora */
    }
  }

  /** Bipe da contagem 3-2-1 (final = bipe mais agudo e longo). */
  countdownBeep(final: boolean): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    this.tone(ctx, t, final ? 990 : 660, final ? 0.55 : 0.22, 'sine', final ? 0.9 : 0.65);
    if (final) this.tone(ctx, t, 495, 0.5, 'sine', 0.4);
  }

  /** Carga de energia antes da revelacao (sweep ascendente + tremolo grave). */
  charge(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    try {
      const buf = this.noiseBuffer();
      if (buf) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 2;
        bp.frequency.setValueAtTime(180, t);
        bp.frequency.exponentialRampToValueAtTime(4600, t + 1.5);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.5, t + 1.3);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        src.connect(bp);
        bp.connect(gain);
        gain.connect(this.master);
        src.start(t);
        src.stop(t + 1.65);
      }
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(70, t);
      osc.frequency.exponentialRampToValueAtTime(560, t + 1.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 1.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 1.65);
    } catch {
      /* ignora */
    }
  }

  /** RAIO: estalo eletrico + trovao grave com eco (efeito de trovoa divina). */
  lightning(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const buf = this.noiseBuffer();
    try {
      if (buf) {
        // 1) estalo inicial (zap agudo e rapidissimo)
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'bandpass';
        hp.frequency.setValueAtTime(5400, t);
        hp.frequency.exponentialRampToValueAtTime(750, t + 0.24);
        hp.Q.value = 0.9;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.95, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        src.connect(hp);
        hp.connect(g);
        g.connect(this.master);
        src.start(t);
        src.stop(t + 0.32);

        // 2) trovao: ruido grave, lento, com eco que se dissipa
        const th = ctx.createBufferSource();
        th.buffer = buf;
        th.playbackRate.value = 0.4;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1100, t + 0.05);
        lp.frequency.exponentialRampToValueAtTime(110, t + 2.1);
        lp.Q.value = 0.6;
        const tg = ctx.createGain();
        tg.gain.setValueAtTime(0.0001, t + 0.04);
        tg.gain.exponentialRampToValueAtTime(0.95, t + 0.14);
        tg.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
        th.connect(lp);
        lp.connect(tg);
        tg.connect(this.master);
        th.start(t + 0.04);
        th.stop(t + 2.35);
      }
      // 3) impacto sub + trilha eletrica do raio
      this.tone(ctx, t + 0.02, 58, 0.75, 'sine', 0.95);
      this.tone(ctx, t, 240, 0.16, 'sawtooth', 0.55);
      [1866, 1244, 2093, 1568].forEach((f, i) => {
        this.tone(ctx, t + i * 0.03, f, 0.12, 'square', 0.3);
      });
    } catch {
      /* ignora */
    }
  }

  /** Jingle de vitoria estilo caça-niquel (moedas caindo). */
  coins(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + 0.45;
    try {
      const notes = [1046.5, 1318.5, 1568, 2093, 1568, 2093];
      notes.forEach((f, i) => {
        this.tone(ctx, t + i * 0.085, f, 0.24, 'triangle', 0.55);
        this.tone(ctx, t + i * 0.085, f * 2, 0.16, 'sine', 0.22);
      });
      this.noiseHit(ctx, t, 0.35, 0.3);
    } catch {
      /* ignora */
    }
  }

  /** Acorde de revelacao: triade maior (subindo por ganhador) + ruido. */
  revealChord(index: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const scale = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
    const octave = Math.floor(index / scale.length);
    const root = scale[index % scale.length] * Math.pow(2, Math.min(octave, 2));
    const ratios = [1, 1.25, 1.5];
    ratios.forEach((r, i) => {
      this.tone(ctx, t + i * 0.02, root * r, 1.1, 'triangle', 0.55);
    });
    this.tone(ctx, t, root / 2, 1.25, 'sine', 0.5);
    this.noiseHit(ctx, t, 0.45, 0.35);
  }

  /** Fanfarra final: arpejo ascendente + acorde + ruido. */
  fanfare(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + 0.05;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.tone(ctx, t + i * 0.15, f, 0.28, 'triangle', 0.5);
      this.tone(ctx, t + i * 0.15, f / 2, 0.28, 'sine', 0.3);
    });
    const chordAt = t + notes.length * 0.15;
    for (const f of notes) this.tone(ctx, chordAt, f, 1.4, 'triangle', 0.4);
    this.tone(ctx, chordAt, 130.81, 1.5, 'sine', 0.5);
    this.noiseHit(ctx, chordAt, 0.7, 0.4);
  }

  /** Liga/desliga o som globalmente (fade curto para evitar cliques). */
  setMuted(m: boolean): void {
    this.muted = m;
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    try {
      this.master.gain.setTargetAtTime(m ? 0.0001 : MAX_GAIN, ctx.currentTime, 0.05);
    } catch {
      /* ignora */
    }
  }

  /** Encerra tudo (oscillators, nodes e AudioContext). */
  dispose(): void {
    try {
      for (const osc of this.ambientOsc) {
        try {
          osc.stop();
        } catch {
          /* ja parado */
        }
        try {
          osc.disconnect();
        } catch {
          /* ignora */
        }
      }
    } catch {
      /* ignora */
    }
    this.ambientOsc = [];
    try {
      this.ambientGain?.disconnect();
    } catch {
      /* ignora */
    }
    try {
      this.ambientFilter?.disconnect();
    } catch {
      /* ignora */
    }
    this.ambientGain = null;
    this.ambientFilter = null;
    this.ambientStarted = false;
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    if (ctx) {
      try {
        const p = ctx.close();
        if (p && typeof p.catch === 'function') p.catch(() => undefined);
      } catch {
        /* ignora */
      }
    }
  }
}
