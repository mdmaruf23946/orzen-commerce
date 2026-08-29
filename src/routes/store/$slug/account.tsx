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
import { getMyAccountSummary } from "@/lib/customer-account.functions";
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
  Wrench,
  RefreshCw,
  Download,
  Bell,
  CreditCard,
  ShieldCheck,
  LifeBuoy,
} from "lucide-react";
import { useStoreT } from "@/lib/store-i18n";
import { AccountShell } from "@/components/storefront/AccountShell";
import { MyDownloads } from "@/components/storefront/digital/MyDownloads";
import { MySubscriptions } from "@/components/storefront/subscription/MySubscriptions";
import { OrdersPanel } from "@/components/storefront/account/OrdersPanel";
import {
  ActiveServicesPanel,
  NotificationsPanel,
  PaymentMethodsPanel,
  PrivacyPanel,
  SupportPanel,
} from "@/components/storefront/account/Panels";


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
  const { t } = useStoreT();
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
      <AccountShell>
        <div className="py-10 text-center text-sm text-sf-muted">{t("common.loading")}</div>
      </AccountShell>
    );
  }


  return (
    <AccountShell>
      {tab === "overview" ? (
        <Overview
          slug={slug}
          token={token}
          customer={customer}
          onNavigate={setTab}
          onSignOut={signOut}
        />
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setTab("overview")}
            className="text-xs font-semibold text-sf-ink transition-colors hover:text-sf-accent"
          >
            {t("account.backToAccount")}
          </button>
          <div className="rounded-2xl border border-black/5 bg-sf-card p-4 shadow-sm sm:p-6">
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
  token,
  customer,
  onNavigate,
  onSignOut,
}: {
  slug: string;
  token: string;
  customer: { full_name: string; email: string | null; phone: string | null };
  onNavigate: (t: Tab) => void;
  onSignOut: () => void;
}) {
  const { t } = useStoreT();
  const initials = customer.full_name
    .split(" ")
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const summaryFn = useServerFn(getMyAccountSummary);
  const { data: summary } = useQuery({
    queryKey: ["my-account-summary", slug],
    queryFn: () => summaryFn({ data: { storeSlug: slug, token } }),
  });
  const counts = (summary as any)?.counts ?? {};

  const actions = [
    { id: "orders", label: t("nav.orders"), icon: Package, hint: t("account.ordersHint"), show: true },
    { id: "wishlist", label: t("nav.wishlist"), icon: Heart, hint: t("account.wishlistHint"), show: true },
    { id: "addresses", label: t("account.addresses"), icon: MapPin, hint: t("account.addressesHint"), show: true },
    { id: "services", label: t("account.activeServices"), icon: Wrench, hint: t("account.servicesHint"), show: (counts.services ?? 0) > 0 },
    { id: "subscriptions", label: t("account.subscriptionsLabel"), icon: RefreshCw, hint: t("account.subscriptionsHint"), show: (counts.subscriptions ?? 0) > 0 },
    { id: "downloads", label: t("account.downloads"), icon: Download, hint: t("account.downloadsHint"), show: (counts.downloads ?? 0) > 0 },
    { id: "profile", label: t("account.settings"), icon: User, hint: t("account.settingsHint"), show: true },
  ].filter((a) => a.show) as { id: Tab; label: string; icon: any; hint: string; show: boolean }[];


  return (
    <div className="space-y-4">
      {/* Profile card — multi-colour mesh gradient */}
      <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-purple-500/20 sm:p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500" />
        <div className="absolute -left-10 -top-16 h-48 w-48 rounded-full bg-sky-400/40 blur-3xl" />
        <div className="absolute -bottom-20 right-0 h-52 w-52 rounded-full bg-fuchsia-500/40 blur-3xl" />
        <div className="absolute right-1/3 top-1/2 h-32 w-32 rounded-full bg-blue-400/30 blur-2xl" />

        <div className="relative">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-sf-card/20 text-lg font-extrabold text-white shadow-inner ring-2 ring-white/40 backdrop-blur-md">
              {initials || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-lg font-extrabold tracking-tight drop-shadow-sm">
                  {customer.full_name}
                </h2>
                <BadgeCheck className="h-4 w-4 text-white" />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-medium text-white/90">
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
              <span className="mt-2 inline-flex rounded-full bg-sf-card/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-white/30 backdrop-blur-md">
                {t("account.member")}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("profile")}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-sf-accent px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-sf-accent-hover"
          >
            <Pencil className="h-3.5 w-3.5" /> {t("account.editProfile")}
          </button>
        </div>
      </div>

      {/* Quick action grid */}
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onNavigate(a.id)}
            className="group flex flex-col items-start gap-2 rounded-2xl border border-black/5 bg-sf-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-sf-accent/40 hover:shadow-md"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-sf-accent-soft text-sf-accent">
              <a.icon className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="text-sm font-semibold text-sf-ink">{a.label}</div>
              <div className="text-[11px] text-sf-muted">{a.hint}</div>
            </div>
          </button>
        ))}
      </div>


      {/* Settings list */}
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-sf-card shadow-sm">
        <SettingsRow
          icon={User}
          label={t("account.personalInfo")}
          onClick={() => onNavigate("profile")}
        />
        <SettingsRow
          icon={KeyRound}
          label={t("account.changePassword")}
          onClick={() => onNavigate("password")}
        />
        <SettingsRow icon={MapPin} label={t("account.savedAddresses")} onClick={() => onNavigate("addresses")} />
        <SettingsRow icon={CreditCard} label={t("account.paymentMethods")} onClick={() => onNavigate("payments")} />
        <SettingsRow icon={Bell} label={t("account.notifications")} onClick={() => onNavigate("notifications")} />
        <SettingsRow icon={ShieldCheck} label={t("account.privacySecurity")} onClick={() => onNavigate("privacy")} />
        <SettingsRow icon={LifeBuoy} label={t("account.helpSupport")} onClick={() => onNavigate("support")} />
        <Link
          to="/store/$slug/cart"
          params={{ slug }}
          className="flex items-center gap-3 border-t border-sf-line px-4 py-3.5 text-sm hover:bg-sf-accent-soft"
        >
          <Package className="h-4 w-4 text-sf-accent" />
          <span className="flex-1 text-sf-ink">{t("account.myCart")}</span>
          <ChevronRight className="h-4 w-4 text-sf-muted" />
        </Link>
      </div>

      <button
        type="button"
        onClick={onSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-transparent px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
      >
        <LogOut className="h-4 w-4" /> {t("account.logout")}
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
      className="flex w-full items-center gap-3 border-b border-sf-line px-4 py-3.5 text-left text-sm last:border-b-0 hover:bg-sf-accent-soft"
    >
      <Icon className="h-4 w-4 text-sf-accent" />
      <span className="flex-1 text-sf-ink">{label}</span>
      <ChevronRight className="h-4 w-4 text-sf-muted" />
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
  const { t } = useStoreT();
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
      toast.success(t("account.profileUpdated"));
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
        <Label>{t("common.fullName")}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label>{t("common.email")}</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("common.phone")}</Label>
        <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <Button type="submit" disabled={saving} className="w-full bg-sf-accent text-white hover:bg-sf-accent-hover sm:w-auto">
        {saving ? t("common.saving") : t("account.saveChanges")}
      </Button>
    </form>
  );
}

