// Audio (Spec season-2 AC-10, ADR-0006): CC0-Musik je Phase mit Überblendung, Jingles, Soundeffekte aus CC0-Paketen,
// fehlende Büro-Geräusche prozedural. Musik und Effekte haben getrennte Lautstärken; Einstellungen in localStorage.
import { ENEMIES, type SimEvent } from '../sim/index';
import type { Controller } from './controller';

type MusicSlot = 'music-planning' | 'music-wave' | 'music-boss';
type Phase = MusicSlot | 'none';

interface AudioManifest {
  music: Record<string, { file: string; loop: boolean }>;
  sfx: Record<string, string>;
}

export interface AudioSettings {
  music: number;
  sfx: number;
  muted: boolean;
}

export interface AudioStatus {
  started: boolean;
  phase: Phase;
  loaded: number;
  failed: number;
  played: Record<string, number>;
  settings: AudioSettings;
}

const STORAGE_KEY = 'bd.audio';
const FADE_S = 1.2;
/** Mindestabstand je Effekt in ms (Dauerfeuer wird gedrosselt). */
const THROTTLE: Record<string, number> = { hit: 70, throw: 90, kill: 60, coin: 50, typing: 260, jam: 400, sync: 300 };

function loadSettings(): AudioSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<AudioSettings> | null;
    if (raw) return { music: clamp01(raw.music ?? 0.6), sfx: clamp01(raw.sfx ?? 0.8), muted: !!raw.muted };
  } catch {
    // ungültige Einstellungen ignorieren
  }
  return { music: 0.6, sfx: 0.8, muted: false };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
}

export class SoundEngine {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private manifest: AudioManifest | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loading = new Map<string, Promise<AudioBuffer | null>>();
  private readonly tracks = new Map<MusicSlot, { src: AudioBufferSourceNode; gain: GainNode }>();
  private readonly last: Record<string, number> = {};
  private readonly played: Record<string, number> = {};
  private phase: Phase = 'none';
  private failed = 0;
  private duckUntil = 0;
  private timer: number | null = null;
  settings: AudioSettings = loadSettings();

