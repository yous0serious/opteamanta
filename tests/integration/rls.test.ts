// AC-1, AC-7: RLS, interne RPCs, Nicknames (gegen echtes Supabase).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HAVE_ENV, SKIP_MESSAGE, createAnonUser, createUser, deleteCreatedUsers, rand, rest, secretHeaders, type TestUser } from './helpers';

if (!HAVE_ENV) console.warn(SKIP_MESSAGE);

describe.skipIf(!HAVE_ENV)('RLS und Nicknames (AC-1, AC-7)', () => {
  let a: TestUser;
  let b: TestUser;
  const ZERO = '00000000-0000-0000-0000-000000000000';
  const denied = (s: number): boolean => s >= 400 && s < 500;

  beforeAll(async () => {
    a = await createAnonUser();
    b = await createUser();
  });
  afterAll(deleteCreatedUsers);

  it.each(['run_sessions', 'submissions', 'rate_counters'])('Direkte Writes auf %s sind verboten', async (table) => {
    const ins = await rest('POST', table, a.headers, { user_id: a.id });
    const upd = await rest('PATCH', `${table}?user_id=eq.${a.id}`, a.headers, { user_id: a.id });
    const del = await rest('DELETE', `${table}?user_id=eq.${a.id}`, a.headers);
    expect([ins.status, upd.status, del.status].every(denied)).toBe(true);
  });

  it('SELECT auf run_sessions und rate_counters ist verboten', async () => {
    expect(denied((await rest('GET', 'run_sessions?select=*', a.headers)).status)).toBe(true);
    expect(denied((await rest('GET', 'rate_counters?select=*', a.headers)).status)).toBe(true);
  });

  it('fremde Submissions sind unsichtbar', async () => {
    const r = await rest('GET', 'submissions?select=id', a.headers);
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
    const other = await rest('GET', `submissions?user_id=eq.${b.id}&select=id`, a.headers);
    expect(other.body).toEqual([]);
  });

  it('Profil für fremde user_id ist verboten', async () => {
    const r = await rest('POST', 'profiles', a.headers, { user_id: b.id, nickname: `Fremd${rand(5)}` });
    expect(denied(r.status)).toBe(true);
  });

  it('interne RPCs liefern 403', async () => {
    const calls: Array<[string, unknown]> = [
      ['claim_submission', {}],
      ['finish_submission', { p_id: ZERO, p_status: 'verified', p_reason: null, p_score: 1, p_wave: 1, p_lives: 1, p_won: false }],
      ['admin_reject_submission', { p_id: ZERO, p_reason: 'x' }],
      ['admin_delete_profile', { p_user: ZERO }],
      ['bump_rate', { p_user: a.id, p_bucket: 'x', p_day: '2026-01-01', p_limit: 1 }],
    ];
    for (const [name, args] of calls) {
      expect((await rest('POST', `rpc/${name}`, a.headers, args)).status, name).toBe(403);
    }
  });

  describe('Nicknames', () => {
    const tag = rand(3).toUpperCase();
    const own = `Nick ${tag}`;
    const patchNick = (u: TestUser, nickname: string) => rest('PATCH', `profiles?user_id=eq.${u.id}`, u.headers, { nickname }, { Prefer: 'return=representation' });

    it('gültiger eigener Eintrag, eigenes Profil löschen wirkt nicht', async () => {
      const r = await rest('POST', 'profiles', a.headers, { user_id: a.id, nickname: own }, { Prefer: 'return=representation' });
      expect(r.status).toBe(201);
      const del = await rest('DELETE', `profiles?user_id=eq.${a.id}`, a.headers);
      expect(denied(del.status) || del.status === 204).toBe(true);
      const still = await rest<Array<{ nickname: string }>>('GET', `profiles?user_id=eq.${a.id}&select=nickname`, a.headers);
      expect(still.body.length).toBe(1);
    });

    it.each([
      ['Umlaute', () => `Team ÄÖÜ_${rand(3)}`],
      ['3 Zeichen', () => rand(3)],
      ['16 Zeichen', () => rand(16)],
    ])('gültig: %s', async (_n, make) => {
      const nick = make();
      const r = await patchNick(a, nick);
      expect(r.status).toBe(200);
      expect((r.body as Array<{ nickname: string }>)[0]?.nickname).toBe(nick);
    });

    it.each([
      ['zu kurz', 'ab'],
      ['zu lang', 'abcdefghijklmnopq'],
      ['führendes Leerzeichen', ' lead'],
      ['abschließendes Leerzeichen', 'trail '],
      ['Sonderzeichen', 'bad!'],
    ])('ungültig: %s -> 400 (23514)', async (_n, nick) => {
      const r = await patchNick(a, nick);
      expect(r.status).toBe(400);
      expect((r.body as { code: string }).code).toBe('23514');
    });

    it('Duplikat ohne Beachtung der Groß-/Kleinschreibung -> 409 (23505)', async () => {
      const nick = `Dup${rand(8)}`;
      expect((await patchNick(a, nick)).status).toBe(200);
      const r = await rest('POST', 'profiles', b.headers, { user_id: b.id, nickname: nick.toUpperCase() });
      expect(r.status).toBe(409);
      expect((r.body as { code: string }).code).toBe('23505');
    });

    it('admin_delete_profile: mit Secret Key ja, mit Nutzer-Token nein', async () => {
      const own2 = await rest('POST', 'profiles', b.headers, { user_id: b.id, nickname: `Adm${rand(8)}` });
      expect(own2.status).toBe(201);
      expect((await rest('POST', 'rpc/admin_delete_profile', b.headers, { p_user: b.id })).status).toBe(403);
      expect((await rest<unknown[]>('GET', `profiles?user_id=eq.${b.id}&select=user_id`, b.headers)).body.length).toBe(1);
      const ok = await rest('POST', 'rpc/admin_delete_profile', secretHeaders(), { p_user: b.id });
      expect(ok.status).toBeLessThan(300);
      expect((await rest<unknown[]>('GET', `profiles?user_id=eq.${b.id}&select=user_id`, b.headers)).body.length).toBe(0);
    });
  });
});
