import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { CelebrationHost } from "@/components/celebration-dialog";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import BookPage from "@/pages/book";
import ReadPage from "@/pages/read";
import { type ComponentType, lazy, Suspense, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { invalidateUserState } from "@/lib/api";
import { aroundNav } from "@/lib/view-transition";
import NotFound from "@/pages/not-found";

/**
 * Strona ładowana osobnym kawałkiem JS. Ścieżka czytania (start, księga, rozdział) jest w głównej
 * paczce; reszta dociąga się w tle po starcie (`preloadPages`). Po załadowaniu renderujemy moduł
 * wprost, bez zawieszenia — nawigacja idzie przez flushSync w View Transition (`aroundNav`), więc
 * zawieszony `lazy` trafiłby do zrzutu jako pusty ekran. `Suspense` łapie tylko wejście z adresu,
 * zanim kawałek zdąży przyjść.
 */
function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  let Loaded: ComponentType | null = null;
  const preload = () =>
    load().then((m) => {
      Loaded = m.default;
      return m;
    });
  const Lazy = lazy(preload);
  const Page = () => (Loaded ? <Loaded /> : <Lazy />);
  Page.preload = preload;
  return Page;
}

const LoginPage = lazyPage(() => import("@/pages/login"));
const ResetPasswordPage = lazyPage(() => import("@/pages/reset-password"));
const PlansPage = lazyPage(() => import("@/pages/plans"));
const StatsPage = lazyPage(() => import("@/pages/stats"));
const NotesPage = lazyPage(() => import("@/pages/notes"));
const BadgesPage = lazyPage(() => import("@/pages/badges"));
const LearnPage = lazyPage(() => import("@/pages/learn"));
const LeaderboardPage = lazyPage(() => import("@/pages/leaderboard"));
const GroupsPage = lazyPage(() => import("@/pages/groups").then((m) => ({ default: m.GroupsPage })));
const GroupJoinPage = lazyPage(() => import("@/pages/groups").then((m) => ({ default: m.GroupJoinPage })));
const GroupDetailPage = lazyPage(() => import("@/pages/groups").then((m) => ({ default: m.GroupDetailPage })));
const AdminPage = lazyPage(() => import("@/pages/admin"));

const LAZY_PAGES = [
  LoginPage,
  ResetPasswordPage,
  PlansPage,
  StatsPage,
  NotesPage,
  BadgesPage,
  LearnPage,
  LeaderboardPage,
  GroupsPage,
  GroupJoinPage,
  GroupDetailPage,
  AdminPage,
];

/** Po pierwszym renderze, gdy przeglądarka odpocznie, dociągamy resztę stron — kliknięcie ich nie czeka. */
function usePreloadPages() {
  useEffect(() => {
    const run = () => {
      for (const page of LAZY_PAGES) page.preload().catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(run, 2000);
    return () => clearTimeout(t);
  }, []);
}

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
  usePreloadPages();
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={LoginPage} />
        <Route path="/reset-hasla" component={ResetPasswordPage} />
        <Route path="/plany" component={PlansPage} />
        <Route path="/statystyki" component={StatsPage} />
        <Route path="/notatki" component={NotesPage} />
        <Route path="/odznaki" component={BadgesPage} />
        <Route path="/nauka" component={LearnPage} />
        <Route path="/ranking" component={LeaderboardPage} />
        <Route path="/grupy" component={GroupsPage} />
        <Route path="/grupy/dolacz/:code" component={GroupJoinPage} />
        <Route path="/grupy/:id" component={GroupDetailPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/ksiega/:book" component={BookPage} />
        <Route path="/czytaj/:book/:chapter" component={ReadPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
        <CelebrationHost />
        <AuthLinkNotices />
        <Router hook={useHashLocation} aroundNav={aroundNav}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
