// Curated preset icon set for main categories (lucide-react).
// Stored in categories.icon_name as a stable key.
import {
  Shirt,
  Watch,
  Gem,
  Sparkles,
  Tag,
  Home,
  Sofa,
  Dumbbell,
  ToyBrick,
  Gift,
  Refrigerator,
  BookOpen,
  Car,
  ShoppingBasket,
  UtensilsCrossed,
  Glasses,
  Music,
  Baby,
  Pill,
  Package,
  Laptop,
  Smartphone,
  Headphones,
  Camera,
  Gamepad2,
  Footprints,
  Flower2,
  PawPrint,
  Wrench,
  Palette,
  Coffee,
  Leaf,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  shirt: Shirt,
  watch: Watch,
  gem: Gem,
  sparkles: Sparkles,
  tag: Tag,
  home: Home,
  sofa: Sofa,
  dumbbell: Dumbbell,
  toys: ToyBrick,
  gift: Gift,
  appliances: Refrigerator,
  book: BookOpen,
  car: Car,
  grocery: ShoppingBasket,
  food: UtensilsCrossed,
  glasses: Glasses,
  music: Music,
  baby: Baby,
  health: Pill,
  package: Package,
  laptop: Laptop,
  phone: Smartphone,
  audio: Headphones,
  camera: Camera,
  gaming: Gamepad2,
  shoes: Footprints,
  beauty: Flower2,
  pets: PawPrint,
  tools: Wrench,
  art: Palette,
  coffee: Coffee,
  organic: Leaf,
};

export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS);

export const MAX_CATEGORY_ICONS = 3;

export function getCategoryIcon(name?: string | null): LucideIcon | null {
  if (!name) return null;
  const first = name.split(",")[0]?.trim();
  if (!first) return null;
  return CATEGORY_ICONS[first] ?? null;
}

/** icon_name stores 1–3 comma-separated preset keys. */
export function parseIconNames(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s in CATEGORY_ICONS)
    .slice(0, MAX_CATEGORY_ICONS);
}

export function serializeIconNames(keys: string[]): string | null {
  const clean = keys.filter((k) => k in CATEGORY_ICONS).slice(0, MAX_CATEGORY_ICONS);
  return clean.length ? clean.join(",") : null;
}
