import { readFileSync } from 'node:fs';
import { parseReplay, runReplay } from '../src/sim/index';

// Aufruf: npm run replay -- <pfad.json>
// Exit 0 = Ergebnis stimmt, 1 = Abweichung, 2 = Datei ungültig.
const file = process.argv[2];
if (!file) {
  console.error('Aufruf: npm run replay -- <replay.json>');
  process.exit(2);
}

let replay;
try {
  replay = parseReplay(readFileSync(file, 'utf8'));
} catch (err) {
  console.error((err as Error).message);
  process.exit(2);
}

const r = runReplay(replay);
console.log(`wave=${r.wave} lives=${r.lives} score=${r.score} tick=${r.tick} hash=${r.hash} matches=${r.matches}`);
if (!r.matches) {
  console.error(
    `Abweichung: erwartet wave=${replay.result.wave} lives=${replay.result.lives} score=${replay.result.score} ` +
      `over=${replay.result.over} endTick=${replay.endTick}`,
  );
  process.exit(1);
}
