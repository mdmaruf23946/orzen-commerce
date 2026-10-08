import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { resolveMediaSrc } from "@/lib/profile-media-templates";

export function accountAvatarSrc(value: string | null | undefined) {
  return resolveMediaSrc(value);
}

function accountInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase()).join("") || "A";
}

export function AccountAvatar({ name, avatarUrl, className }: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("h-9 w-9 border", className)}>
      <AvatarImage src={accountAvatarSrc(avatarUrl)} alt={name} className="object-cover" />
      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
        {accountInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}