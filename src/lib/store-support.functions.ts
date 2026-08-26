// Support tickets for store admins (talking to the Orzen platform team).
import { createServerFn } from "@tanstack/react-start";
import { myStoreRow } from "@/lib/store-access";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function myStoreId(supabase: any, userId: string): Promise<string | null> {
  const data = await myStoreRow(supabase, userId, "id");
  return data?.id ?? null;
}

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return [];
    const { data } = await context.supabase
      .from("support_tickets")
      .select("id,subject,priority,status,created_at,updated_at")
      .eq("store_id", sid)
      .order("updated_at", { ascending: false });
    return data ?? [];
  });

export const getMyTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { data: ticket } = await context.supabase
      .from("support_tickets")
      .select("id,subject,priority,status,created_at,updated_at")
      .eq("id", data.id)
      .eq("store_id", sid)
      .maybeSingle();
    if (!ticket) throw new Error("Ticket not found");
    const { data: messages } = await context.supabase
      .from("ticket_messages")
      .select("id,body,author_user_id,created_at")
      .eq("ticket_id", data.id)
      .eq("is_internal", false)
      .order("created_at", { ascending: true });
    return { ticket, messages: messages ?? [], meUserId: context.userId };
  });

export const createMyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        subject: z.string().trim().min(3).max(160),
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
        message: z.string().trim().min(3).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sid = await myStoreId(supabase, userId);
    if (!sid) throw new Error("No store");
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        store_id: sid,
        subject: data.subject,
        priority: data.priority,
        status: "open",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { error: mErr } = await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      author_user_id: userId,
      body: data.message,
      is_internal: false,
    });
    if (mErr) throw new Error(mErr.message);
    return ticket;
  });

export const replyMyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ ticketId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sid = await myStoreId(supabase, userId);
    if (!sid) throw new Error("No store");
    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("id")
      .eq("id", data.ticketId)
      .eq("store_id", sid)
      .maybeSingle();
    if (!ticket) throw new Error("Ticket not found");
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: data.ticketId,
      author_user_id: userId,
      body: data.body,
      is_internal: false,
    });
    if (error) throw new Error(error.message);
    await supabase
      .from("support_tickets")
      .update({ status: "open", updated_at: new Date().toISOString() })
      .eq("id", data.ticketId)
      .eq("store_id", sid);
    return { ok: true };
  });

export const closeMyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { error } = await context.supabase
      .from("support_tickets")
      .update({ status: "closed" })
      .eq("id", data.id)
      .eq("store_id", sid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
