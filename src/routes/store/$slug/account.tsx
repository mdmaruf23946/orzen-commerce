import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  listCustomerOrders,
  listCustomerAddresses,
  upsertCustomerAddress,
  deleteCustomerAddress,
  updateCustomerProfile,
  changeCustomerPassword,
} from "@/lib/customer-auth.functions";
import { useCustomerSession } from "@/lib/customer-session";
import { readWishlist } from "@/lib/wishlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LogOut,
  Package,
  MapPin,
  User,
  KeyRound,
  Trash2,
  Heart,
  ChevronRight,
  Pencil,
  Mail,
  Phone,
  BadgeCheck,
} from "lucide-react";
import { AccountShell } from "@/components/storefront/AccountShell";
import { MyDownloads } from "@/components/storefront/digital/MyDownloads";
import { MySubscriptions } from "@/components/storefront/subscription/MySubscriptions";

function DownloadsTab({ slug, token }: { slug: string; token: string }) {
  return <MyDownloads slug={slug} token={token} />;
}

const TABS = [
  "overview",
  "profile",
  "orders",
  "downloads",
  "services",
  "subscriptions",
  "addresses",
  "wishlist",
  "password",
  "payments",
  "notifications",
  "privacy",
  "support",
] as const;
type Tab = (typeof TABS)[number];



export const Route = createFileRoute("/store/$slug/account")({
  head: () => ({ meta: [{ title: "My account" }] }),
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const t = search.tab;
    return typeof t === "string" && (TABS as readonly string[]).includes(t)
      ? { tab: t as Tab }
      : {};
  },
  component: AccountPage,
});

function AccountPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { customer, isLoading, token, signOut, refresh } = useCustomerSession(slug);
  const tab: Tab = search.tab ?? "overview";
  const setTab = (t: Tab) =>
    navigate({
      to: "/store/$slug/account",
      params: { slug },
      search: t === "overview" ? {} : { tab: t },
      replace: false,
    });

  useEffect(() => {
    if (!isLoading && !customer) {
      navigate({
        to: "/store/$slug/auth/login",
        params: { slug },
        search: { redirect: `/store/${slug}/account${tab === "overview" ? "" : `?tab=${tab}`}` },
      });
    }
  }, [isLoading, customer, navigate, slug, tab]);

  if (!customer || !token) {
    return (
      <AccountShell slug={slug} title="My account">
        <div className="py-10 text-center text-sm text-neutral-500">Loading…</div>
      </AccountShell>
    );
  }

  const titles: Record<Tab, string> = {
    overview: "My account",
    profile: "Personal information",
    orders: "Order history",
    downloads: "My downloads",
    services: "Active services",
    subscriptions: "My subscriptions",
    addresses: "Saved addresses",
    wishlist: "Wishlist",
    password: "Change password",
    payments: "Payment methods",
    notifications: "Notifications",
    privacy: "Privacy & security",
    support: "Help & support",
  };

  return (
    <AccountShell slug={slug} title={titles[tab]}>
      {tab === "overview" ? (
        <Overview
          slug={slug}
          customer={customer}
          onNavigate={setTab}
          onSignOut={signOut}
        />
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setTab("overview")}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            ← Back to account
          </button>
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-6">
            {tab === "profile" && (
              <ProfileTab slug={slug} token={token} customer={customer} onSaved={refresh} />
            )}
            {tab === "orders" && <OrdersPanel slug={slug} token={token} />}
            {tab === "downloads" && <DownloadsTab slug={slug} token={token} />}
            {tab === "services" && <ActiveServicesPanel slug={slug} token={token} />}
            {tab === "subscriptions" && <MySubscriptions slug={slug} token={token} />}
            {tab === "addresses" && <AddressesTab slug={slug} token={token} />}
            {tab === "wishlist" && <WishlistTab slug={slug} />}
            {tab === "password" && <PasswordTab slug={slug} token={token} />}
            {tab === "payments" && <PaymentMethodsPanel slug={slug} token={token} />}
            {tab === "notifications" && <NotificationsPanel slug={slug} token={token} />}
            {tab === "privacy" && (
              <PrivacyPanel slug={slug} onChangePassword={() => setTab("password")} />
            )}
            {tab === "support" && <SupportPanel slug={slug} token={token} />}
          </div>
        </div>
      )}

    </AccountShell>
  );
}

