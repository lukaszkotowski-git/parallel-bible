import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authClient } from "@/lib/auth";

/**
 * Cel linku z maila o resecie hasła. Better Auth przekierowuje na
 * `/?token=…#/reset-hasla` (albo `?error=INVALID_TOKEN`) — parametry są przed hashem.
 */
export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const linkBroken = !token || params.has("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("Hasła nie są takie same.");
    setError(null);
    setBusy(true);
    const res = await authClient.resetPassword({ newPassword: password, token: token! });
    setBusy(false);
    if (res.error) {
      setError(
        res.error.message?.toLowerCase().includes("token")
          ? "Link wygasł lub został już użyty. Poproś o nowy."
          : (res.error.message ?? "Coś poszło nie tak. Spróbuj ponownie."),
      );
      return;
    }
    // Usuwamy token z paska adresu, żeby nie został w historii przeglądarki.
    window.history.replaceState(null, "", `${window.location.pathname}#/login`);
    toast({ title: "Hasło zmienione", description: "Zaloguj się nowym hasłem.", duration: 5000 });
    navigate("/login");
  };

  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <main id="main" tabIndex={-1} className="w-full max-w-sm">
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Wróć do logowania
        </Link>
        <div className="rounded-xl border border-card-border bg-card p-6 shadow-xs">
          <BrandMark className="h-7 w-7 text-foreground" />
          <h1 className="mt-3 font-display text-xl font-bold leading-tight">Ustaw nowe hasło</h1>

          {linkBroken ? (
            <div className="mt-4 space-y-4" role="alert">
              <p className="text-sm text-muted-foreground">
                Ten link do zmiany hasła jest nieprawidłowy albo wygasł. Poproś o nowy na ekranie logowania
                („Nie pamiętasz hasła?").
              </p>
              <Button asChild className="w-full">
                <Link href="/login">Przejdź do logowania</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Nowe hasło</Label>
                <Input id="new-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <p className="text-xs text-muted-foreground">Minimum 8 znaków.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Powtórz hasło</Label>
                <Input id="confirm-password" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              {error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Zmień hasło
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
