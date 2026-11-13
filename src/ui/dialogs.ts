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

/** „Konto sichern“: E-Mail-Link für mehrere Geräte (Supabase `updateUser({ email })`). */
export function secureDialog(ctx: ShellCtx): Promise<void> {
  return new Promise((resolve) => {
    const input = h('input', { type: 'email', id: 'secure-email', autocomplete: 'email', required: true, placeholder: 'name@firma.de', 'aria-describedby': 'secure-msg' });
    const msg = h('div', { id: 'secure-msg', class: 'hint', text: 'Wir schicken dir einen Bestätigungslink. Danach kannst du auf jedem Gerät weiterspielen.' });
    const ok = h('button', { type: 'submit', class: 'sh-btn primary', text: 'Link senden' });
    const cancel = h('button', { type: 'button', class: 'sh-btn', text: 'Abbrechen' });
    const form = h('form', { method: 'dialog' }, h('div', { class: 'dlg-ico' }, svg(I.shield)), h('h2', { text: 'Konto sichern' }), h('label', { for: 'secure-email', class: 'lbl', text: 'E-Mail-Adresse' }), input, msg, h('div', { class: 'row' }, cancel, ok));
    const dlg = modal('secure', form);
    dlg.setAttribute('aria-label', 'Konto sichern');
    const done = (): void => {
      dlg.close();
      dlg.remove();
      resolve();
    };
    cancel.addEventListener('click', done);
    dlg.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      done();
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const email = input.value.trim();
      if (!EMAIL_RE.test(email)) {
        msg.textContent = 'Bitte eine gültige E-Mail-Adresse eingeben.';
        msg.classList.add('err');
        return;
      }
      ok.disabled = true;
      msg.textContent = 'Wird gesendet…';
      msg.classList.remove('err');
      ctx.meta
        .secureAccount(email)
        .then((r) => {
          if (r === 'sent') {
            ctx.toast('Link gesendet – bitte E-Mail bestätigen.', 'ok', I.mail);
            done();
          } else {
            msg.textContent = 'Senden fehlgeschlagen – bitte später erneut versuchen.';
            msg.classList.add('err');
          }
        })
        .catch(() => {
          msg.textContent = 'Senden fehlgeschlagen – bitte später erneut versuchen.';
          msg.classList.add('err');
        })
        .finally(() => (ok.disabled = false));
    });
    dlg.showModal();
    input.focus();
  });
}
