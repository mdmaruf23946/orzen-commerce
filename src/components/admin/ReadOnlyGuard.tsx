import { useRef, type ReactNode } from "react";
import { toast } from "sonner";

/**
 * Blocks mutating interactions for employees who only have "view" access to
 * the current section. Wraps the page content and intercepts clicks in the
 * capture phase, so add/edit/delete buttons never open their forms.
 */

const MUTATE_WORDS = [
  "add", "new", "create", "edit", "update", "save", "delete", "remove", "trash",
  "publish", "unpublish", "duplicate", "import", "upload", "send", "assign",
  "approve", "reject", "refund", "cancel order", "connect", "disconnect",
  "generate", "invite", "reset", "restore", "apply", "activate", "deactivate",
  "enable", "disable", "sync", "retry", "mark ", "confirm", "submit", "verify",
  "add fund", "top up", "renew", "upgrade plan", "bulk",
];

function textOf(el: Element): string {
  const aria = el.getAttribute("aria-label") ?? "";
  const title = el.getAttribute("title") ?? "";
  return `${el.textContent ?? ""} ${aria} ${title}`.toLowerCase().trim();
}

function isMutatingTarget(start: HTMLElement): boolean {
  let el: HTMLElement | null = start;
  for (let i = 0; el && i < 6; i++, el = el.parentElement) {
    if (el.dataset?.["allowReadonly"] !== undefined) return false;

    const role = el.getAttribute("role");
    const tag = el.tagName.toLowerCase();
    const isButtonish =
      tag === "button" ||
      role === "button" ||
      role === "menuitem" ||
      role === "switch" ||
      (tag === "input" && ["submit", "checkbox", "radio"].includes((el as HTMLInputElement).type));

    if (!isButtonish) continue;
    if (role === "combobox" || role === "tab") return false;
    if (el.closest("[data-allow-readonly]")) return false;
    if (role === "switch" || (tag === "input" && (el as HTMLInputElement).type !== "submit")) return true;
    if ((el as HTMLButtonElement).type === "submit") return true;

    const text = textOf(el);
    if (!text) return false; // unlabeled icon buttons (close, expand, nav) stay usable
    return MUTATE_WORDS.some((w) => text.includes(w));
  }
  return false;
}

export function ReadOnlyGuard({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const last = useRef(0);

  if (!active) return <>{children}</>;

  function deny(e: React.SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.nativeEvent as any)?.stopImmediatePropagation?.();
    const now = Date.now();
    if (now - last.current > 1200) {
      last.current = now;
      toast.error("You don't have permission for this action.");
    }
  }

  function onCapture(e: React.MouseEvent | React.KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
    if (isMutatingTarget(target)) deny(e);
  }

  return (
    <div
      onClickCapture={onCapture}
      onPointerDownCapture={(e) => {
        const t = e.target as HTMLElement | null;
        if (t && isMutatingTarget(t)) deny(e);
      }}
      onKeyDownCapture={onCapture}
      onSubmitCapture={deny}
      className="contents"
    >
      {children}
    </div>
  );
}
