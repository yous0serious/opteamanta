// Eigene Linien-Icons (24 × 24, currentColor) und farbige Spiel-Symbole – keine Emojis (Spec visual-overhaul AC-3).

const line = (d: string, extra = ''): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`;

export const I = {
  back: line('<path d="M15 5l-7 7 7 7"/>'),
  next: line('<path d="M9 5l7 7-7 7"/>'),
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.7L9.5 4.6A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.4" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4" fill="currentColor"/></svg>',
  menu: line('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: line('<path d="M6 6l12 12M18 6L6 18"/>'),
  plus: line('<path d="M12 5v14M5 12h14"/>'),
  minus: line('<path d="M5 12h14"/>'),
  check: line('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  refresh: line('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>'),
  share: line('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>'),
  gear: line('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M4.2 7.5l2.3 1.3M17.5 15.2l2.3 1.3M4.2 16.5l2.3-1.3M17.5 8.8l2.3-1.3"/><circle cx="12" cy="12" r="7"/>'),
  campaign: line('<path d="M4 21V5l5-2 6 2 5-2v16l-5 2-6-2-5 2z"/><path d="M9 3v16M15 5v16"/>'),
  building: line('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M11 21v-3h2v3"/>'),
  calendar: line('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14.5h3"/>'),
  dice: line('<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r=".9" fill="currentColor"/><circle cx="15" cy="15" r=".9" fill="currentColor"/><circle cx="15" cy="9" r=".9" fill="currentColor"/><circle cx="9" cy="15" r=".9" fill="currentColor"/>'),
  tree: line('<circle cx="12" cy="5" r="2.4"/><circle cx="5.5" cy="18.5" r="2.4"/><circle cx="12" cy="18.5" r="2.4"/><circle cx="18.5" cy="18.5" r="2.4"/><path d="M12 7.4v8.7M12 11.5H5.5v4.6M12 11.5h6.5v4.6"/>'),
  podium: line('<path d="M3 20h18M4 20v-6h5v6M9 20V9h6v11M15 20v-8h5v8"/><path d="M12 3.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z"/>'),
  medal: line('<path d="M8 3l4 6 4-6"/><circle cx="12" cy="15" r="6"/><path d="M12 12v6M10 13.5l2-1.5"/>'),
  lock: '<svg viewBox="0 0 24 24"><rect x="4.5" y="10" width="15" height="11" rx="2.6" fill="currentColor"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="15.5" r="1.6" fill="#fff"/></svg>',
  user: line('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  shield: line('<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  mail: line('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>'),
  cloudOff: line('<path d="M3 3l18 18"/><path d="M8 7.5A5.5 5.5 0 0 1 17.5 11 4 4 0 0 1 19 18.5M14.5 19H7a4 4 0 0 1-1.2-7.8"/>'),
  target: line('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  skull: line('<path d="M5 11a7 7 0 1 1 14 0v3l-2 1v3h-2v-2h-2v2h-2v-2H9v2H7v-3l-2-1z"/><circle cx="9" cy="11" r="1.6" fill="currentColor"/><circle cx="15" cy="11" r="1.6" fill="currentColor"/>'),
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" fill="#ef5350" stroke="#c62828" stroke-width="1.5"/></svg>',
  wave: '<svg viewBox="0 0 24 24"><path d="M5 3v18" stroke="#546e7a" stroke-width="2.2" stroke-linecap="round"/><path d="M6 4h12l-3 4 3 4H6z" fill="#26a69a"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffca28" stroke="#f57f17" stroke-width="2"/><text x="12" y="16.5" font-size="11" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#e65100">SP</text></svg>',
  xp: '<svg viewBox="0 0 24 24"><path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" fill="#7e57c2" stroke="#4527a0" stroke-width="1.4"/><text x="12" y="15.6" font-size="8.6" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#fff">XP</text></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="#ffca28" stroke="#f57f17" stroke-width="1.5"/><path d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4" fill="none" stroke="#f57f17" stroke-width="1.5"/><path d="M10 14h4l1 4H9z" fill="#ffb300"/><rect x="7" y="18" width="10" height="3" rx="1" fill="#8d6e63"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor" stroke="rgba(0,0,0,.18)" stroke-width="1" stroke-linejoin="round"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="#ffca28" stroke="#f57f17" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="14.5" r="1.6" fill="#e53935"/></svg>',
  boss: '<svg viewBox="0 0 24 24"><path d="M4 9l3-5 2 3h6l2-3 3 5v5a8 8 0 0 1-16 0z" fill="#e53935" stroke="#b71c1c" stroke-width="1.3" stroke-linejoin="round"/><circle cx="9" cy="12" r="1.7" fill="#fff"/><circle cx="15" cy="12" r="1.7" fill="#fff"/><path d="M9 17h6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>',
  door: line('<path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21"/><path d="M3.5 21h17"/><circle cx="14.5" cy="12.5" r=".9" fill="currentColor"/>'),
  up: line('<path d="M7 14l5-5 5 5"/>'),
  down: line('<path d="M7 10l5 5 5-5"/>'),
  info: line('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.2"/>'),
} as const;

export type IconName = keyof typeof I;

/** 0–3 Sterne als SVG-Reihe (gefüllt/leer). */
export function starRow(n: number, of = 3): string {
  return Array.from({ length: of }, (_, i) => `<span class="st${i < n ? ' on' : ''}">${I.star}</span>`).join('');
}
