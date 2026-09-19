/**
 * Wysyłka e-maili przez SMTP (nodemailer). Konfiguracja tylko ze środowiska:
 * SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, MAIL_FROM.
 *
 * Brak SMTP_HOST nie jest błędem — `mailEnabled` jest wtedy false, rejestracja działa
 * bez potwierdzania adresu (jak wcześniej), a w trybie deweloperskim treść maila
 * (z linkiem) ląduje w konsoli zamiast w skrzynce.
 */
import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, MAIL_FROM } = process.env;

export const mailEnabled = Boolean(SMTP_HOST && MAIL_FROM);

const port = Number(SMTP_PORT) || 587;
// SMTP_SECURE=true → TLS od razu (zwykle port 465); false → STARTTLS (587).
// Bez jawnej wartości wnioskujemy z portu.
const secure = SMTP_SECURE ? ["true", "1", "yes"].includes(SMTP_SECURE.toLowerCase()) : port === 465;

const transporter = mailEnabled
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    })
  : null;

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendMail(msg: MailMessage): Promise<void> {
  if (!transporter) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[mail:dev] do: ${msg.to} · ${msg.subject}\n${msg.text}`);
    }
    return;
  }
  await transporter.sendMail({ from: MAIL_FROM, ...msg });
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Wspólny szablon: jedna wiadomość = nagłówek, akapit, przycisk, informacja „zignoruj". */
function actionMail(opts: {
  to: string;
  subject: string;
  greeting: string;
  lead: string;
  button: string;
  url: string;
  footnote: string;
}): MailMessage {
  const { greeting, lead, button, url, footnote } = opts;
  const text = `${greeting}\n\n${lead}\n\n${button}: ${url}\n\n${footnote}\n\n— Parallel Bible`;
  const html = `<!doctype html><html lang="pl"><body style="margin:0;background:#f6f4ef;padding:24px;font-family:Georgia,serif;color:#222">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
<h1 style="font-size:20px;margin:0 0 16px">Parallel Bible</h1>
<p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
<p style="margin:0 0 20px;line-height:1.5">${escapeHtml(lead)}</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#3b5b45;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-family:Arial,sans-serif;font-size:15px">${escapeHtml(button)}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#666;line-height:1.5">Jeśli przycisk nie działa, skopiuj ten adres do przeglądarki:<br><span style="word-break:break-all">${escapeHtml(url)}</span></p>
<p style="margin:16px 0 0;font-size:13px;color:#666;line-height:1.5">${escapeHtml(footnote)}</p>
</div></body></html>`;
  return { to: opts.to, subject: opts.subject, text, html };
}

export const verificationMail = (to: string, name: string, url: string) =>
  actionMail({
    to,
    subject: "Potwierdź adres e-mail — Parallel Bible",
    greeting: `Cześć ${name || ""}!`.replace(" !", "!"),
    lead: "Dziękujemy za założenie konta. Potwierdź adres e-mail, żeby zacząć zapisywać postęp, ulubione wersety i notatki.",
    button: "Potwierdź adres e-mail",
    url,
    footnote: "Link jest ważny 1 godzinę. Jeśli to nie Ty zakładałeś konto, po prostu zignoruj tę wiadomość.",
  });

export const resetPasswordMail = (to: string, name: string, url: string) =>
  actionMail({
    to,
    subject: "Ustaw nowe hasło — Parallel Bible",
    greeting: `Cześć ${name || ""}!`.replace(" !", "!"),
    lead: "Otrzymaliśmy prośbę o zmianę hasła do Twojego konta.",
    button: "Ustaw nowe hasło",
    url,
    footnote: "Link jest ważny 1 godzinę. Jeśli to nie Ty, zignoruj tę wiadomość — hasło pozostanie bez zmian.",
  });
