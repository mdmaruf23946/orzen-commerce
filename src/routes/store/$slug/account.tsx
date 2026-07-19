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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, Package, MapPin, User, KeyRound, Trash2 } from "lucide-react";

export const Route = createFileRoute("/store/$slug/account")({
  head: () => ({ meta: [{ title: "My account" }] }),
  component: AccountPage,
});

type Tab = "profile" | "orders" | "addresses" | "password";

function AccountPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { customer, isLoading, token, signOut, refresh } = useCustomerSession(slug);
  const [tab, setTab] = useState<Tab>("profile");

  useEffect(() => {
    if (!isLoading && !customer) {
      navigate({
        to: "/store/$slug/auth/login",
        params: { slug },
        search: { redirect: `/store/${slug}/account` },
      });
    }
  }, [isLoading, customer, navigate, slug]);

  if (!customer || !token) return <div className="py-10 text-center text-sm">Loading…</div>;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "orders", label: "Orders", icon: Package },
    { id: "addresses", label: "Addresses", icon: MapPin },
    { id: "password", label: "Password", icon: KeyRound },
  ];

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Hi, {customer.full_name}</h1>
          <p className="text-xs text-muted-foreground">{customer.email ?? customer.phone}</p>
        </div>
        <Button size="sm" variant="outline" onClick={signOut}>
          <LogOut className="mr-1.5 h-4 w-4" /> Sign out
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <nav className="flex overflow-x-auto rounded-lg border bg-card p-2 sm:flex-col">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm ${
                tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="rounded-lg border bg-card p-4">
          {tab === "profile" && (
            <ProfileTab
              slug={slug}
              token={token}
              customer={customer}
              onSaved={refresh}
            />
          )}
          {tab === "orders" && <OrdersTab slug={slug} token={token} />}
          {tab === "addresses" && <AddressesTab slug={slug} token={token} />}
          {tab === "password" && <PasswordTab slug={slug} token={token} />}
        </div>
      </div>
    </div>
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
      <h2 className="text-sm font-semibold">Profile</h2>
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
      <Button type="submit" disabled={saving}>
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
  return (
    <div>
      <h2 className="text-sm font-semibold">Order history</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No orders yet.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {rows.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link
                  to="/store/$slug/order/$orderId"
                  params={{ slug, orderId: o.id }}
                  className="text-sm font-medium hover:underline"
                >
                  {o.invoice_no ?? o.id.slice(0, 8)}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString()} · {o.status}
                </div>
              </div>
              <div className="text-sm font-semibold">৳{Number(o.subtotal).toFixed(0)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
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
      await upFn({ data: { storeSlug: slug, token, address, area: area || undefined, label: label || undefined, isDefault: rows.length === 0 } });
      setAddress(""); setArea(""); setLabel("");
      refetch();
    } catch (err) { toast.error((err as Error).message); }
  }
  async function remove(id: string) {
    try { await delFn({ data: { storeSlug: slug, token, id } }); refetch(); }
    catch (err) { toast.error((err as Error).message); }
  }
  async function setDefault(id: string, current: any) {
    try {
      await upFn({ data: { storeSlug: slug, token, id, address: current.address, area: current.area, label: current.label, isDefault: true } });
      refetch();
    } catch (err) { toast.error((err as Error).message); }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold">Saved addresses</h2>
      <ul className="mt-3 space-y-2">
        {rows.map((a) => (
          <li key={a.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{a.label ?? "Address"} {a.is_default && <span className="ml-1 rounded bg-emerald-100 px-1.5 text-xs text-emerald-700">Default</span>}</div>
                <div className="text-muted-foreground">{a.address}{a.area ? `, ${a.area}` : ""}</div>
              </div>
              <div className="flex flex-col gap-1">
                {!a.is_default && <Button size="sm" variant="outline" onClick={() => setDefault(a.id, a)}>Set default</Button>}
                <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2 rounded-md border p-3">
        <div className="text-xs font-semibold uppercase text-muted-foreground">Add address</div>
        <Input placeholder="Label (Home, Office…)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Textarea placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input placeholder="Area (optional)" value={area} onChange={(e) => setArea(e.target.value)} />
        <Button size="sm" onClick={add} disabled={!address.trim()}>Add</Button>
      </div>
    </div>
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
    if (newPw !== confirm) { toast.error("Passwords do not match"); return; }
    setSaving(true);
    try {
      await changeFn({ data: { storeSlug: slug, token, oldPassword: oldPw, newPassword: newPw } });
      toast.success("Password changed");
      setOld(""); setNew(""); setConfirm("");
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="text-sm font-semibold">Change password</h2>
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
        <Input type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Change password"}</Button>
    </form>
  );
}
