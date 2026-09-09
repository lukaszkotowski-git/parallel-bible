import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { Brand } from "@/components/brand";
import { ProgressRing } from "@/components/progress-ring";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { qk, saveTheme, type UserStateDto } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export function useUserState() {
  return useQuery<UserStateDto>({ queryKey: qk.state, staleTime: 0 });
}

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const { data: state, isLoading } = useUserState();
  const theme = state?.theme ?? "light";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
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

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-6">
        <Brand />
        <div className="flex-1">{children}</div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label={theme === "dark" ? "Włącz tryb jasny" : "Włącz tryb ciemny"}
              onClick={() => themeMutation.mutate(theme === "dark" ? "light" : "dark")}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Tryb {theme === "dark" ? "jasny" : "ciemny"}</TooltipContent>
        </Tooltip>

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
      </div>
    </header>
  );
}
