import Phaser from 'phaser';
import type { FxSettings } from './fx';

/** Feste Zeichenebenen der Spielszene (von unten nach oben). `world` wackelt, `overlay` nicht. */
export interface Layers {
  world: Phaser.GameObjects.Container;
  board: Phaser.GameObjects.Container;
  pile: Phaser.GameObjects.Container;
  under: Phaser.GameObjects.Container;
  towers: Phaser.GameObjects.Container;
  enemies: Phaser.GameObjects.Container;
  enemyUi: Phaser.GameObjects.Container;
  shots: Phaser.GameObjects.Container;
  particles: Phaser.GameObjects.Container;
  texts: Phaser.GameObjects.Container;
  overlay: Phaser.GameObjects.Container;
}

type Named = { name: string; layer: string };
const registry = new WeakMap<Phaser.Scene, Named[]>();

/** Ebenen anlegen; bei fx=high Schatten auf Türmen/Gegnern und Kamera-Vignette (Filter pro Ebene, nicht pro Objekt). */
export function createLayers(scene: Phaser.Scene, fx: FxSettings): Layers {
  const c = (): Phaser.GameObjects.Container => scene.add.container(0, 0);
  const layers: Layers = {
    world: c(), board: c(), pile: c(), under: c(), towers: c(), enemies: c(), enemyUi: c(),
    shots: c(), particles: c(), texts: c(), overlay: c(),
  };
  layers.world.add([
    layers.board, layers.pile, layers.under, layers.towers, layers.enemies, layers.enemyUi,
    layers.shots, layers.particles, layers.texts,
  ]);
  const active: Named[] = [];
  // Filter gibt es nur im WebGL-Renderer (Canvas-Fallback: Ruling R-4).
  const webgl = scene.game.renderer.type === Phaser.WEBGL;
  if (fx.level === 'high' && webgl) {
    for (const key of ['towers', 'enemies'] as const) {
      const layer = layers[key];
      layer.enableFilters();
      layer.filters?.internal.addShadow(1, 1.5, 0.12, 1, 0x000000, 6, 0.35);
      active.push({ name: 'Shadow', layer: key });
    }
    scene.cameras.main.filters.external.addVignette(0.5, 0.5, 0.9, 0.35);
    active.push({ name: 'Vignette', layer: 'camera' });
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

/** Namen aktiver Filter, z. B. `towers:Shadow` (E2E über window.__bd.debug.filters()). */
export function activeFilters(scene: Phaser.Scene): string[] {
  return (registry.get(scene) ?? []).map((f) => `${f.layer}:${f.name}`);
}
