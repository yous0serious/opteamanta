// Dev-Einstieg für die Shell mit Mock-Diensten: `?shell=mock` (optional `&offline=1`). Im Produktions-Build entfällt
// der Inhalt (import.meta.env.DEV = false), die dynamischen Importe werden nicht gebündelt.
if (import.meta.env.DEV && new URLSearchParams(location.search).get('shell') === 'mock') {
  void Promise.all([import('./mock-meta'), import('./mock-host'), import('../index')]).then(([{ MockMeta }, { MockHost }, ui]) => {
    const offline = new URLSearchParams(location.search).get('offline') === '1';
    const meta = new MockMeta(!offline);
    const host = new MockHost(meta);
    const sound = { start: () => undefined, ui: (name: string) => console.debug('[ui-sound]', name) };
    const ctl = (): { game: { state: { wave: number; over: boolean } } } | undefined => (window as unknown as { __bd?: { game: { state: { wave: number; over: boolean } } } }).__bd;
    ui.mountShell(meta, host, sound, { runActive: () => !!ctl() && ctl()!.game.state.wave > 0 && !ctl()!.game.state.over }, true);
  });
}

export {};
