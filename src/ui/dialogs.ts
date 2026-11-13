// Modale Dialoge der Shell: Bestätigen und „Konto sichern“.
import type { ShellCtx } from './context';
import { h, svg } from './dom';
import { I } from './icons';

function modal(cls: string, ...children: Node[]): HTMLDialogElement {
  const dlg = h('dialog', { class: `sh-dialog ${cls}` }, ...children);
  document.body.append(dlg);
  return dlg;
}

/** Ja/Nein-Abfrage; Esc/Abbrechen = false. */
export function confirmDialog(title: string, text: string, ok: string, cancel = 'Abbrechen'): Promise<boolean> {
  return new Promise((resolve) => {
    const okBtn = h('button', { type: 'button', class: 'sh-btn primary', text: ok });
    const noBtn = h('button', { type: 'button', class: 'sh-btn', text: cancel });
    const dlg = modal('confirm', h('h2', { text: title }), h('p', { text }), h('div', { class: 'row' }, noBtn, okBtn));
    dlg.setAttribute('aria-label', title);
    const done = (v: boolean): void => {
      dlg.close();
      dlg.remove();
      resolve(v);
    };
    okBtn.addEventListener('click', () => done(true));
    noBtn.addEventListener('click', () => done(false));
    dlg.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      done(false);
    });
    dlg.showModal();
    noBtn.focus();
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 6;

const SECURE_TEXT: Record<string, string> = {
  invalid: 'Bitte eine gültige E-Mail-Adresse eingeben.',
  taken: 'Diese E-Mail gehört schon zu einem Konto – dann bitte „Anmelden“ wählen.',
  weak: `Das Passwort braucht mindestens ${MIN_PASSWORD} Zeichen.`,
  error: 'Speichern fehlgeschlagen – bitte später erneut versuchen.',
};

/**
 * „Konto sichern“: E-Mail + Passwort ans aktuelle (anonyme) Konto hängen – sofort aktiv, keine Bestätigungsmail.
 * Umschaltbar auf „Anmelden“ für ein schon gesichertes Konto (anderes Gerät); danach lädt die Seite neu.
 */
export function secureDialog(ctx: ShellCtx): Promise<void> {
  return new Promise((resolve) => {
    let mode: 'secure' | 'login' = 'secure';
    const email = h('input', { type: 'email', id: 'secure-email', autocomplete: 'email', required: true, placeholder: 'name@firma.de', 'aria-describedby': 'secure-msg' });
    const pass = h('input', { type: 'password', id: 'secure-pass', autocomplete: 'new-password', required: true, minlength: String(MIN_PASSWORD), 'aria-describedby': 'secure-msg' });
    const title = h('h2', { text: 'Konto sichern' });
    const msg = h('div', { id: 'secure-msg', class: 'hint' });
    const ok = h('button', { type: 'submit', class: 'sh-btn primary' });
    const cancel = h('button', { type: 'button', class: 'sh-btn', text: 'Abbrechen' });
    const toggle = h('button', { type: 'button', class: 'sh-link' });
    const form = h(
      'form',
      { method: 'dialog' },
      h('div', { class: 'dlg-ico' }, svg(I.shield)),
      title,
      h('label', { for: 'secure-email', class: 'lbl', text: 'E-Mail-Adresse' }),
      email,
      h('label', { for: 'secure-pass', class: 'lbl', text: 'Passwort' }),
      pass,
      msg,
      h('div', { class: 'row' }, cancel, ok),
      toggle,
    );
    const dlg = modal('secure', form);
    const setMode = (m: typeof mode): void => {
      mode = m;
      const secure = m === 'secure';
      title.textContent = secure ? 'Konto sichern' : 'Anmelden';
      dlg.setAttribute('aria-label', title.textContent);
      ok.textContent = secure ? 'Sichern' : 'Anmelden';
      pass.setAttribute('autocomplete', secure ? 'new-password' : 'current-password');
      toggle.textContent = secure ? 'Schon ein gesichertes Konto? Anmelden' : 'Noch kein Konto? Dieses Konto sichern';
      msg.classList.remove('err');
      msg.textContent = secure
        ? 'Damit spielst du mit deinem Fortschritt auf jedem Gerät weiter. Sofort aktiv – keine Bestätigungsmail.'
        : 'Achtung: Der Fortschritt auf diesem Gerät wird durch dein gesichertes Konto ersetzt.';
    };
    setMode('secure');
    const done = (): void => {
      dlg.close();
      dlg.remove();
      resolve();
    };
    const fail = (text: string): void => {
      msg.textContent = text;
      msg.classList.add('err');
    };
    cancel.addEventListener('click', done);
    toggle.addEventListener('click', () => setMode(mode === 'secure' ? 'login' : 'secure'));
    dlg.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      done();
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const addr = email.value.trim();
      if (!EMAIL_RE.test(addr)) return fail(SECURE_TEXT.invalid!);
      if (mode === 'secure' && pass.value.length < MIN_PASSWORD) return fail(SECURE_TEXT.weak!);
      ok.disabled = true;
      msg.classList.remove('err');
      msg.textContent = mode === 'secure' ? 'Wird gespeichert…' : 'Anmeldung läuft…';
      const run =
        mode === 'secure'
          ? ctx.meta.secureAccount(addr, pass.value).then((r) => {
              if (r !== 'ok') return fail(SECURE_TEXT[r] ?? SECURE_TEXT.error!);
              ctx.toast('Konto gesichert – auf anderen Geräten einfach anmelden.', 'ok', I.shield);
              done();
            })
          : ctx.meta.login(addr, pass.value).then((r) => {
              if (r !== 'ok') return fail(r === 'wrong' ? 'E-Mail oder Passwort falsch.' : 'Anmeldung fehlgeschlagen – bitte später erneut versuchen.');
              done();
              // Neu laden: Spielstand, Profil und Ranglisten gehören jetzt zum angemeldeten Konto
              location.reload();
            });
      run.catch(() => fail(SECURE_TEXT.error!)).finally(() => (ok.disabled = false));
    });
    dlg.showModal();
    email.focus();
  });
}

