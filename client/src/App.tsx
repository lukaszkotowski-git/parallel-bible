import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import BookPage from "@/pages/book";
import ReadPage from "@/pages/read";
import PlansPage from "@/pages/plans";
import StatsPage from "@/pages/stats";
import NotesPage from "@/pages/notes";
import LoginPage from "@/pages/login";
import ResetPasswordPage from "@/pages/reset-password";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { invalidateUserState } from "@/lib/api";
import NotFound from "@/pages/not-found";

/**
 * Wynik kliknięcia linku z maila weryfikacyjnego wraca jako `/?verified=1` (sukces) albo
 * `/?error=…` (link wygasł/zużyty) — parametr stoi przed hashem. Pokazujemy toast i sprzątamy
 * adres. Reset hasła ma własną stronę, która sama czyta `?token` i `?error`.
 */
function AuthLinkNotices() {
  const { toast } = useToast();
  useEffect(() => {
    if (window.location.hash.startsWith("#/reset-hasla")) return;
    const params = new URLSearchParams(window.location.search);
    const verified = params.has("verified");
    const failed = params.has("error");
    if (!verified && !failed) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
    if (verified) {
      invalidateUserState();
      toast({ title: "Adres e-mail potwierdzony", description: "Konto jest aktywne — możesz zapisywać postęp.", duration: 6000 });
    } else {
      toast({
        title: "Link jest nieprawidłowy lub wygasł",
        description: "Zaloguj się — wyślemy nowy link potwierdzający.",
        variant: "destructive",
        duration: 8000,
      });
    }
  }, [toast]);
  return null;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={LoginPage} />
      <Route path="/reset-hasla" component={ResetPasswordPage} />
      <Route path="/plany" component={PlansPage} />
      <Route path="/statystyki" component={StatsPage} />
      <Route path="/notatki" component={NotesPage} />
      <Route path="/ksiega/:book" component={BookPage} />
      <Route path="/czytaj/:book/:chapter" component={ReadPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        {/* Routing jest hash-owy, więc zwykłe href="#main" zmieniłoby trasę — fokusujemy ręcznie. */}
        <button type="button" className="skip-link" onClick={() => document.getElementById("main")?.focus()}>
          Przejdź do treści
        </button>
        <Toaster />
        <AuthLinkNotices />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
