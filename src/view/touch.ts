/**
 * Eingabeart (Maus oder Finger/Stift). Startwert aus `pointer: coarse`, danach folgt sie der zuletzt benutzten Eingabe.
 * Setzt die Klasse `touch` auf <html>, damit CSS Tastenhinweise ausblenden und Ziele vergrößern kann.
 */
export const pointerMode = { touch: false };

const listeners = new Set<() => void>();

export function onPointerModeChange(fn: () => void): void {
  listeners.add(fn);
}

function set(touch: boolean): void {
  if (touch === pointerMode.touch && document.documentElement.classList.contains('touch') === touch) return;
  pointerMode.touch = touch;
  document.documentElement.classList.toggle('touch', touch);
  for (const fn of listeners) fn();
}

export function installPointerMode(): void {
  set(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  window.addEventListener('pointerdown', (e) => set(e.pointerType !== 'mouse'), { capture: true, passive: true });
}

const TIP_KEY = 'bd.rotateTip';

/**
 * Vollbild-Knopf (nur Touch-Geräte mit Fullscreen-API, z. B. Android; iPhone-Safari kennt sie nicht – dort hilft
 * „Zum Home-Bildschirm“ dank Web-App-Manifest) und der ausblendbare Hinweis „quer halten“.
 */
export function installMobileChrome(onUserGesture: () => void): void {
  const btn = document.getElementById('fullscreen') as HTMLButtonElement | null;
  const root = document.documentElement;
  const update = (): void => {
    if (!btn) return;
    btn.hidden = !document.fullscreenEnabled || !pointerMode.touch;
    btn.setAttribute('aria-pressed', String(document.fullscreenElement !== null));
    btn.title = document.fullscreenElement ? 'Vollbild beenden' : 'Vollbild';
  };
  btn?.addEventListener('click', () => {
    onUserGesture();
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    void root
      .requestFullscreen({ navigationUI: 'hide' })
      .then(() => {
        // Im Vollbild darf Android die Ausrichtung festlegen: quer = größtes Spielfeld
        const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        return o.lock?.('landscape').catch(() => undefined);
      })
      .catch(() => undefined);
  });
  document.addEventListener('fullscreenchange', update);
  onPointerModeChange(update);
  update();

  try {
    if (localStorage.getItem(TIP_KEY) === 'off') root.classList.add('tip-off');
  } catch {
    // Speicher gesperrt – Hinweis bleibt sichtbar
  }
  document.getElementById('rotate-tip-close')?.addEventListener('click', () => {
    root.classList.add('tip-off');
    try {
      localStorage.setItem(TIP_KEY, 'off');
    } catch {
      // nur für diese Sitzung
    }
  });
  // Quer gedreht: Hinweis hat seinen Zweck erfüllt
  matchMedia('(orientation: landscape)').addEventListener('change', (e) => {
    if (e.matches && pointerMode.touch) root.classList.add('tip-off');
  });
}
