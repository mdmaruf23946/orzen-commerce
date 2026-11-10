// Shared icon map for landing-page list items (Trust Bar, Benefits, Features,
// Guarantee, Return / Refund, ...). Section content stores an icon NAME; the
// public renderer resolves it to a lucide icon. Unknown names fall back to Check.
import {
  Award, Check, Clock, Gift, Heart, Package, Shield, Sparkles, Star,
  ThumbsUp, Truck, Zap,
} from "lucide-react";

export const LP_ICONS: Record<string, typeof Check> = {
  check: Check,
  star: Star,
  shield: Shield,
  truck: Truck,
  zap: Zap,
  heart: Heart,
  award: Award,
  clock: Clock,
  gift: Gift,
  "thumbs-up": ThumbsUp,
  package: Package,
  sparkles: Sparkles,
};

export function lpIcon(name: unknown): typeof Check {
  return LP_ICONS[String(name ?? "").trim().toLowerCase()] ?? Check;
}
