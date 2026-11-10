import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Deployt Edge Functions per Supabase-CLI (Management-API, ohne Docker). Token aus supabase_token.txt (gitignored).
// `--yes`: Deploy auf das gehostete Projekt ist durch den freigegebenen Plan (Spec leaderboard-supabase) abgedeckt.
// Aufruf: npm run fn:deploy [-- <name> …]   (ohne Namen: alle Functions)
const REF = 'hqdvuessvcmtlcsysrmi';
const names = process.argv.slice(2);
const env = { ...process.env, SUPABASE_ACCESS_TOKEN: readFileSync('supabase_token.txt', 'utf8').trim() };
const args = ['supabase', 'functions', 'deploy', ...names, `--remote=${REF}`, '--use-api', '--yes'];
const res = spawnSync('npx', args, { stdio: 'inherit', env });
process.exit(res.status ?? 1);
