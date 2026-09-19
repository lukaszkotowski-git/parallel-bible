import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  OAUTH_CALLBACK_URL,
  RESET_REDIRECT_URL,
  VERIFIED_CALLBACK_URL,
  authClient,
  fetchAuthConfig,
  signIn,
  signUp,
} from "@/lib/auth";
import { invalidateUserState } from "@/lib/api";
import { cn } from "@/lib/utils";

type Mode = "login" | "register" | "forgot";

/** Po wysłaniu maila pokazujemy potwierdzenie zamiast formularza. */
type Sent = { kind: "verify" | "reset"; email: string };

const RESEND_COOLDOWN_S = 60;

/** Komunikaty Better Auth są po angielsku — tłumaczymy te, które realnie widać. */
function translateError(message?: string) {
  const m = (message ?? "").toLowerCase();
  if (m.includes("not verified")) return "Adres e-mail nie został jeszcze potwierdzony — wysłaliśmy nowy link.";
  if (m.includes("too many")) return "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.";
  if (m.includes("invalid email or password")) return "Nieprawidłowy e-mail lub hasło.";
  if (m.includes("already exists") || m.includes("existing email"))
    return "Konto z tym adresem już istnieje — zaloguj się.";
  if (m.includes("password") && m.includes("short")) return "Hasło musi mieć min. 8 znaków.";
  if (m.includes("invalid email")) return "Nieprawidłowy adres e-mail.";
  return message || "Coś poszło nie tak. Spróbuj ponownie.";
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [needsVerification, setNeedsVerification] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const { data: config } = useQuery({ queryKey: ["auth-config"], queryFn: fetchAuthConfig });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setNeedsVerification(false);

    if (mode === "forgot") {
      // Odpowiedź jest taka sama, gdy konta nie ma — nie zdradzamy, kto ma konto.
      const res = await authClient.requestPasswordReset({ email, redirectTo: RESET_REDIRECT_URL });
      setBusy(false);
      if (res.error) return setError(translateError(res.error.message));
      setSent({ kind: "reset", email });
      setCooldown(RESEND_COOLDOWN_S);
      return;
    }

    const res =
      mode === "login"
        ? await signIn.email({ email, password, callbackURL: VERIFIED_CALLBACK_URL })
        : await signUp.email({
            email,
            password,
            name: name.trim() || email.split("@")[0],
            callbackURL: VERIFIED_CALLBACK_URL,
          });
    setBusy(false);

    if (res.error) {
      const unverified = res.error.status === 403 || res.error.code === "EMAIL_NOT_VERIFIED";
      setNeedsVerification(unverified);
      setError(translateError(unverified ? "not verified" : res.error.message));
      if (unverified) setCooldown(RESEND_COOLDOWN_S);
      return;
    }
    // Serwer z wymogiem potwierdzenia nie zakłada sesji — brak tokenu = czekamy na link z maila.
    if (mode === "register" && res.data && !("token" in res.data && res.data.token)) {
      setSent({ kind: "verify", email });
      setCooldown(RESEND_COOLDOWN_S);
      return;
    }
    invalidateUserState();
    navigate("/");
  };

  const resend = async () => {
    if (!sent && !needsVerification) return;
    const target = sent?.email ?? email;
    setCooldown(RESEND_COOLDOWN_S);
    const res =
      sent?.kind === "reset"
        ? await authClient.requestPasswordReset({ email: target, redirectTo: RESET_REDIRECT_URL })
        : await authClient.sendVerificationEmail({ email: target, callbackURL: VERIFIED_CALLBACK_URL });
    if (res.error) setError(translateError(res.error.message));
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNeedsVerification(false);
  };

  const googleSignIn = async () => {
    setError(null);
    await signIn.social({ provider: "google", callbackURL: OAUTH_CALLBACK_URL });
  };

  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <main id="main" tabIndex={-1} className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
          data-testid="link-back-home"
        >
          <ArrowLeft className="h-4 w-4" /> Czytaj bez logowania
        </Link>

        <div className="rounded-xl border border-card-border bg-card p-6 shadow-xs">
          <BrandMark className="h-7 w-7 text-foreground" />
          <h1 className="mt-3 font-display text-xl font-bold leading-tight">
            {sent
              ? "Sprawdź skrzynkę"
              : mode === "login"
                ? "Zaloguj się"
                : mode === "register"
                  ? "Załóż konto"
                  : "Reset hasła"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "forgot" && !sent
              ? "Podaj adres e-mail konta — wyślemy link do ustawienia nowego hasła."
              : !sent &&
                "Tekst czytasz bez konta. Logowanie zapisuje postęp, ulubione wersety i motyw — i synchronizuje je między telefonem a laptopem."}
          </p>

          {sent && (
            <div className="mt-5 space-y-4" role="status" data-testid="text-mail-sent">
              <div className="flex gap-3 rounded-lg bg-primary/10 p-3 text-sm">
                <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <p>
                  {sent.kind === "verify" ? (
                    <>
                      Wysłaliśmy link potwierdzający na <strong className="break-all">{sent.email}</strong>.
                      Kliknij go, żeby aktywować konto (ważny 1 godzinę).
                    </>
                  ) : (
                    <>
                      Jeśli konto z adresem <strong className="break-all">{sent.email}</strong> istnieje,
                      wysłaliśmy na nie link do ustawienia nowego hasła (ważny 1 godzinę).
                    </>
                  )}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Nie ma wiadomości? Zajrzyj do folderu ze spamem.</p>
              {error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="button" variant="outline" className="w-full" disabled={cooldown > 0} onClick={resend} data-testid="button-resend">
                {cooldown > 0 ? `Wyślij ponownie (${cooldown} s)` : "Wyślij ponownie"}
              </Button>
              <button
                type="button"
                className="block w-full rounded text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setSent(null);
                  switchMode("login");
                }}
              >
                Wróć do logowania
              </button>
            </div>
          )}

          {!sent && config?.google && mode !== "forgot" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="mt-5 w-full"
                onClick={googleSignIn}
                data-testid="button-google"
              >
                <GoogleMark className="mr-2 h-4 w-4" /> Kontynuuj przez Google
              </Button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> albo
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          {!sent && (
          <form onSubmit={submit} className={cn("space-y-4", !(config?.google && mode !== "forgot") && "mt-5")}>
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Imię</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Jak mamy Cię nazywać?"
                  data-testid="input-name"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                data-testid="input-email"
              />
            </div>

            {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Hasło</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                data-testid="input-password"
              />
              {mode === "register" && (
                <p className="text-xs text-muted-foreground">Minimum 8 znaków.</p>
              )}
              {mode === "login" && config?.mail && (
                <button
                  type="button"
                  className="rounded text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => switchMode("forgot")}
                  data-testid="button-forgot"
                >
                  Nie pamiętasz hasła?
                </button>
              )}
            </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                data-testid="text-auth-error"
              >
                {error}
              </p>
            )}

            {needsVerification && (
              <Button type="button" variant="outline" className="w-full" disabled={cooldown > 0} onClick={resend}>
                {cooldown > 0 ? `Wyślij link ponownie (${cooldown} s)` : "Wyślij link ponownie"}
              </Button>
            )}

            <Button type="submit" className="w-full" disabled={busy} data-testid="button-submit">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? "Zaloguj się" : mode === "register" ? "Załóż konto" : "Wyślij link"}
            </Button>
          </form>
          )}

          {!sent && (
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Nie masz jeszcze konta?" : "Masz już konto?"}{" "}
            <button
              type="button"
              className="rounded font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
              data-testid="button-switch-mode"
            >
              {mode === "login" ? "Załóż je" : "Zaloguj się"}
            </button>
          </p>
          )}
        </div>
      </main>
    </div>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
