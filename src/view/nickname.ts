import { NICKNAME_RE, type NicknameResult } from '../online/api';

const HINT = '3–16 Zeichen: Buchstaben, Ziffern, Leerzeichen, - und _';

/**
 * Modaler Dialog „Wie heißt dein Team?“ (Spec leaderboard-supabase AC-9).
 * `save` prüft serverseitig (Eindeutigkeit); Ergebnis: gespeicherter Name oder null bei Abbruch.
 */
export function askNickname(save: (name: string) => Promise<NicknameResult>): Promise<string | null> {
  const dlg = document.createElement('dialog');
  dlg.id = 'nick';
  dlg.innerHTML = `
    <form method="dialog">
      <h2>Wie heißt dein Team?</h2>
      <p>Der Name erscheint in der Bestenliste.</p>
      <input id="nick-input" name="nick" maxlength="16" autocomplete="nickname" required placeholder="z. B. Team Kanban" />
      <div id="nick-msg" class="hint"></div>
      <div class="row">
        <button value="cancel" formnovalidate id="nick-cancel">Später</button>
        <button value="ok" id="nick-ok">✅ Eintragen</button>
      </div>
    </form>`;
  document.body.append(dlg);
  const input = dlg.querySelector<HTMLInputElement>('#nick-input')!;
  const msg = dlg.querySelector<HTMLElement>('#nick-msg')!;
  const ok = dlg.querySelector<HTMLButtonElement>('#nick-ok')!;
  msg.textContent = HINT;

  return new Promise((resolve) => {
    const finish = (value: string | null): void => {
      dlg.close();
      dlg.remove();
      resolve(value);
    };
    dlg.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      finish(null);
    });
    dlg.querySelector('#nick-cancel')!.addEventListener('click', (ev) => {
      ev.preventDefault();
      finish(null);
    });
    dlg.querySelector('form')!.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const name = input.value.trim();
      if (!NICKNAME_RE.test(name)) {
        msg.textContent = `Ungültig. ${HINT}`;
        msg.classList.add('err');
        return;
      }
      ok.disabled = true;
      msg.textContent = 'Wird gespeichert…';
      msg.classList.remove('err');
      save(name)
        .then((res) => {
          if (res === 'ok') return finish(name);
          msg.textContent = res === 'taken' ? 'Name schon vergeben – bitte einen anderen wählen.' : `Ungültig. ${HINT}`;
          msg.classList.add('err');
        })
        .catch(() => {
          msg.textContent = 'Speichern fehlgeschlagen – bitte erneut versuchen.';
          msg.classList.add('err');
        })
        .finally(() => {
          ok.disabled = false;
        });
    });
    dlg.showModal();
    input.focus();
  });
}
