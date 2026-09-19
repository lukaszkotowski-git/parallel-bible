import { useCallback, useSyncExternalStore } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DEFAULT_ALT, DEFAULT_READ, resolvePair } from "@shared/translations";
import { useUserState } from "@/components/app-header";
import { qk, saveTranslationPrefs, type TranslationDto, type UserStateDto } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";

const READ_KEY = "pb-read";
const ALT_KEY = "pb-alt";
const LEGACY_ALT_KEY = "pb-pl"; // wcześniej: tylko wybór polskiego tłumaczenia
const EVENT = "pb-translations-change";

function readStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || (key === ALT_KEY ? localStorage.getItem(LEGACY_ALT_KEY) : null) || fallback;
  } catch {
    return fallback;
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
 * Para tłumaczeń: „czytam" (ciągły tekst) i „odsłaniam" (po kliknięciu wersetu). Jak motyw:
 * działa bez konta (localStorage), a po zalogowaniu wartości z konta je nadpisują i przenoszą
 * się między urządzeniami. Wybór tego samego tłumaczenia w obu miejscach zamienia je miejscami.
 */
export function useTranslations() {
  const { data: session } = useSession();
  const { data: state } = useUserState();
  const storedRead = useSyncExternalStore(subscribe, () => readStored(READ_KEY, DEFAULT_READ), () => DEFAULT_READ);
  const storedAlt = useSyncExternalStore(subscribe, () => readStored(ALT_KEY, DEFAULT_ALT), () => DEFAULT_ALT);
  const { data: options } = useQuery<TranslationDto[]>({ queryKey: qk.translations, staleTime: 5 * 60_000 });

  const wantedRead = session ? (state?.readTranslation ?? storedRead) : storedRead;
  const wantedAlt = session ? (state?.altTranslation ?? storedAlt) : storedAlt;
  // Zapisany wybór mógł przestać istnieć — resolvePair cofa go do domyślnego.
  const { read, alt } = options
    ? resolvePair(wantedRead, wantedAlt, options.map((t) => t.id))
    : { read: wantedRead, alt: wantedAlt };

  const mutation = useMutation({
    mutationFn: (p: { read: string; alt: string }) => saveTranslationPrefs(p.read, p.alt),
    onMutate: (p) => {
      queryClient.setQueryData<UserStateDto>(qk.state, (old) =>
        old ? { ...old, readTranslation: p.read, altTranslation: p.alt } : old,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.state }),
  });

  const apply = useCallback(
    (next: { read: string; alt: string }) => {
      try {
        localStorage.setItem(READ_KEY, next.read);
        localStorage.setItem(ALT_KEY, next.alt);
      } catch {
        /* tryb prywatny — wybór po prostu nie przetrwa odświeżenia */
      }
      window.dispatchEvent(new Event(EVENT));
      if (session) mutation.mutate(next);
    },
    [session, mutation],
  );

  const setRead = (id: string) => apply({ read: id, alt: id === alt ? read : alt });
  const setAlt = (id: string) => apply({ read: id === read ? alt : read, alt: id });

  const byId = (id: string) => options?.find((t) => t.id === id);
  return {
    read,
    alt,
    readLang: byId(read)?.language,
    altLang: byId(alt)?.language,
    options: options ?? [],
    setRead,
    setAlt,
  };
}
