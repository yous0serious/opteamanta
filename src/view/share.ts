// Ergebnis teilen (Spec season-2 AC-11): Text im Wordle-Stil + Bildkarte 1200 × 630.

export const SHARE_URL = 'https://opteamanta.netlify.app';
export const CARD_W = 1200;
export const CARD_H = 630;

export interface ShareInfo {
  /** `TT.MM.` bei Daily, sonst null (freies Spiel). */
  daily: string | null;
  wave: number;
  /** Challenge: 30; Endlos: null. */
  waves: number | null;
  lives: number;
  score: number;
  rank: number | null;
  team: string | null;
  map: string;
  won: boolean;
}

export interface ShareResult {
  text: string;
  width: number;
  height: number;
  method: 'share' | 'fallback';
}

/** Zuletzt erzeugtes Teilen-Ergebnis (Debug/E2E) und Tagesrang aus der Daily-Prüfung. */
export const shareState: { last: ShareResult | null; rank: number | null; team: string | null } = { last: null, rank: null, team: null };

const fmt = (n: number): string => n.toLocaleString('de-DE');

/** Format: `Backlog Defense 3000 · <Daily TT.MM. | Freies Spiel> · Welle <n>/30 · Moral <m> % · Score <s>[ · Rang <r>] – <URL>` */
export function shareText(i: ShareInfo): string {
  const kind = i.daily ? `Daily ${i.daily}` : 'Freies Spiel';
  const wave = i.waves ? `Welle ${i.wave}/${i.waves}` : `Welle ${i.wave} (Endlos)`;
  const rank = i.rank ? ` · Rang ${i.rank}` : '';
  return `Backlog Defense 3000 · ${kind} · ${wave} · Moral ${Math.max(0, i.lives)} % · Score ${fmt(i.score)}${rank} – ${SHARE_URL}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Bildkarte zeichnen: Spielfeld-Bild links, Kennzahlen rechts. */
export function drawCard(i: ShareInfo, shot: CanvasImageSource | null): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext('2d')!;
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, '#fffaf2');
  bg.addColorStop(1, '#e9e1d4');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // Spielfeld
  ctx.save();
  ctx.shadowColor = 'rgba(38,50,56,.25)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, 40, 95, 640, 400, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  if (shot) {
    ctx.save();
    roundRect(ctx, 40, 95, 640, 400, 18);
    ctx.clip();
    ctx.drawImage(shot, 40, 95, 640, 400);
    ctx.restore();
  }
  // Titel
  ctx.fillStyle = '#d32f2f';
  ctx.font = '700 64px Caveat, cursive';
  ctx.fillText('Backlog Defense', 40, 70);
  ctx.fillStyle = '#26a69a';
  ctx.fillText('3000', 440, 70);
  // Kennzahlen
  const x = 720;
  ctx.fillStyle = '#263238';
  ctx.font = '800 34px Nunito, Arial, sans-serif';
  ctx.fillText(i.daily ? `Daily ${i.daily}` : 'Freies Spiel', x, 140);
  ctx.font = '700 24px Nunito, Arial, sans-serif';
  ctx.fillStyle = '#607d8b';
  ctx.fillText(i.team ? `Team ${i.team}` : 'Team Prozessoptimierung', x, 178);
  ctx.fillText(i.map, x, 210);
  const rows: Array<[string, string]> = [
    ['Welle', i.waves ? `${i.wave}/${i.waves}` : String(i.wave)],
    ['Score', fmt(i.score)],
    ['Moral', `${Math.max(0, i.lives)} %`],
    ...(i.rank ? ([['Rang', `#${i.rank}`]] as Array<[string, string]>) : []),
  ];
  rows.forEach(([k, v], n) => {
    const y = 270 + n * 62;
    ctx.fillStyle = '#90a4ae';
    ctx.font = '700 22px Nunito, Arial, sans-serif';
    ctx.fillText(k, x, y);
    ctx.fillStyle = '#263238';
    ctx.font = '800 40px Nunito, Arial, sans-serif';
    ctx.fillText(v, x + 130, y + 4);
  });
  if (i.won) {
    ctx.fillStyle = '#2e7d32';
    ctx.font = '700 40px Caveat, cursive';
    ctx.fillText('RELEASE ERFOLGREICH!', x, 540);
  }
  ctx.fillStyle = '#00796b';
  ctx.font = '700 22px Nunito, Arial, sans-serif';
  ctx.fillText(SHARE_URL.replace('https://', ''), 40, 560);
  return c;
}

/** Teilen per Web Share API (mit Bild), sonst Text in die Zwischenablage und Bild herunterladen. */
export async function shareResult(i: ShareInfo, shot: CanvasImageSource | null): Promise<ShareResult> {
  const text = shareText(i);
  const canvas = drawCard(i, shot);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  const file = blob ? new File([blob], 'backlog-defense.png', { type: 'image/png' }) : null;
  let method: ShareResult['method'] = 'fallback';
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (file && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text, title: 'Backlog Defense 3000' });
      method = 'share';
    } catch {
      method = 'fallback';
    }
  }
  if (method === 'fallback') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Zwischenablage nicht erlaubt – Text steht zusätzlich in der Statuszeile
    }
    if (blob) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'backlog-defense.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  }
  const result: ShareResult = { text, width: canvas.width, height: canvas.height, method };
  shareState.last = result;
  return result;
}