function Overview({
  slug,
  customer,
  onNavigate,
  onSignOut,
}: {
  slug: string;
  customer: { full_name: string; email: string | null; phone: string | null };
  onNavigate: (t: Tab) => void;
  onSignOut: () => void;
}) {
  const initials = customer.full_name
    .split(" ")
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const actions: { id: Tab; label: string; icon: any; hint: string; tone: string }[] = [
    { id: "orders", label: "Orders", icon: Package, hint: "Track & history", tone: "text-indigo-600 bg-indigo-50" },
    { id: "wishlist", label: "Wishlist", icon: Heart, hint: "Saved items", tone: "text-rose-600 bg-rose-50" },
    { id: "addresses", label: "Addresses", icon: MapPin, hint: "Delivery info", tone: "text-emerald-600 bg-emerald-50" },
    { id: "profile", label: "Settings", icon: User, hint: "Personal info", tone: "text-amber-600 bg-amber-50" },
  ];

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm"
        style={{
          background:
            "linear-gradient(135deg, var(--store-btn-bg, #0f172a) 0%, var(--primary, #1e293b) 100%)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/15 text-lg font-bold ring-2 ring-white/20">
            {initials || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-lg font-bold">{customer.full_name}</h2>
              <BadgeCheck className="h-4 w-4 text-white/80" />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/75">
              {customer.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {customer.email}
                </span>
              )}
              {customer.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {customer.phone}
                </span>
              )}
            </div>
            <span className="mt-2 inline-flex rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              Member
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("profile")}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-white/25"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit profile
        </button>
      </div>

      {/* Quick action grid */}
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onNavigate(a.id)}
            className="group flex flex-col items-start gap-2 rounded-2xl border border-black/5 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className={`grid h-9 w-9 place-items-center rounded-xl ${a.tone}`}>
              <a.icon className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="text-sm font-semibold text-neutral-900">{a.label}</div>
              <div className="text-[11px] text-neutral-500">{a.hint}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Settings list */}
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
        <SettingsRow
          icon={User}
          label="Personal information"
          onClick={() => onNavigate("profile")}
        />
        <SettingsRow
          icon={KeyRound}
          label="Change password"
          onClick={() => onNavigate("password")}
        />
        <SettingsRow icon={MapPin} label="Saved addresses" onClick={() => onNavigate("addresses")} />
        <Link
          to="/store/$slug/cart"
          params={{ slug }}
          className="flex items-center gap-3 border-t border-neutral-100 px-4 py-3.5 text-sm hover:bg-neutral-50"
        >
          <Package className="h-4 w-4 text-neutral-500" />
          <span className="flex-1 text-neutral-800">My cart</span>
          <ChevronRight className="h-4 w-4 text-neutral-400" />
        </Link>
      </div>

      <button
        type="button"
        onClick={onSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-600 shadow-sm transition-colors hover:bg-rose-50"
      >
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: any;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3.5 text-left text-sm last:border-b-0 hover:bg-neutral-50"
    >
      <Icon className="h-4 w-4 text-neutral-500" />
      <span className="flex-1 text-neutral-800">{label}</span>
      <ChevronRight className="h-4 w-4 text-neutral-400" />
    </button>
  );
}