  constructor(private readonly ctl: Controller) {
    // Mobile: Ein beim Antippen (touchstart/pointerdown) erzeugter AudioContext bleibt oft „suspended“; erst
    // pointerup/touchend/click zählen als Nutzergeste. iOS unterbricht den Kontext zudem bei Anrufen/App-Wechsel.
    const resume = (): void => {
      if (this.ac && this.ac.state !== 'running' && !document.hidden) void this.ac.resume().catch(() => undefined);
    };
    for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, resume, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ac) return;
      if (document.hidden) void this.ac.suspend().catch(() => undefined);
      else resume();
    });
  }

  get started(): boolean {
    return this.ac !== null;
  }

  get muted(): boolean {
    return this.settings.muted;
  }

  /** Erst nach einer Nutzergeste starten (Autoplay-Regeln der Browser); lädt dann Effekte und Musik nach. */
  start(): void {
    if (this.ac) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ac = new Ctx();
    this.master = this.ac.createGain();
    this.musicBus = this.ac.createGain();
    this.sfxBus = this.ac.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(this.ac.destination);
    this.applyVolumes();
    void fetch('audio/manifest.json')
      .then((r) => (r.ok ? (r.json() as Promise<AudioManifest>) : null))
      .then((m) => {
        this.manifest = m;
        if (!m) return;
        for (const key of Object.keys(m.sfx)) void this.buffer(`sfx:${key}`);
        for (const slot of ['music-planning', 'jingle-wave', 'jingle-boss', 'jingle-victory', 'jingle-gameover', 'music-wave', 'music-boss']) void this.buffer(`music:${slot}`);
      })
      .catch(() => {
        this.failed++;
      });
    this.timer = window.setInterval(() => this.updatePhase(), 250);
  }

  /** Debug/E2E: Zustand der Audio-Engine. */
  status(): AudioStatus {
    return { started: this.started, phase: this.phase, loaded: this.buffers.size, failed: this.failed, played: { ...this.played }, settings: { ...this.settings } };
  }

  toggleMute(): void {
    this.start();
    this.settings.muted = !this.settings.muted;
    this.save();
  }

  setMusicVolume(v: number): void {
    this.settings.music = clamp01(v);
    this.save();
  }

  setSfxVolume(v: number): void {
    this.settings.sfx = clamp01(v);
    this.save();
  }

  private save(): void {
    this.applyVolumes();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Speicher gesperrt – Einstellungen gelten nur für diese Sitzung
    }
  }

  private applyVolumes(): void {
    if (!this.ac || !this.master || !this.musicBus || !this.sfxBus) return;
    const t = this.ac.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : 0.9, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.settings.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx, t, 0.05);
  }

  private buffer(id: string): Promise<AudioBuffer | null> {
    const hit = this.buffers.get(id);
    if (hit) return Promise.resolve(hit);
    let p = this.loading.get(id);
    if (p) return p;
    const [kind, key] = id.split(':') as ['sfx' | 'music', string];
    const file = kind === 'sfx' ? this.manifest?.sfx[key] : this.manifest?.music[key]?.file;
    if (!file || !this.ac) return Promise.resolve(null);
    const ac = this.ac;
    p = fetch(`audio/${file}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ac.decodeAudioData(data))
      .then((buf) => {
        this.buffers.set(id, buf);
        if (kind === 'music' && key.startsWith('music-')) this.updatePhase(true);
        return buf;
      })
      .catch(() => {
        this.failed++;
        return null;
      });
    this.loading.set(id, p);
    return p;
  }

  // ---------- Musik ----------

  private updatePhase(force = false): void {
    if (!this.ac) return;
    const s = this.ctl.game.state;
    const bossAlive = s.enemies.some((e) => ENEMIES[e.type].boss && e.hp > 0) || (s.running && s.queue.includes('boss'));
    const next: Phase = s.over ? 'none' : s.running ? (bossAlive ? 'music-boss' : 'music-wave') : 'music-planning';
    // Ducking für Jingles
    if (this.musicBus) {
      const duck = performance.now() < this.duckUntil;
      this.musicBus.gain.setTargetAtTime((duck ? 0.25 : 1) * this.settings.music * 0.55, this.ac.currentTime, 0.15);
    }
    if (next === this.phase && !force) return;
    this.phase = next;
    const t = this.ac.currentTime;
    for (const [slot, tr] of this.tracks) {
      if (slot === next) continue;
      tr.gain.gain.setTargetAtTime(0, t, FADE_S / 3);
      tr.src.stop(t + FADE_S * 2);
      this.tracks.delete(slot);
    }
    if (next === 'none' || this.tracks.has(next)) return;
    const buf = this.buffers.get(`music:${next}`);
    if (!buf || !this.musicBus) return;
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = this.ac.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + FADE_S);
    src.connect(gain);
    gain.connect(this.musicBus);
    src.start(t);
    this.tracks.set(next, { src, gain });
  }

  private jingle(slot: string, duckMs = 1800): void {
    this.duckUntil = performance.now() + duckMs;
    this.playBuffer(`music:${slot}`, 1, 0.9, slot);
  }

  // ---------- Effekte ----------

  /** Effekt abspielen (öffentlich für Darstellungs-Effekte wie Combo oder Münzen). */
  play(key: string, volume = 1, rate = 0.94 + Math.random() * 0.12): void {
    const ms = THROTTLE[key] ?? 40;
    const now = performance.now();
    if (this.last[key] !== undefined && now - this.last[key]! < ms) return;
    this.last[key] = now;
    this.playBuffer(`sfx:${key}`, rate, volume, key);
  }

  private playBuffer(id: string, rate: number, volume: number, label: string): void {
    const ac = this.ac;
    if (!ac || !this.sfxBus || this.settings.muted) return;
    const buf = this.buffers.get(id);
    if (!buf) {
      void this.buffer(id);
      return;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ac.createGain();
    g.gain.value = volume;
    src.connect(g);
    // One-Shots (Effekte und Jingles) laufen über den Effekt-Bus: Jingles werden so nicht mit der Musik geduckt.
    g.connect(this.sfxBus!);
    src.start();
    this.played[label] = (this.played[label] ?? 0) + 1;
  }

  /** Prozedural: Telefonklingeln (Meeting-Einladung), zwei Doppeltöne. */
  private phone(): void {
    if (this.throttled('phone', 1500)) return;
    for (let i = 0; i < 2; i++) {
      for (const f of [440, 480]) this.tone(f, 0.35, 'sine', 0.05, i * 0.5);
    }
    this.played.phone = (this.played.phone ?? 0) + 1;
  }

  /** Prozedural: Drucker (Wellenende), rhythmisches Rauschen. */
  private printer(): void {
    for (let i = 0; i < 6; i++) this.noiseBurst(0.07, 0.06, 1800, i * 0.11);
    this.played.printer = (this.played.printer ?? 0) + 1;
  }

  private throttled(key: string, ms: number): boolean {
    const now = performance.now();
    if (this.last[key] !== undefined && now - this.last[key]! < ms) return true;
    this.last[key] = now;
    return false;
  }

  private tone(f: number, d: number, type: OscillatorType, v: number, delay = 0): void {
    const ac = this.ac;
    if (!ac || !this.sfxBus || this.settings.muted) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + d + 0.02);
  }

  private noiseBurst(d: number, v: number, f: number, delay = 0): void {
    const ac = this.ac;
    if (!ac || !this.sfxBus || this.settings.muted) return;
    const b = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * d)), ac.sampleRate);
    const a = b.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length);
    const s = ac.createBufferSource();
    const fl = ac.createBiquadFilter();
    const g = ac.createGain();
    s.buffer = b;
    fl.type = 'bandpass';
    fl.frequency.value = f;
    g.gain.value = v;
    s.connect(fl);
    fl.connect(g);
    g.connect(this.sfxBus);
    s.start(ac.currentTime + delay);
  }

  /** Dauerstrahl des Entwicklers: Tippgeräusch (gedrosselt). */
  laser(): void {
    this.play('typing', 0.35);
  }

  select(): void {
    this.play('select', 0.7);
  }

  onSim(e: SimEvent): void {
    switch (e.type) {
      case 'waveStarted':
        if (e.boss) {
          this.play('boss', 0.8);
          this.jingle('jingle-boss');
        } else this.jingle('jingle-wave', 900);
        this.updatePhase();
        break;
      case 'killed':
        if (ENEMIES[e.enemy.type].boss) this.play('applause', 0.9);
        else this.play('kill', 0.6);
        break;
      case 'split':
        this.play('split', 0.6);
        break;
      case 'leaked':
        this.play('leak', 0.8);
        break;
      case 'gameOver':
        this.jingle('jingle-gameover', 4000);
        this.updatePhase();
        break;
      case 'waveCleared':
        this.printer();
        this.updatePhase();
        break;
      case 'victory':
        this.jingle('jingle-victory', 5000);
        this.play('applause', 1);
        this.updatePhase();
        break;
      case 'jammed':
        this.play('jam', 0.6);
        if (e.enemy.type === 'meeting') this.phone();
        break;
      case 'fired':
        if (e.tower.type === 'scrum') this.play('sync', 0.35, 1.3);
        else this.play('throw', e.tower.type === 'ppl' ? 0.6 : 0.4, e.tower.type === 'ppl' ? 0.8 : e.tower.type === 'analyst' ? 1.15 : 1);
        break;
      case 'hit':
        this.play('hit', 0.35);
        break;
      case 'splash':
        this.play('hit', 0.6, 0.7);
        break;
      case 'placed':
        this.play('place', 0.8);
        break;
      case 'upgraded':
        this.play('upgrade', 0.7);
        break;
      case 'sold':
        this.play('sell', 0.7);
        break;
      case 'synced':
        this.play('sync', 0.7);
        break;
      case 'businessValue':
        this.play('businessValue', 0.7);
        break;
      case 'freeze':
        this.play('freeze', 0.8);
        break;
      case 'axed':
        this.play('axe', 0.9);
        break;
      case 'rejected':
        this.play('click', 0.6, 0.6);
        break;
      default:
        break;
    }
  }

  dispose(): void {
    if (this.timer !== null) clearInterval(this.timer);
    void this.ac?.close();
  }
}
