import {
  Award, Brain, BookOpen, CalendarCheck, CircleCheck, Cross, Crown, Feather, Flame, HeartHandshake,
  Highlighter, Languages, Layers, Mail, Mountain, Moon, Music, Repeat, Scroll, StickyNote, Sunrise, Users,
  type LucideIcon,
} from "lucide-react";

/** Nazwy ikon z katalogu odznak (shared/gamification.ts) → komponenty lucide. */
const ICONS: Record<string, LucideIcon> = {
  Award, Brain, BookOpen, CalendarCheck, CircleCheck, Cross, Crown, Feather, Flame, HeartHandshake,
  Highlighter, Languages, Layers, Mail, Mountain, Moon, Music, Repeat, Scroll, StickyNote, Sunrise, Users,
};

export const badgeIcon = (name: string): LucideIcon => ICONS[name] ?? Award;
