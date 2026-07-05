import { Sparkles } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-6 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <div className="text-lg font-semibold">{title}</div>
      <p className="text-sm text-muted-foreground">
        {description ?? "This section is being built. It will be available in an upcoming release."}
      </p>
    </div>
  );
}
