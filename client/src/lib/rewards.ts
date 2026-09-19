import { useSyncExternalStore } from "react";
import { queryClient } from "./queryClient";
import { BADGE_BY_ID, LEVELS } from "@shared/gamification";
import type { BadgeDef, ProgressDto, RewardDto } from "@shared/gamification";
import { fetchProgress, qk } from "./api";

/** Jedno osiągnięcie do pokazania w oknie gratulacji (jedna akcja może dać kilka rzeczy naraz). */
export interface Celebration {
  id: number;
  badges: BadgeDef[];
  level?: { level: number; name: string };
  goal?: { chapters: number };
}

let queue: Celebration[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

function push(c: Omit<Celebration, "id">) {
  queue = [...queue, { ...c, id: nextId++ }];
  emit();
}

/** Zamyka bieżące okno; jeśli w kolejce czeka następne, pokaże się od razu. */
export function dismissCelebration() {
  queue = queue.slice(1);
  emit();
}

/** Bieżące osiągnięcie do pokazania (pierwsze z kolejki) albo `undefined`. */
export function useCelebration(): Celebration | undefined {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => queue[0],
    () => undefined,
  );
}

/**
 * Okno gratulacji za osiągnięcia: nowe odznaki, awans na kolejny poziom i wypełnienie dziennego celu.
 * Odznaki i poziom wracają z serwera w odpowiedzi na akcję, która je odblokowała; awans wykrywamy
 * porównując z poziomem z cache'u (zanim zostanie odświeżony), a cel dnia — porównując licznik
 * dzisiejszych rozdziałów przed akcją i po niej. Wszystko trafia do jednego okna na akcję.
 */
export function announceReward(reward: Partial<RewardDto> | null | undefined) {
  if (!reward) return;
  const prev = queryClient.getQueryData<ProgressDto>(qk.progress);

  const badges = (reward.newBadges ?? []).map((id) => BADGE_BY_ID[id]).filter((b): b is BadgeDef => !!b);
  const lvl =
    prev && reward.level !== undefined && reward.level > prev.level.level ? LEVELS[reward.level - 1] : undefined;
  const level = lvl ? { level: lvl.level, name: lvl.name } : undefined;

  queryClient.invalidateQueries({ queryKey: qk.badges });
  // Świeży postęp odświeża też paski i pierścienie w UI; przy okazji sprawdzamy, czy cel dnia właśnie padł.
  queryClient
    .fetchQuery({ queryKey: qk.progress, queryFn: fetchProgress, staleTime: 0 })
    .then((next) => {
      const goalReached =
        !!prev && prev.goal.todayCount < prev.goal.dailyChapters && next.goal.todayCount >= next.goal.dailyChapters;
      return goalReached ? { chapters: next.goal.dailyChapters } : undefined;
    })
    .catch(() => undefined)
    .then((goal) => {
      if (badges.length > 0 || level || goal) push({ badges, level, goal });
    });
}
