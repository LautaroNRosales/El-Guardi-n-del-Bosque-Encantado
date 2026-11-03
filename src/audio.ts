// Audio procedural (WebAudio): sin assets externos.

class AudioEngine {
  private ctx: AudioContext | null = null;
  muted = false;

  /** Llamar tras el primer gesto del usuario (política de autoplay). */
  ensure(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gain = 0.08,
    when = 0,
    slideTo?: number,
  ): void {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  private noise(duration: number, gain = 0.05, when = 0, lowpass = 1200): void {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(g).connect(this.ctx.destination);
    src.start(t0);
  }

  /** Paso suave del espíritu (más marcado si corre). */
  step(running: boolean): void {
    this.noise(0.06, running ? 0.07 : 0.03, 0, running ? 900 : 1600);
  }

  /** Campana al activar un altar. */
  altarChime(): void {
    this.tone(660, 1.2, 'sine', 0.10);
    this.tone(990, 1.5, 'sine', 0.07, 0.12);
    this.tone(1320, 1.8, 'triangle', 0.05, 0.24);
  }

  /** Sting disonante al pasar a Alerta. */
  alertSting(): void {
    this.tone(220, 0.35, 'sawtooth', 0.06);
    this.tone(311, 0.4, 'sawtooth', 0.06, 0.02); // tritóno
  }

  /** Confirmación: el guardián te vio (pasa a Persecución). */
  chaseSting(): void {
    this.tone(180, 0.5, 'square', 0.07, 0, 90);
  }

  /** Acorde suave al abrirse el portal. */
  portalHum(): void {
    this.tone(196, 2.4, 'sine', 0.09);
    this.tone(392, 2.4, 'sine', 0.06, 0.1);
    this.tone(588, 2.6, 'triangle', 0.05, 0.2);
  }

  /** Acorde mayor de victoria. */
  victory(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.9, 'sine', 0.09, i * 0.16));
  }

  /** Cluster menor de derrota. */
  defeat(): void {
    this.tone(98, 1.6, 'sawtooth', 0.08);
    this.tone(104, 1.6, 'sawtooth', 0.06);
    this.tone(147, 1.4, 'triangle', 0.05, 0.15);
  }

  /** Susurro al esconderse / salir del arbusto. */
  rustle(): void {
    this.noise(0.18, 0.05, 0, 700);
  }
}

export const audio = new AudioEngine();
