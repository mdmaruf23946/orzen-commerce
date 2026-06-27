import { createFileRoute } from "@tanstack/react-router";
import { updateTheme } from "@/lib/admin.functions";
import { SettingsPage } from "@/components/admin/SettingsPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/theme")({
  component: ThemePage,
});

const defaults = {
  header_color: "#ffffff",
  footer_color: "#0f172a",
  title_bar_color: "#0f172a",
  button_color: "#0f172a",
  radius: 8,
};

const colors: { key: keyof typeof defaults; label: string }[] = [
  { key: "header_color", label: "Header Color" },
  { key: "footer_color", label: "Footer Color" },
  { key: "title_bar_color", label: "Product Card Color" },
  { key: "button_color", label: "Primary Button Color" },
];

function ThemePage() {
  return (
    <SettingsPage
      title="Theme Customization"
      description="Storefront appearance. Changes apply instantly via CSS variables."
      column="theme"
      save={updateTheme}
      defaults={defaults}
    >
      {(form, set) => (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {colors.map((c) => (
              <div key={c.key} className="space-y-1.5">
                <Label>{c.label}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(form[c.key] as string) || "#000000"}
                    onChange={(e) => set(c.key, e.target.value as any)}
                    className="h-10 w-14 rounded-md border"
                  />
                  <Input
                    value={(form[c.key] as string) ?? ""}
                    onChange={(e) => set(c.key, e.target.value as any)}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Border Radius — {form.radius}px (0 = square)</Label>
            <input
              type="range"
              min={0}
              max={24}
              step={1}
              value={form.radius}
              onChange={(e) => set("radius", Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
            <div
              className="inline-block px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: form.button_color, borderRadius: `${form.radius}px` }}
            >
              Primary button
            </div>
          </div>
        </div>
      )}
    </SettingsPage>
  );
}