function OrdersTab({ slug, token }: { slug: string; token: string }) {
  const { t } = useStoreT();
  const listFn = useServerFn(listCustomerOrders);
  const { data } = useQuery({
    queryKey: ["customer-orders", slug, token],
    queryFn: () => listFn({ data: { storeSlug: slug, token } }),
  });
  const rows = (data ?? []) as any[];
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-sf-line p-8 text-center text-sm text-sf-muted">
        {t("account.noOrders")}
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
              className="text-sm font-semibold text-sf-ink hover:underline"
            >
              {o.invoice_no ?? o.id.slice(0, 8)}
            </Link>
            <div className="mt-0.5 text-xs text-sf-muted">
              {new Date(o.created_at).toLocaleDateString()} · {o.status}
            </div>
          </div>
          <div className="text-sm font-bold text-sf-ink">৳{Number(o.subtotal).toFixed(0)}</div>
        </li>
      ))}
    </ul>
  );
}

function AddressesTab({ slug, token }: { slug: string; token: string }) {
  const { t } = useStoreT();
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
          <li key={a.id} className="rounded-xl border border-sf-line p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-sf-ink">
                  {a.label ?? t("account.addressPlaceholder")}{" "}
                  {a.is_default && (
                    <span className="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      {t("account.defaultAddress")}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-sf-muted">
                  {a.address}
                  {a.area ? `, ${a.area}` : ""}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {!a.is_default && (
                  <Button size="sm" variant="outline" className="border-sf-accent text-sf-accent hover:bg-sf-accent-soft hover:text-sf-accent" onClick={() => setDefault(a.id, a)}>
                    {t("account.setDefault")}
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => remove(a.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded-xl border border-dashed border-sf-line p-6 text-center text-sm text-sf-muted">
            {t("account.noAddressesSaved")}
          </li>
        )}
      </ul>
      <div className="space-y-2 rounded-xl border border-sf-line p-3">
        <div className="text-xs font-semibold uppercase text-sf-muted">{t("account.addAddress")}</div>
        <Input placeholder={t("account.addressLabelPlaceholder")} value={label} onChange={(e) => setLabel(e.target.value)} />
        <Textarea placeholder={t("account.addressPlaceholder")} value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input placeholder={t("account.areaOptional")} value={area} onChange={(e) => setArea(e.target.value)} />
        <Button size="sm" className="bg-sf-accent text-white hover:bg-sf-accent-hover" onClick={add} disabled={!address.trim()}>
          {t("account.addAddress")}
        </Button>
      </div>
    </div>
  );
}

function WishlistTab({ slug }: { slug: string }) {
  const { t } = useStoreT();
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
      <div className="rounded-xl border border-dashed border-sf-line p-8 text-center text-sm text-sf-muted">
        {t("account.wishlistEmpty")}
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
            className="block overflow-hidden rounded-xl border border-sf-line bg-sf-card"
          >
            <div className="aspect-square bg-sf-surface">
              {i.image ? (
                <img src={i.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : null}
            </div>
            <div className="p-2">
              <div className="line-clamp-2 text-xs font-semibold text-sf-ink">{i.name}</div>
              <div className="mt-1 text-sm font-bold text-sf-ink">৳{i.price.toFixed(0)}</div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PasswordTab({ slug, token }: { slug: string; token: string }) {
  const { t } = useStoreT();
  const changeFn = useServerFn(changeCustomerPassword);
  const [oldPw, setOld] = useState("");
  const [newPw, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirm) {
      toast.error(t("account.passwordsNoMatch"));
      return;
    }
    setSaving(true);
    try {
      await changeFn({
        data: { storeSlug: slug, token, oldPassword: oldPw, newPassword: newPw },
      });
      toast.success(t("account.passwordChanged"));
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
        <Label>{t("auth.currentPassword")}</Label>
        <Input type="password" required value={oldPw} onChange={(e) => setOld(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("auth.newPassword")}</Label>
        <Input type="password" required minLength={6} value={newPw} onChange={(e) => setNew(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("account.confirmNewPassword")}</Label>
        <Input
          type="password"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={saving} className="w-full bg-sf-accent text-white hover:bg-sf-accent-hover sm:w-auto">
        {saving ? t("common.saving") : t("account.changePassword")}
      </Button>
    </form>
  );
}
