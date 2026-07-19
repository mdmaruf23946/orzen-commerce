// Public server functions for per-store customer authentication.
// Each store has its own isolated customer namespace; sessions carry a
// (store_id, token) pair so a token minted for one store cannot be
// replayed against another.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slugSchema = z.string().min(1).max(120);
const tokenSchema = z.string().min(16).max(128);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function resolveStore(slug: string) {
  const sb = await admin();
  const { data } = await sb.from("stores").select("id,status").eq("slug", slug).maybeSingle();
  if (!data || data.status !== "active") throw new Error("Store unavailable");
  return data.id as string;
}

export const signupCustomer = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        storeSlug: slugSchema,
        fullName: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255).optional().or(z.literal("")),
        phone: z.string().trim().max(40).optional().or(z.literal("")),
        password: z.string().min(6).max(200),
        confirmPassword: z.string().min(6).max(200),
      })
      .refine((v) => v.password === v.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
      })
      .refine((v) => (v.email && v.email.length) || (v.phone && v.phone.length), {
        message: "Email or phone is required",
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const storeId = await resolveStore(data.storeSlug);
    const sb = await admin();
    const { data: res, error } = await sb.rpc("customer_signup", {
      _store_id: storeId,
      _name: data.fullName,
      _email: data.email || null,
      _phone: data.phone || null,
      _password: data.password,
    } as any);
    if (error) throw new Error(error.message);
    const r = res as any;
    if (!r?.ok) throw new Error(r?.error ?? "Signup failed");
    return { token: r.token as string, customer: r.customer };
  });

export const loginCustomer = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        storeSlug: slugSchema,
        identifier: z.string().trim().min(1).max(255),
        password: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const storeId = await resolveStore(data.storeSlug);
    const sb = await admin();
    const { data: res, error } = await sb.rpc("customer_login", {
      _store_id: storeId,
      _identifier: data.identifier,
      _password: data.password,
    } as any);
    if (error) throw new Error(error.message);
    const r = res as any;
    if (!r?.ok) throw new Error(r?.error ?? "Login failed");
    return { token: r.token as string, customer: r.customer };
  });

export const logoutCustomer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    await sb.rpc("customer_logout", { _token: data.token } as any);
    return { ok: true };
  });

export const getCurrentCustomer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ storeSlug: slugSchema, token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const storeId = await resolveStore(data.storeSlug);
    const sb = await admin();
    const { data: res } = await sb.rpc("customer_from_token", {
      _token: data.token,
      _store_id: storeId,
    } as any);
    if (!res) return null;
    return res as any;
  });

async function requireCustomer(storeSlug: string, token: string) {
  const storeId = await resolveStore(storeSlug);
  const sb = await admin();
  const { data } = await sb.rpc("customer_from_token", {
    _token: token,
    _store_id: storeId,
  } as any);
  if (!data) throw new Error("Not signed in");
  return { sb, storeId, customer: data as any };
}

export const updateCustomerProfile = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        storeSlug: slugSchema,
        token: tokenSchema,
        fullName: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255).optional().or(z.literal("")),
        phone: z.string().trim().max(40).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const storeId = await resolveStore(data.storeSlug);
    const sb = await admin();
    const { data: res, error } = await sb.rpc("customer_update_profile", {
      _token: data.token,
      _store_id: storeId,
      _name: data.fullName,
      _email: data.email || null,
      _phone: data.phone || null,
    } as any);
    if (error) throw new Error(error.message);
    const r = res as any;
    if (!r?.ok) throw new Error(r?.error ?? "Update failed");
    return { ok: true };
  });

export const changeCustomerPassword = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        storeSlug: slugSchema,
        token: tokenSchema,
        oldPassword: z.string().min(1),
        newPassword: z.string().min(6).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const storeId = await resolveStore(data.storeSlug);
    const sb = await admin();
    const { data: res, error } = await sb.rpc("customer_change_password", {
      _token: data.token,
      _store_id: storeId,
      _old: data.oldPassword,
      _new: data.newPassword,
    } as any);
    if (error) throw new Error(error.message);
    const r = res as any;
    if (!r?.ok) throw new Error(r?.error ?? "Change failed");
    return { ok: true };
  });

export const listCustomerOrders = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ storeSlug: slugSchema, token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const { sb, storeId, customer } = await requireCustomer(data.storeSlug, data.token);
    const { data: orders, error } = await sb
      .from("orders")
      .select("id,invoice_no,status,subtotal,delivery_amount,discount_amount,payment_method,created_at")
      .eq("store_id", storeId)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return orders ?? [];
  });

export const listCustomerAddresses = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ storeSlug: slugSchema, token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const { sb, storeId, customer } = await requireCustomer(data.storeSlug, data.token);
    const { data: rows } = await sb
      .from("store_customer_addresses")
      .select("id,label,name,phone,address,area,is_default")
      .eq("store_id", storeId)
      .eq("customer_id", customer.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    return rows ?? [];
  });

export const upsertCustomerAddress = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        storeSlug: slugSchema,
        token: tokenSchema,
        id: z.string().uuid().optional(),
        label: z.string().max(60).optional(),
        name: z.string().max(120).optional(),
        phone: z.string().max(40).optional(),
        address: z.string().trim().min(3).max(500),
        area: z.string().max(120).optional(),
        isDefault: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sb, storeId, customer } = await requireCustomer(data.storeSlug, data.token);
    if (data.isDefault) {
      await sb
        .from("store_customer_addresses")
        .update({ is_default: false })
        .eq("customer_id", customer.id);
    }
    const payload = {
      customer_id: customer.id,
      store_id: storeId,
      label: data.label ?? null,
      name: data.name ?? null,
      phone: data.phone ?? null,
      address: data.address,
      area: data.area ?? null,
      is_default: !!data.isDefault,
    };
    if (data.id) {
      const { error } = await sb
        .from("store_customer_addresses")
        .update(payload)
        .eq("id", data.id)
        .eq("customer_id", customer.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await sb
      .from("store_customer_addresses")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins!.id };
  });

export const deleteCustomerAddress = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ storeSlug: slugSchema, token: tokenSchema, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sb, customer } = await requireCustomer(data.storeSlug, data.token);
    await sb
      .from("store_customer_addresses")
      .delete()
      .eq("id", data.id)
      .eq("customer_id", customer.id);
    return { ok: true };
  });
