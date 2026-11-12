import Phaser from 'phaser';
import type { FxSettings } from './fx';

/** Feste Zeichenebenen der Spielszene (von unten nach oben). `world` wackelt, `overlay` nicht. */
export interface Layers {
  world: Phaser.GameObjects.Container;
  board: Phaser.GameObjects.Container;
  /** Bodenflecken (Spec office-makeover). */
  decals: Phaser.GameObjects.Container;
  pile: Phaser.GameObjects.Container;
  under: Phaser.GameObjects.Container;
  /** Arbeitsplätze und Monster gemeinsam, nach Fußpunkt sortiert (Tiefe). */
  actors: Phaser.GameObjects.Container;
  enemyUi: Phaser.GameObjects.Container;
  shots: Phaser.GameObjects.Container;
  particles: Phaser.GameObjects.Container;
  texts: Phaser.GameObjects.Container;
  overlay: Phaser.GameObjects.Container;
}

type Named = { name: string; layer: string };
const registry = new WeakMap<Phaser.Scene, Named[]>();

/**
 * Ebenen anlegen. Spec office-makeover AC-3: keine abdunkelnden Kamerafilter (keine Vignette);
 * bei fx=high und WebGL nur ein weicher Schatten auf der Figuren-Ebene.
 */
export function createLayers(scene: Phaser.Scene, fx: FxSettings): Layers {
  const c = (): Phaser.GameObjects.Container => scene.add.container(0, 0);
  const layers: Layers = {
    world: c(), board: c(), decals: c(), pile: c(), under: c(), actors: c(), enemyUi: c(),
    shots: c(), particles: c(), texts: c(), overlay: c(),
  };
  layers.world.add([
    layers.board, layers.decals, layers.pile, layers.under, layers.actors, layers.enemyUi,
    layers.shots, layers.particles, layers.texts,
  ]);
  const active: Named[] = [];
  // Filter gibt es nur im WebGL-Renderer (Canvas-Fallback: Ruling R-4 Spec visual-overhaul).
  const webgl = scene.game.renderer.type === Phaser.WEBGL;
  if (fx.level !== 'calm' && webgl) {
    layers.actors.enableFilters();
    // Weicher, warmer Schlagschatten nach rechts unten (Licht aus den Fenstern oben links). Geringe Stärke je Probe,
    // damit sich der Schatten nicht zu schwarzen Rändern aufsummiert; 12 Proben = glatter Verlauf.
    layers.actors.filters?.internal.addShadow(-0.25, -0.55, 0.1, 0.045, 0x3e2723, 12, 0.11);
    active.push({ name: 'Shadow', layer: 'actors' });
  }
  registry.set(scene, active);
  return layers;
}

/** Zusätzlich aktivierten Filter registrieren (für die Debug-Abfrage). */
export function registerFilter(scene: Phaser.Scene, layer: string, name: string): void {
  registry.get(scene)?.push({ name, layer });
}

export function unregisterFilter(scene: Phaser.Scene, layer: string, name: string): void {
  const list = registry.get(scene);
  if (!list) return;
  const i = list.findIndex((f) => f.layer === layer && f.name === name);
  if (i >= 0) list.splice(i, 1);
}

/** Namen aktiver Filter, z. B. `actors:Shadow` (E2E über window.__bd.debug.filters()). */
export function activeFilters(scene: Phaser.Scene): string[] {
  return (registry.get(scene) ?? []).map((f) => `${f.layer}:${f.name}`);
}
