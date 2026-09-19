/**
 * Pytanie „jak Ci się podoba aplikacja?" (zachęta do dobrowolnego wsparcia).
 * Pokazujemy je po każdych 15 przeczytanych rozdziałach; kto zaznaczy „przypominaj rzadziej",
 * dostaje je co 77. Stan trzymamy w koncie, więc nie wraca po zmianie urządzenia ani po wyczyszczeniu
 * przeglądarki. Liczą się tylko rozdziały „counted" (przeczytane z sensownym czasem).
 */
import { prisma } from "./db";
import { NUDGE_EVERY, NUDGE_EVERY_RARE } from "@shared/gamification";


const countRead = (userId: string) => prisma.readChapter.count({ where: { userId, counted: true } });

/** Zwraca liczbę przeczytanych rozdziałów, gdy pora zapytać; w przeciwnym razie null. */
export async function nudgeDue(userId: string): Promise<{ chapters: number } | null> {
  const [user, chapters] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { nudgeAt: true, nudgeRare: true } }),
    countRead(userId),
  ]);
  if (!user) return null;
  const interval = user.nudgeRare ? NUDGE_EVERY_RARE : NUDGE_EVERY;
  return chapters >= user.nudgeAt + interval ? { chapters } : null;
}

/** Odpowiedź (albo zamknięcie okna): zapamiętujemy, kiedy pytaliśmy, i wybór częstotliwości. */
export async function nudgeAnswered(userId: string, rare: boolean) {
  const chapters = await countRead(userId);
  await prisma.user.update({ where: { id: userId }, data: { nudgeAt: chapters, nudgeRare: rare } });
}