function ProfileTab({
  slug,
  token,
  customer,
  onSaved,
}: {
  slug: string;
  token: string;
  customer: { full_name: string; email: string | null; phone: string | null };
  onSaved: () => void;
}) {
  const update = useServerFn(updateCustomerProfile);
  const [name, setName] = useState(customer.full_name);
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await update({
        data: { storeSlug: slug, token, fullName: name, email: email || undefined, phone: phone || undefined },
      });
      toast.success("Profile updated");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Full name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Phone</Label>
        <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

function OrdersTab({ slug, token }: { slug: string; token: string }) {
  const listFn = useServerFn(listCustomerOrders);
  const { data } = useQuery({
    queryKey: ["customer-orders", slug, token],
    queryFn: () => listFn({ data: { storeSlug: slug, token } }),
  });
  const rows = (data ?? []) as any[];
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
        No orders yet.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-neutral-100">
      {rows.map((o) => (
        <li key={o.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <Link
              to="/store/$slug/order/$orderId"
              params={{ slug, orderId: o.id }}
              className="text-sm font-semibold text-neutral-900 hover:underline"
            >
              {o.invoice_no ?? o.id.slice(0, 8)}
            </Link>
            <div className="mt-0.5 text-xs text-neutral-500">
              {new Date(o.created_at).toLocaleDateString()} · {o.status}
            </div>
          </div>
          <div className="text-sm font-bold text-neutral-900">৳{Number(o.subtotal).toFixed(0)}</div>
        </li>
      ))}
    </ul>
  );
}

function AddressesTab({ slug, token }: { slug: string; token: string }) {
  const listFn = useServerFn(listCustomerAddresses);
  const upFn = useServerFn(upsertCustomerAddress);
  const delFn = useServerFn(deleteCustomerAddress);
  const { data, refetch } = useQuery({
    queryKey: ["customer-addresses", slug, token],
    queryFn: () => listFn({ data: { storeSlug: slug, token } }),
  });
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [label, setLabel] = useState("");
  const rows = (data ?? []) as any[];

  async function add() {
    if (!address.trim()) return;
    try {
      await upFn({
        data: {
          storeSlug: slug,
          token,
          address,
          area: area || undefined,
          label: label || undefined,
          isDefault: rows.length === 0,
        },
      });
      setAddress("");
      setArea("");
      setLabel("");
      refetch();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  async function remove(id: string) {
    try {
      await delFn({ data: { storeSlug: slug, token, id } });
      refetch();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  async function setDefault(id: string, current: any) {
    try {
      await upFn({
        data: {
          storeSlug: slug,
          token,
          id,
          address: current.address,
          area: current.area,
          label: current.label,
          isDefault: true,
        },
      });
      refetch();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {rows.map((a) => (
          <li key={a.id} className="rounded-xl border border-neutral-200 p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-neutral-900">
                  {a.label ?? "Address"}{" "}
                  {a.is_default && (
                    <span className="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Default
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-neutral-600">
                  {a.address}
                  {a.area ? `, ${a.area}` : ""}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {!a.is_default && (
                  <Button size="sm" variant="outline" onClick={() => setDefault(a.id, a)}>
                    Set default
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
            No addresses saved.
          </li>
        )}
      </ul>
      <div className="space-y-2 rounded-xl border border-neutral-200 p-3">
        <div className="text-xs font-semibold uppercase text-neutral-500">Add address</div>
        <Input placeholder="Label (Home, Office…)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Textarea placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input placeholder="Area (optional)" value={area} onChange={(e) => setArea(e.target.value)} />
        <Button size="sm" onClick={add} disabled={!address.trim()}>
          Add address
        </Button>
      </div>
    </div>
  );
}

function WishlistTab({ slug }: { slug: string }) {
  const [items, setItems] = useState(() => readWishlist(slug));
  useEffect(() => {
    const sync = () => setItems(readWishlist(slug));
    window.addEventListener("wishlist-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("wishlist-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [slug]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
        Your wishlist is empty. Tap the heart on any product to save it here.
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3">
      {items.map((i) => (
        <li key={i.productId}>
          <Link
            to="/store/$slug/product/$productId"
            params={{ slug, productId: i.productId }}
            className="block overflow-hidden rounded-xl border border-neutral-200 bg-white"
          >
            <div className="aspect-square bg-neutral-100">
              {i.image ? (
                <img src={i.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : null}
            </div>
            <div className="p-2">
              <div className="line-clamp-2 text-xs font-semibold text-neutral-900">{i.name}</div>
              <div className="mt-1 text-sm font-bold text-neutral-900">৳{i.price.toFixed(0)}</div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PasswordTab({ slug, token }: { slug: string; token: string }) {
  const changeFn = useServerFn(changeCustomerPassword);
  const [oldPw, setOld] = useState("");
  const [newPw, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await changeFn({
        data: { storeSlug: slug, token, oldPassword: oldPw, newPassword: newPw },
      });
      toast.success("Password changed");
      setOld("");
      setNew("");
      setConfirm("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Current password</Label>
        <Input type="password" required value={oldPw} onChange={(e) => setOld(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>New password</Label>
        <Input type="password" required minLength={6} value={newPw} onChange={(e) => setNew(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Confirm new password</Label>
        <Input
          type="password"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
