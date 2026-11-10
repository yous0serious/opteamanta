import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Spielt neue Migrationen aus supabase/migrations über die Supabase-Management-API ein (Spec leaderboard-supabase T01).
// Kompatibel zur CLI-Tabelle supabase_migrations.schema_migrations. Token aus supabase_token.txt (gitignored).
// Aufruf: npm run db:push [-- --dry-run]

const REF = 'hqdvuessvcmtlcsysrmi';
const DIR = 'supabase/migrations';
const token = readFileSync('supabase_token.txt', 'utf8').trim();
const dry = process.argv.includes('--dry-run');

async function sql<T = unknown>(query: string): Promise<T> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL fehlgeschlagen (${res.status}): ${text.slice(0, 800)}`);
  return (text ? JSON.parse(text) : []) as T;
}

const literal = (s: string): string => `'${s.replaceAll("'", "''")}'`;

async function main(): Promise<void> {
  await sql(`create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`);
  const applied = new Set((await sql<Array<{ version: string }>>('select version from supabase_migrations.schema_migrations')).map((r) => r.version));
  const files = readdirSync(DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  for (const file of files) {
    const [version, ...rest] = file.replace(/\.sql$/, '').split('_');
    if (applied.has(version!)) continue;
    const body = readFileSync(join(DIR, file), 'utf8');
    console.log(`${dry ? '[dry-run] ' : ''}Migration ${file}`);
    if (dry) continue;
    await sql(`begin;\n${body}\ninsert into supabase_migrations.schema_migrations (version, name, statements) values (${literal(version!)}, ${literal(rest.join('_'))}, array[]::text[]);\ncommit;`);
  }
  console.log('db:push fertig');
}

main().catch((err: unknown) => {
  console.error((err as Error).message);
  process.exit(1);
});
