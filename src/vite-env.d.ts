/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase-Projekt-URL (Netlify-Variable); fehlt sie, läuft das Spiel offline. */
  readonly VITE_SUPABASE_URL?: string;
  /** Publishable Key (browser-tauglich, Rechte über RLS begrenzt). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
