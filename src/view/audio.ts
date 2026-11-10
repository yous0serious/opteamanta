// Prozeduraler Sound 1:1 aus dem Original (Zeilen 100–117), an Sim-Events gebunden.
import type { Controller } from './controller';
import type { SimEvent } from '../sim/index';

type Wave = OscillatorType;

export class SoundEngine {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private last: Record<string, number> = {};
  private musicTimer: number | null = null;
  muted = false;

  constructor(private readonly ctl: Controller) {}

  get started(): boolean {
    return this.ac !== null;
  }

  /** Erst nach einer Nutzergeste starten (Autoplay-Regeln der Browser). */
  start(): void {
    if (this.ac) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ac = new Ctx();
    this.master = this.ac.createGain();
    this.master.gain.value = 0.25;
    this.master.connect(this.ac.destination);
    this.music();
  }

  toggleMute(): void {
    this.start();
    this.muted = !this.muted;
  }

  beep(f: number, d: number, type: Wave = 'square', v = 0.15, slide = 0, key?: string): void {
    const ac = this.ac;
    if (!ac || !this.master || this.muted) return;
    if (key && this.throttled(key, 70)) return;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + d);
  }

  noise(d: number, v = 0.3, f = 1200, key?: string): void {
    const ac = this.ac;
    if (!ac || !this.master || this.muted) return;
    if (key && this.throttled(key, 60)) return;
    const b = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * d)), ac.sampleRate);
    const a = b.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length);
    const s = ac.createBufferSource();
    const fl = ac.createBiquadFilter();
    const g = ac.createGain();
    s.buffer = b;
    fl.type = 'lowpass';
    fl.frequency.value = f;
    g.gain.value = v;
    s.connect(fl);
    fl.connect(g);
    g.connect(this.master);
    s.start();
  }

  private throttled(key: string, ms: number): boolean {
    const now = performance.now();
    if (this.last[key] !== undefined && now - this.last[key]! < ms) return true;
    this.last[key] = now;
    return false;
  }

  private arpeggio(freqs: number[], gapMs: number, d = 0.2, type: Wave = 'square', v = 0.12): void {
    freqs.forEach((f, i) => setTimeout(() => this.beep(f, d, type, v), i * gapMs));
  }

  private music(): void {
    const bass = [55, 55, 65.4, 55, 73.4, 55, 65.4, 49];
    const arp = [440, 523, 659, 784, 659, 523, 880, 659];
    let st = 0;
    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.ac) return;
      const s = this.ctl.game.state;
      const b = bass[(st >> 1) % 8]!;
      if (st % 2 === 0) this.beep(b, 0.22, 'sawtooth', 0.12);
      if (s.running) this.beep(arp[st % 8]! * (s.wave % 2 ? 1 : 1.122), 0.08, 'square', 0.03);
      if (st % 4 === 2) this.noise(0.05, 0.08, 8000);
      if (st % 8 === 0) this.beep(120, 0.15, 'sine', 0.3, -80);
      st++;
    }, 140);
  }

  /** Dauerstrahl des Entwicklers (pro Frame, gedrosselt). */
  laser(): void {
    this.beep(900 + Math.random() * 200, 0.05, 'sawtooth', 0.02, 0, 'lz');
  }

  select(): void {
    this.beep(880, 0.05);
  }

  onSim(e: SimEvent): void {
    switch (e.type) {
      case 'waveStarted':
        if (e.boss) this.beep(80, 1.2, 'sawtooth', 0.3, -40);
        this.beep(440, 0.15);
        setTimeout(() => this.beep(660, 0.2), 120);
        break;
      case 'killed':
        if (e.enemy.type === 'boss') this.noise(1.2, 0.6, 500);
        else {
          this.noise(0.2, 0.2, 2000, 'k');
          this.beep(300 + Math.random() * 400, 0.12, 'square', 0.08, 600, 'kb');
        }
        break;
      case 'leaked':
        this.noise(0.5, 0.5, 300);
        this.beep(90, 0.4, 'sawtooth', 0.25, -50);
        break;
      case 'gameOver':
        this.noise(2, 0.7, 400);
        this.arpeggio([400, 300, 200, 100], 300, 0.4, 'sawtooth', 0.25);
        break;
      case 'waveCleared':
        this.arpeggio([523, 659, 784, 1046], 100);
        break;
      case 'victory':
        this.arpeggio([523, 659, 784, 1046, 784, 1046, 1318], 120, 0.3, 'square', 0.14);
        break;
      case 'jammed':
        this.beep(70, 0.3, 'square', 0.12, 0, 'jm');
        break;
      case 'fired':
        if (e.tower.type === 'dualo') this.beep(1200, 0.04, 'square', 0.04, -600, 'cf');
        else if (e.tower.type === 'analyst') this.beep(600, 0.08, 'triangle', 0.08, -300, 'fn');
        else if (e.tower.type === 'scrum') this.beep(330, 0.15, 'triangle', 0.1, -200, 'sm');
        else this.beep(150, 0.2, 'sawtooth', 0.12, -80, 'lg');
        break;
      case 'splash':
        this.noise(0.3, 0.3, 900, 'ex');
        break;
      case 'placed':
        this.beep(220, 0.15, 'square', 0.15, 660);
        break;
      case 'upgraded':
        this.beep(523, 0.1);
        setTimeout(() => this.beep(784, 0.15), 90);
        setTimeout(() => this.beep(1046, 0.2), 180);
        break;
      case 'sold':
        this.noise(0.3, 0.3, 800);
        break;
      case 'rejected':
        if (e.command.type === 'place') this.beep(100, e.reason === 'noMoney' ? 0.25 : 0.2, 'sawtooth', 0.15);
        else if (e.reason === 'noMoney') this.beep(100, 0.25, 'sawtooth');
        break;
      default:
        break;
    }
  }

  dispose(): void {
    if (this.musicTimer !== null) clearInterval(this.musicTimer);
    void this.ac?.close();
  }
}
