import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Award, BarChart3, CalendarCheck, Layers, LogIn, Trophy, Users, ShieldCheck, LogOut, Moon, StickyNote, Sun } from "lucide-react";
import { Brand } from "@/components/brand";
import { SupportButton } from "@/components/support-dialog";
import { ProgressRing } from "@/components/progress-ring";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { clearUserState, qk, saveTheme, type UserStateDto } from "@/lib/api";
import { signOut, useSession } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";

/**
 * Stan użytkownika istnieje tylko dla zalogowanych — bez sesji zapytanie
 * w ogóle nie startuje (inaczej /api/me/state zwracałoby 401 przy każdym wejściu).
 */
export function useUserState() {
  const { data: session } = useSession();
  return useQuery<UserStateDto>({ queryKey: qk.state, staleTime: 0, enabled: !!session });
}

/** Czy wolno zapisywać postęp. `pending` = sesja jeszcze się sprawdza. */
export function useAuthed() {
  const { data: session, isPending } = useSession();
  return { authed: !!session, pending: isPending, user: session?.user };
}

const THEME_KEY = "pb-theme";

function readStoredTheme(): "light" | "dark" {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Motyw ma działać także przed zalogowaniem, więc źródłem prawdy jest
 * localStorage; konto tylko go nadpisuje i przenosi między urządzeniami.
 */
function useTheme() {
  const { data: session } = useSession();
  const { data: state } = useUserState();
  const [stored, setStored] = useState<"light" | "dark">(readStoredTheme);
  const theme = session ? (state?.theme ?? stored) : stored;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* tryb prywatny — motyw po prostu nie przetrwa odświeżenia */
    }
  }, [theme]);

  const themeMutation = useMutation({
    mutationFn: (next: "light" | "dark") => saveTheme(next),
    onMutate: (next) => {
      queryClient.setQueryData<UserStateDto>(qk.state, (old) =>
        old ? { ...old, theme: next } : old,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.state }),
  });

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setStored(next);
    if (session) themeMutation.mutate(next);
  };

  return { theme, toggle };
}

function initials(nameOrEmail: string) {
  const base = nameOrEmail.trim();
  if (!base) return "?";
  const parts = base.split(/[\s.@_-]+/).filter(Boolean);
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

function AccountMenu() {
  const { user } = useAuthed();
  const { data: state } = useUserState();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/15"
          aria-label="Menu konta"
          data-testid="button-account"
        >
          {initials(user.name || user.email)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/plany" data-testid="link-plans"><CalendarCheck className="mr-2 h-4 w-4" /> Plany czytania</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/odznaki" data-testid="link-badges"><Award className="mr-2 h-4 w-4" /> Postępy i odznaki</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/nauka" data-testid="link-learn"><Layers className="mr-2 h-4 w-4" /> Nauka wersetów</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/ranking" data-testid="link-leaderboard"><Trophy className="mr-2 h-4 w-4" /> Ranking</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/grupy" data-testid="link-groups"><Users className="mr-2 h-4 w-4" /> Grupy</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/statystyki" data-testid="link-stats"><BarChart3 className="mr-2 h-4 w-4" /> Statystyki</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/notatki" data-testid="link-notes"><StickyNote className="mr-2 h-4 w-4" /> Moje notatki</Link>
        </DropdownMenuItem>
        {state?.role === "admin" && (
          <DropdownMenuItem asChild>
            <Link href="/admin" data-testid="link-admin"><ShieldCheck className="mr-2 h-4 w-4" /> Panel administratora</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            clearUserState();
          }}
          data-testid="button-logout"
        >
          <LogOut className="mr-2 h-4 w-4" /> Wyloguj
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const { authed, pending } = useAuthed();
  const { data: state, isLoading } = useUserState();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-3xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Brand />
        <div className="flex-1">{children}</div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label={theme === "dark" ? "Włącz tryb jasny" : "Włącz tryb ciemny"}
              onClick={toggle}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Tryb {theme === "dark" ? "jasny" : "ciemny"}</TooltipContent>
        </Tooltip>

        <SupportButton variant="icon" />

        {/* Ranking widoczny dla każdego; bez konta strona pokaże zaproszenie do logowania. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" className="h-9 w-9">
              <Link href="/ranking" aria-label="Ranking czytelników" data-testid="link-header-leaderboard">
                <Trophy className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ranking</TooltipContent>
        </Tooltip>

        {pending ? (
          <Skeleton className="h-9 w-9 rounded-full" />
        ) : !authed ? (
          <Button asChild size="sm" data-testid="button-login">
            <Link href="/login">
              <LogIn className="mr-1.5 h-4 w-4" /> Zaloguj
            </Link>
          </Button>
        ) : (
          <>
            {isLoading ? (
              <Skeleton className="h-11 w-11 rounded-full" />
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="button-progress"
                  >
                    <ProgressRing
                      percent={state?.percent ?? 0}
                      label={`Przeczytane ${state?.readCount ?? 0} z ${state?.totalChapters ?? 0} rozdziałów`}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  Przeczytane {state?.readCount ?? 0} z {state?.totalChapters ?? 0} rozdziałów
                </TooltipContent>
              </Tooltip>
            )}
            <AccountMenu />
          </>
        )}
      </div>
    </header>
  );
}
