import { Mail, Phone, MessageCircle } from "lucide-react";

function waNumber(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("0") ? "88" + d : d;
}

/** Phone + email with one-tap Call / WhatsApp / Email links for Winner Admin. */
export function ContactLinks({ phone, email }: { phone?: string | null; email?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {phone ? (
        <div className="flex items-center gap-2">
          <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
            <Phone className="h-3 w-3" />{phone}
          </a>
          <a href={`https://wa.me/${waNumber(phone)}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground" title="WhatsApp">
            <MessageCircle className="h-3 w-3" />WA
          </a>
        </div>
      ) : (
        <span className="text-muted-foreground">No mobile</span>
      )}
      {email && (
        <a href={`mailto:${email}`} className="inline-flex items-center gap-1 truncate text-muted-foreground hover:underline">
          <Mail className="h-3 w-3" />{email}
        </a>
      )}
    </div>
  );
}
