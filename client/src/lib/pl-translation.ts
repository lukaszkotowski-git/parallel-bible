import { useCallback, useSyncExternalStore } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useUserState } from "@/components/app-header";
import { qk, savePlTranslation, type TranslationDto, type UserStateDto } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";

const KEY = "pb-pl";
const DEFAULT_ID = "BG";
const EVENT = "pb-pl-change";

function readStored(): string {
  try {
    return localStorage.getItem(KEY) || DEFAULT_ID;
  } catch {
    return DEFAULT_ID;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * Wybrane tłumaczenie polskie. Jak motyw: działa bez konta (localStorage `pb-pl`),
 * a po zalogowaniu wartość z konta ją nadpisuje i przenosi się między urządzeniami.
 */
export function usePlTranslation() {
  const { data: session } = useSession();
  const { data: state } = useUserState();
  const stored = useSyncExternalStore(subscribe, readStored, () => DEFAULT_ID);
  const { data: options } = useQuery<TranslationDto[]>({ queryKey: qk.translations, staleTime: 5 * 60_000 });

  // Zapisany wybór mógł przestać istnieć (np. tłumaczenie wycofane) — wtedy wracamy do domyślnego.
  const wanted = session ? (state?.plTranslation ?? stored) : stored;
  const id = options && !options.some((t) => t.id === wanted) ? DEFAULT_ID : wanted;

  const mutation = useMutation({
    mutationFn: (next: string) => savePlTranslation(next),
    onMutate: (next) => {
      queryClient.setQueryData<UserStateDto>(qk.state, (old) => (old ? { ...old, plTranslation: next } : old));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.state }),
  });

  const select = useCallback(
    (next: string) => {
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* tryb prywatny — wybór po prostu nie przetrwa odświeżenia */
      }
      window.dispatchEvent(new Event(EVENT));
      if (session) mutation.mutate(next);
    },
    [session, mutation],
  );

  return { id, options: options ?? [], select };
}
