import { toast } from "@/hooks/use-toast";
import { queryClient } from "./queryClient";
import { BADGE_BY_ID, LEVELS } from "@shared/gamification";
import type { ProgressDto, RewardDto } from "@shared/gamification";
import { qk } from "./api";

/**
 * Spokojna „celebracja": zwykły toast bez animacji i fajerwerków.
 * Odznaki i awans wracają z serwera w odpowiedzi na akcję, która je odblokowała;
 * awans wykrywamy porównując z poziomem z cache'u (zanim zostanie odświeżony).
 */
export function announceReward(reward: Partial<RewardDto> | null | undefined) {
  if (!reward) return;
  const prevLevel = queryClient.getQueryData<ProgressDto>(qk.progress)?.level.level;

  const badges = (reward.newBadges ?? []).map((id) => BADGE_BY_ID[id]).filter((b) => !!b);
  if (badges.length > 0) {
    // Jeden toast na akcję, nawet gdy odblokowała kilka odznak naraz.
    toast({
      title: badges.length === 1 ? `Nowa odznaka: ${badges[0]!.name}` : `Nowe odznaki: ${badges.map((b) => b!.name).join(", ")}`,
      description: badges.length === 1 ? badges[0]!.description : undefined,
      duration: 6000,
    });
  }
  if (prevLevel !== undefined && reward.level !== undefined && reward.level > prevLevel) {
    const lvl = LEVELS[reward.level - 1];
    if (lvl) toast({ title: `Nowy poziom: ${lvl.name}`, description: `Poziom ${lvl.level}. Tak trzymaj.`, duration: 6000 });
  }
  queryClient.invalidateQueries({ queryKey: qk.progress });
  queryClient.invalidateQueries({ queryKey: qk.badges });
}
