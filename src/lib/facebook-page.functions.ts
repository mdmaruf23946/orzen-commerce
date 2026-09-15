// Facebook Page module — server functions.
// Standalone: never reads or writes the Messenger AI Agent configuration
// (the only exception is an explicit, read-only credential import).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPlan } from "@/lib/plan-guard";

/** Runs a Graph call and turns any Meta error into actionable guidance. */
async function withFbError<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e) {
    const { explainGraphError } = await import("@/lib/facebook-errors.server");
    throw new Error(explainGraphError(e));
  }
}

/** Re-probes what the stored token can do and saves the result. */
async function refreshVerifiedCaps(supabase: any, storeId: string, pageId: string, token: string) {
  const { probeCapabilities } = await import("@/lib/facebook-page.server");
  const verified = await probeCapabilities(pageId, token);
  await supabase
    .from("facebook_page_integrations")
    .update({ permissions_verified: verified, permissions_checked_at: new Date().toISOString() } as any)
    .eq("store_id", storeId);
  return verified;
}

export const getFacebookPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await assertPlan(context.supabase, context.userId);
    const { capabilities, pagePicture, FB_PAGE_SCOPES, loadPageContext } = await import("@/lib/facebook-page.server");
    const { row } = await loadPageContext(context.supabase, storeId);

    const [{ count: draftCount }, { count: pendingComments }, { data: ai }, { count: pendingModeration }] =
      await Promise.all([
        context.supabase
          .from("facebook_posts")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("status", "draft"),
        context.supabase
          .from("facebook_comments")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("replied", false),
        context.supabase.from("facebook_ai_settings").select("enabled, mode").eq("store_id", storeId).maybeSingle(),
        context.supabase
          .from("facebook_moderation_queue")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("status", "pending"),
      ]);


    // Does the store have a Messenger page connected we could import from?
    const { data: msg } = await context.supabase
      .from("messenger_integrations")
      .select("page_id, page_name, status")
      .eq("store_id", storeId)
      .maybeSingle();

    return {
      connected: row?.status === "connected",
      page_id: row?.page_id ?? null,
      page_name: row?.page_name ?? null,
      page_picture_url: row?.page_id ? pagePicture(row.page_id) : null,
      app_id: row?.app_id ?? null,
      has_app_secret: !!row?.app_secret_encrypted,
      status: row?.status ?? "not_connected",
      connected_at: row?.connected_at ?? null,
      last_verified_at: row?.last_verified_at ?? null,
      token_expires_at: row?.token_expires_at ?? null,
      last_error: row?.last_error ?? null,
      permissions: (row?.permissions ?? []) as string[],
      capabilities: capabilities(row?.permissions as string[], row?.permissions_verified as any),
      scopes: FB_PAGE_SCOPES,
      drafts: draftCount ?? 0,
      unanswered_comments: pendingComments ?? 0,
      pending_moderation: pendingModeration ?? 0,
      webhook: {
        enabled: row?.webhook_enabled !== false,
        verify_token: (row?.verify_token ?? null) as string | null,
        last_webhook_at: (row?.last_webhook_at ?? null) as string | null,
        callback_url: `${(process.env["PUBLIC_SITE_ORIGIN"] || "https://orzen.top").replace(/\/$/, "")}/api/public/facebook/webhook`,
      },
      ai_enabled: !!ai?.enabled,
      ai_mode: ai?.mode ?? "suggest",

      messenger_page: msg?.status === "connected" && msg?.page_id
        ? { page_id: msg.page_id, page_name: msg.page_name }
        : null,
    };
  });

export const connectFacebookPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        page_id: z.string().trim().min(2).max(120),
        page_access_token: z.string().trim().min(10).max(2000),
        app_id: z.string().trim().max(64).optional().nullable(),
        app_secret: z.string().trim().max(200).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { graphGet, debugToken, inferScopes, pagePicture, loadPageContext } = await import(
      "@/lib/facebook-page.server"
    );
    const { encryptJSON } = await import("@/lib/crypto/credentials.server");
    const { row } = await loadPageContext(context.supabase, storeId);

    const page: any = await graphGet(`/${encodeURIComponent(data.page_id)}`, data.page_access_token, {
      fields: "name,picture.type(large)",
    });

    let permissions: string[] = [];
    let expiresAt: string | null = null;
    if (data.app_id && data.app_secret) {
      try {
        const info = await debugToken(data.page_access_token, data.app_id, data.app_secret);
        permissions = info.scopes;
        expiresAt = info.expires_at;
      } catch {
        /* non-fatal — fall back to task inference */
      }
    }
    if (!permissions.length) permissions = await inferScopes(data.page_id, data.page_access_token);

    const { error } = await context.supabase.from("facebook_page_integrations").upsert(
      {
        store_id: storeId,
        page_id: data.page_id,
        page_name: page?.name ?? null,
        page_picture_url: pagePicture(data.page_id),
        page_access_token_encrypted: encryptJSON(data.page_access_token),
        app_id: data.app_id || null,
        app_secret_encrypted: data.app_secret
          ? encryptJSON(data.app_secret)
          : (row?.app_secret_encrypted ?? null),
        permissions,
        token_expires_at: expiresAt,
        verify_token: row?.verify_token ?? crypto.randomUUID().replace(/-/g, ""),
        status: "connected",
        connected_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "store_id" },
    );
    if (error) throw new Error(error.message);
    // Best-effort: subscribe the page to the app so webhooks are delivered.
    const { subscribePageToApp } = await import("@/lib/facebook-page.server");
    let subscribed = true;
    try {
      await subscribePageToApp(data.page_id, data.page_access_token);
    } catch {
      subscribed = false;
    }
    return { ok: true, page_name: page?.name ?? null, permissions, subscribed };

  });

export const importMessengerPageCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { inferScopes, debugToken, pagePicture, graphGet } = await import("@/lib/facebook-page.server");

    // Read-only copy of the Messenger connection; that row is never modified.
    const { data: msg } = await context.supabase
      .from("messenger_integrations")
      .select("page_id, page_name, app_id, app_secret_encrypted, page_access_token_encrypted, page_access_token")
      .eq("store_id", storeId)
      .maybeSingle();
    if (!msg?.page_id) throw new Error("No connected Messenger page found to import.");

    const { decryptJSON } = await import("@/lib/crypto/credentials.server");
    let token: string | null = msg.page_access_token ?? null;
    if (msg.page_access_token_encrypted) {
      try {
        token = decryptJSON<string>(msg.page_access_token_encrypted);
      } catch {
        token = null;
      }
    }
    if (!token) throw new Error("Could not read the Messenger page token. Connect the page manually.");

    let appSecret: string | null = null;
    if (msg.app_secret_encrypted) {
      try {
        appSecret = decryptJSON<string>(msg.app_secret_encrypted);
      } catch {
        appSecret = null;
      }
    }

    const page: any = await graphGet(`/${encodeURIComponent(msg.page_id)}`, token, { fields: "name" });

    let permissions: string[] = [];
    let expiresAt: string | null = null;
    if (msg.app_id && appSecret) {
      try {
        const info = await debugToken(token, msg.app_id, appSecret);
        permissions = info.scopes;
        expiresAt = info.expires_at;
      } catch {
        /* ignore */
      }
    }
    if (!permissions.length) permissions = await inferScopes(msg.page_id, token);

    const { encryptJSON } = await import("@/lib/crypto/credentials.server");
    const { error } = await context.supabase.from("facebook_page_integrations").upsert(
      {
        store_id: storeId,
        page_id: msg.page_id,
        page_name: page?.name ?? msg.page_name ?? null,
        page_picture_url: pagePicture(msg.page_id),
        page_access_token_encrypted: encryptJSON(token),
        app_id: msg.app_id ?? null,
        app_secret_encrypted: appSecret ? encryptJSON(appSecret) : null,
        permissions,
        token_expires_at: expiresAt,
        verify_token: crypto.randomUUID().replace(/-/g, ""),
        status: "connected",
        connected_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "store_id" },
    );
    if (error) throw new Error(error.message);
    // Best-effort: subscribe the page to the app so webhooks are delivered.
    const { subscribePageToApp } = await import("@/lib/facebook-page.server");
    let subscribed = true;
    try {
      await subscribePageToApp(msg.page_id, token);
    } catch {
      subscribed = false;
    }
    return { ok: true, page_name: page?.name ?? null, permissions, subscribed };

  });

export const reverifyFacebookPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { loadPageContext, graphGet, debugToken, inferScopes } = await import("@/lib/facebook-page.server");
    const { row, token } = await loadPageContext(context.supabase, storeId);
    if (!row?.page_id || !token) throw new Error("Facebook Page is not connected.");

    try {
      const page: any = await graphGet(`/${encodeURIComponent(row.page_id)}`, token, { fields: "name" });
      let permissions: string[] = [];
      let expiresAt: string | null = row.token_expires_at ?? null;
      if (row.app_id && row.app_secret_encrypted) {
        try {
          const { decryptJSON } = await import("@/lib/crypto/credentials.server");
          const info = await debugToken(token, row.app_id, decryptJSON<string>(row.app_secret_encrypted));
          permissions = info.scopes;
          expiresAt = info.expires_at;
        } catch {
          /* ignore */
        }
      }
      if (!permissions.length) permissions = await inferScopes(row.page_id, token);

      await context.supabase
        .from("facebook_page_integrations")
        .update({
          page_name: page?.name ?? row.page_name,
          permissions,
          token_expires_at: expiresAt,
          status: "connected",
          last_verified_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("store_id", storeId);
      return { ok: true, permissions };
    } catch (e) {
      await context.supabase
        .from("facebook_page_integrations")
        .update({ status: "error", last_error: (e as Error).message, last_verified_at: new Date().toISOString() })
        .eq("store_id", storeId);
      throw e;
    }
  });

export const disconnectFacebookPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    await context.supabase.from("facebook_page_integrations").delete().eq("store_id", storeId);
    return { ok: true };
  });

export const listFacebookPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        after: z.string().trim().max(500).optional().nullable(),
        q: z.string().trim().max(120).optional().nullable(),
        limit: z.number().int().optional().nullable(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { loadPageContext, capabilities, graphGet } = await import("@/lib/facebook-page.server");
    const { row, token } = await loadPageContext(context.supabase, storeId);
    if (!row?.page_id || !token) return { connected: false, posts: [], next: null };

    const caps = capabilities(row.permissions as string[], row.permissions_verified as any);
    if (!caps.read_posts) return { connected: true, posts: [], next: null, missing: "pages_read_engagement" };

    const fields =
      "id,message,created_time,permalink_url,full_picture,attachments{media_type,type,media,target,url}," +
      "comments.summary(true).limit(0),reactions.summary(true).limit(0),shares";
    const pageSize = Math.min(Math.max(data?.limit ?? 10, 5), 25);
    const needle = (data?.q ?? "").trim().toLowerCase();

    // Graph has no text search on a page feed, so when the owner searches we
    // keep paging (bounded) and filter locally until the page is filled.
    const collected: any[] = [];
    let cursor = data?.after ?? undefined;
    let rounds = 0;
    let next: string | null = null;
    do {
      const j: any = await graphGet(`/${encodeURIComponent(row.page_id)}/posts`, token, {
        fields,
        limit: String(needle ? 25 : pageSize),
        after: cursor,
      });
      const batch = (j?.data ?? []) as any[];
      collected.push(...(needle ? batch.filter((p) => String(p.message ?? "").toLowerCase().includes(needle)) : batch));
      next = j?.paging?.cursors?.after ?? null;
      cursor = next ?? undefined;
      rounds += 1;
      if (!needle || !next) break;
    } while (collected.length < pageSize && rounds < 5);

    const j: any = { data: collected.slice(0, pageSize), paging: { cursors: { after: next } } };


    const posts = (j?.data ?? []).map((p: any) => {
      const a = p?.attachments?.data?.[0];
      return {
        id: p.id as string,
        message: (p.message ?? "") as string,
        created_time: p.created_time as string,
        permalink_url: (p.permalink_url ?? null) as string | null,
        image: (p.full_picture ?? a?.media?.image?.src ?? null) as string | null,
        media_type: (a?.media_type ?? a?.type ?? "status") as string,
        comments: p?.comments?.summary?.total_count ?? 0,
        reactions: p?.reactions?.summary?.total_count ?? 0,
        shares: p?.shares?.count ?? 0,
      };
    });
    return { connected: true, posts, next: j?.paging?.cursors?.after ?? null, capabilities: caps };
  });

export const deleteFacebookPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ post_id: z.string().trim().min(3).max(120) }).parse(d))
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { loadPageContext, requireCapability, graphDelete } = await import("@/lib/facebook-page.server");
    const { row, token } = await loadPageContext(context.supabase, storeId);
    requireCapability(row, "delete_post");
    await graphDelete(`/${encodeURIComponent(data.post_id)}`, token!);
    await context.supabase.from("facebook_posts").delete().eq("store_id", storeId).eq("fb_post_id", data.post_id);
    return { ok: true };
  });

export const editFacebookPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ post_id: z.string().trim().min(3).max(120), message: z.string().trim().max(5000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { loadPageContext, requireCapability, graphPost } = await import("@/lib/facebook-page.server");
    const { row, token } = await loadPageContext(context.supabase, storeId);
    requireCapability(row, "edit_post");
    await graphPost(`/${encodeURIComponent(data.post_id)}`, token!, { message: data.message });
    return { ok: true };
  });

export const listFacebookDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { data } = await context.supabase
      .from("facebook_posts")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { drafts: data ?? [] };
  });

export const saveFacebookDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional().nullable(),
        message: z.string().trim().max(5000).default(""),
        media_url: z.string().trim().max(1000).optional().nullable(),
        media_type: z.enum(["text", "image", "video", "link"]).default("text"),
        link_url: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const payload = {
      store_id: storeId,
      message: data.message || null,
      media_url: data.media_url || null,
      media_type: data.media_type,
      link_url: data.link_url || null,
      status: "draft",
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("facebook_posts")
        .update(payload)
        .eq("id", data.id)
        .eq("store_id", storeId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("facebook_posts")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: created.id as string };
  });

export const deleteFacebookDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    await context.supabase.from("facebook_posts").delete().eq("id", data.id).eq("store_id", storeId);
    return { ok: true };
  });

export const publishFacebookPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        draft_id: z.string().uuid().optional().nullable(),
        message: z.string().trim().max(5000).default(""),
        media_url: z.string().trim().max(1000).optional().nullable(),
        media_type: z.enum(["text", "image", "video", "link"]).default("text"),
        link_url: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { loadPageContext, requireCapability, graphPost } = await import("@/lib/facebook-page.server");
    const { row, token } = await loadPageContext(context.supabase, storeId);
    requireCapability(row, "create_post");
    if (!data.message && !data.media_url && !data.link_url) throw new Error("Write something before publishing.");

    let fbId: string | null = null;
    try {
      if (data.media_type === "image" && data.media_url) {
        const r: any = await graphPost(`/${encodeURIComponent(row.page_id)}/photos`, token!, {
          url: data.media_url,
          caption: data.message,
        });
        fbId = r?.post_id ?? r?.id ?? null;
      } else if (data.media_type === "video" && data.media_url) {
        const r: any = await graphPost(`/${encodeURIComponent(row.page_id)}/videos`, token!, {
          file_url: data.media_url,
          description: data.message,
        });
        fbId = r?.id ?? null;
      } else {
        const body: Record<string, string> = { message: data.message };
        if (data.link_url) body.link = data.link_url;
        const r: any = await graphPost(`/${encodeURIComponent(row.page_id)}/feed`, token!, body);
        fbId = r?.id ?? null;
      }
    } catch (e) {
      if (data.draft_id) {
        await context.supabase
          .from("facebook_posts")
          .update({ error: (e as Error).message })
          .eq("id", data.draft_id)
          .eq("store_id", storeId);
      }
      throw e;
    }

    const record = {
      store_id: storeId,
      fb_post_id: fbId,
      message: data.message || null,
      media_url: data.media_url || null,
      media_type: data.media_type,
      link_url: data.link_url || null,
      status: "published",
      error: null,
      published_at: new Date().toISOString(),
    };
    if (data.draft_id) {
      await context.supabase.from("facebook_posts").update(record).eq("id", data.draft_id).eq("store_id", storeId);
    } else {
      await context.supabase.from("facebook_posts").insert(record);
    }
    return { ok: true, post_id: fbId };
  });

export const syncFacebookComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ post_id: z.string().trim().max(120).optional().nullable() }).optional().parse(d))
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { loadPageContext, capabilities, graphGet } = await import("@/lib/facebook-page.server");
    const { row, token } = await loadPageContext(context.supabase, storeId);
    if (!row?.page_id || !token) return { ok: false, error: "not_connected", synced: 0 };
    const caps = capabilities(row.permissions as string[], row.permissions_verified as any);
    if (!caps.read_comments) return { ok: false, error: "pages_read_engagement", synced: 0 };

    const rows: any[] = [];
    if (data?.post_id) {
      const j: any = await graphGet(`/${encodeURIComponent(data.post_id)}/comments`, token, {
        fields: "id,message,created_time,from{id,name},is_hidden,comment_count",
        limit: "50",
        order: "reverse_chronological",
      });
      for (const c of j?.data ?? []) rows.push({ c, postId: data.post_id, excerpt: null });
    } else {
      const feed: any = await graphGet(`/${encodeURIComponent(row.page_id)}/posts`, token, {
        fields:
          "id,message,created_time,comments.limit(25).order(reverse_chronological){id,message,created_time,from{id,name},is_hidden}",
        limit: "10",
      });
      for (const p of feed?.data ?? []) {
        for (const c of p?.comments?.data ?? []) {
          rows.push({ c, postId: p.id, excerpt: (p.message ?? "").slice(0, 120) || null });
        }
      }
    }

    const upserts = rows.map(({ c, postId, excerpt }) => ({
      store_id: storeId,
      comment_id: c.id,
      post_id: postId,
      post_excerpt: excerpt,
      author_id: c?.from?.id ?? null,
      author_name: c?.from?.name ?? null,
      message: c.message ?? "",
      comment_created_at: c.created_time ?? null,
      hidden: !!c.is_hidden,
    }));
    if (upserts.length) {
      const { error } = await context.supabase
        .from("facebook_comments")
        .upsert(upserts, { onConflict: "store_id,comment_id", ignoreDuplicates: false });
      if (error) throw new Error(error.message);
    }
    return { ok: true, synced: upserts.length };
  });

export const listFacebookComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        filter: z.enum(["all", "unanswered", "flagged", "hidden"]).default("all"),
        post_id: z.string().trim().max(120).optional().nullable(),
        q: z.string().trim().max(120).optional().nullable(),
        page: z.number().int().optional().nullable(),
        page_size: z.number().int().optional().nullable(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { loadPageContext, capabilities, userPicture } = await import("@/lib/facebook-page.server");
    const { row } = await loadPageContext(context.supabase, storeId);

    const pageSize = Math.min(Math.max(data?.page_size ?? 15, 5), 50);
    const page = Math.max(data?.page ?? 1, 1);
    const from = (page - 1) * pageSize;

    let q = context.supabase
      .from("facebook_comments")
      .select("*", { count: "exact" })
      .eq("store_id", storeId)
      .order("comment_created_at", { ascending: false, nullsFirst: false })
      .range(from, from + pageSize - 1);

    const filter = data?.filter ?? "all";
    if (filter === "unanswered") q = q.eq("replied", false).eq("hidden", false);
    if (filter === "hidden") q = q.eq("hidden", true);
    if (filter === "flagged") q = q.in("ai_category", ["spam", "abusive"]);
    if (data?.post_id) q = q.eq("post_id", data.post_id);
    if (data?.q) q = q.ilike("message", `%${data.q}%`);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    const total = count ?? 0;
    return {
      connected: row?.status === "connected",
      capabilities: capabilities(row?.permissions as string[], row?.permissions_verified as any),
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
      last_webhook_at: (row?.last_webhook_at ?? null) as string | null,
      comments: (rows ?? []).map((c: any) => ({
        ...c,
        author_picture: c.author_id ? userPicture(c.author_id) : null,
      })),
    };
  });


export const replyFacebookComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ comment_id: z.string().trim().min(3).max(120), message: z.string().trim().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { loadPageContext, requireCapability, graphPost } = await import("@/lib/facebook-page.server");
    const { row, token } = await loadPageContext(context.supabase, storeId);
    requireCapability(row, "reply_comment");
    await graphPost(`/${encodeURIComponent(data.comment_id)}/comments`, token!, { message: data.message });
    await context.supabase
      .from("facebook_comments")
      .update({ replied: true, ai_status: "done" })
      .eq("store_id", storeId)
      .eq("comment_id", data.comment_id);
    return { ok: true };
  });

export const setFacebookCommentHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ comment_id: z.string().trim().min(3).max(120), hidden: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { loadPageContext, requireCapability, graphPost } = await import("@/lib/facebook-page.server");
    const { row, token } = await loadPageContext(context.supabase, storeId);
    requireCapability(row, "hide_comment");
    await graphPost(`/${encodeURIComponent(data.comment_id)}`, token!, { is_hidden: String(data.hidden) });
    await context.supabase
      .from("facebook_comments")
      .update({ hidden: data.hidden })
      .eq("store_id", storeId)
      .eq("comment_id", data.comment_id);
    return { ok: true };
  });

export const deleteFacebookComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ comment_id: z.string().trim().min(3).max(120) }).parse(d))
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { loadPageContext, requireCapability, graphDelete } = await import("@/lib/facebook-page.server");
    const { row, token } = await loadPageContext(context.supabase, storeId);
    requireCapability(row, "delete_comment");
    await graphDelete(`/${encodeURIComponent(data.comment_id)}`, token!);
    await context.supabase
      .from("facebook_comments")
      .delete()
      .eq("store_id", storeId)
      .eq("comment_id", data.comment_id);
    return { ok: true };
  });

export const blockFacebookCommenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().trim().min(3).max(120) }).parse(d))
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { loadPageContext, requireCapability, graphPost } = await import("@/lib/facebook-page.server");
    const { row, token } = await loadPageContext(context.supabase, storeId);
    requireCapability(row, "block_user");
    await graphPost(`/${encodeURIComponent(row.page_id)}/blocked`, token!, { user: data.user_id });
    return { ok: true };
  });

export const privateReplyFacebookComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ comment_id: z.string().trim().min(3).max(120), message: z.string().trim().min(1).max(1500) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { loadPageContext, requireCapability, graphPost } = await import("@/lib/facebook-page.server");
    const { row, token } = await loadPageContext(context.supabase, storeId);
    requireCapability(row, "private_reply");
    // Meta allows exactly one private reply per top-level comment, within 7 days.
    await graphPost(`/${encodeURIComponent(row.page_id)}/messages`, token!, {
      recipient: JSON.stringify({ comment_id: data.comment_id }),
      message: JSON.stringify({ text: data.message }),
      messaging_type: "RESPONSE",
    });
    return { ok: true };
  });

export const getFacebookAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { data } = await context.supabase
      .from("facebook_ai_settings")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();
    return (
      data ?? {
        enabled: false,
        mode: "suggest",
        tone: "friendly",
        language: "bn",
        auto_reply_safe: false,
        auto_hide_spam: false,
        suggest_messenger_handoff: true,
        allow_keywords: [],
        deny_keywords: [],
        custom_instructions: null,
      }
    );
  });

export const saveFacebookAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        enabled: z.boolean(),
        mode: z.enum(["suggest", "auto"]),
        tone: z.enum(["friendly", "professional", "casual"]),
        language: z.enum(["bn", "en", "auto"]),
        auto_reply_safe: z.boolean(),
        auto_hide_spam: z.boolean(),
        suggest_messenger_handoff: z.boolean(),
        allow_keywords: z.array(z.string().trim().max(60)).max(50).default([]),
        deny_keywords: z.array(z.string().trim().max(60)).max(50).default([]),
        custom_instructions: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { error } = await context.supabase
      .from("facebook_ai_settings")
      .upsert({ store_id: storeId, ...data, custom_instructions: data.custom_instructions || null }, {
        onConflict: "store_id",
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const analyzeFacebookComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ comment_ids: z.array(z.string().max(120)).max(20) }).parse(d))
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { analyzeComments } = await import("@/lib/facebook-ai.server");
    return await analyzeComments(context.supabase, storeId, data.comment_ids);
  });

// ---------------------------------------------------------------------------
// AI moderation approval workflow
// AI never deletes, hides or blocks by itself — it queues a proposal here and
// the store owner approves or rejects it.
// ---------------------------------------------------------------------------

export const listFacebookModeration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ status: z.enum(["pending", "approved", "rejected", "failed", "all"]).default("pending") })
      .optional()
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { loadPageContext, capabilities, userPicture } = await import("@/lib/facebook-page.server");
    const { row } = await loadPageContext(context.supabase, storeId);

    let q = context.supabase
      .from("facebook_moderation_queue")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(100);
    const status = data?.status ?? "pending";
    if (status !== "all") q = q.eq("status", status);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    return {
      connected: row?.status === "connected",
      capabilities: capabilities(row?.permissions as string[], row?.permissions_verified as any),
      items: (rows ?? []).map((r: any) => ({
        ...r,
        author_picture: r.author_id ? userPicture(r.author_id) : null,
      })),
    };
  });

export const decideFacebookModeration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        message: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { data: item, error } = await context.supabase
      .from("facebook_moderation_queue")
      .select("*")
      .eq("id", data.id)
      .eq("store_id", storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) throw new Error("This moderation request no longer exists.");
    if ((item as any).status !== "pending") throw new Error("This request has already been decided.");

    if (data.decision === "reject") {
      await context.supabase
        .from("facebook_moderation_queue")
        .update({ status: "rejected", decided_at: new Date().toISOString() })
        .eq("id", data.id)
        .eq("store_id", storeId);
      return { ok: true, status: "rejected" as const };
    }

    const { loadPageContext, requireCapability, graphPost, graphDelete } = await import(
      "@/lib/facebook-page.server"
    );
    const { row, token } = await loadPageContext(context.supabase, storeId);
    const action = String((item as any).action);
    const commentId = String((item as any).comment_id);

    try {
      if (action === "hide") {
        requireCapability(row, "hide_comment");
        await graphPost(`/${encodeURIComponent(commentId)}`, token!, { is_hidden: "true" });
        await context.supabase
          .from("facebook_comments")
          .update({ hidden: true })
          .eq("store_id", storeId)
          .eq("comment_id", commentId);
      } else if (action === "delete") {
        requireCapability(row, "delete_comment");
        await graphDelete(`/${encodeURIComponent(commentId)}`, token!);
        await context.supabase
          .from("facebook_comments")
          .delete()
          .eq("store_id", storeId)
          .eq("comment_id", commentId);
      } else if (action === "block") {
        requireCapability(row, "block_user");
        const userId = (item as any).author_id;
        if (!userId) throw new Error("This comment has no author to block.");
        await graphPost(`/${encodeURIComponent(row.page_id)}/blocked`, token!, { user: String(userId) });
      } else if (action === "reply") {
        requireCapability(row, "reply_comment");
        const text = (data.message ?? (item as any).suggestion ?? "").trim();
        if (!text) throw new Error("Write a reply before approving.");
        await graphPost(`/${encodeURIComponent(commentId)}/comments`, token!, { message: text });
        await context.supabase
          .from("facebook_comments")
          .update({ replied: true, ai_status: "done" })
          .eq("store_id", storeId)
          .eq("comment_id", commentId);
      } else {
        throw new Error(`Unsupported moderation action: ${action}`);
      }
    } catch (e) {
      await context.supabase
        .from("facebook_moderation_queue")
        .update({ status: "failed", error: (e as Error).message, decided_at: new Date().toISOString() })
        .eq("id", data.id)
        .eq("store_id", storeId);
      throw e;
    }

    await context.supabase
      .from("facebook_moderation_queue")
      .update({ status: "approved", error: null, decided_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("store_id", storeId);
    return { ok: true, status: "approved" as const };
  });

export const clearFacebookModeration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    await context.supabase
      .from("facebook_moderation_queue")
      .delete()
      .eq("store_id", storeId)
      .neq("status", "pending");
    return { ok: true };
  });

/** Turn live webhook syncing on or off for this page. */
export const setFacebookWebhookEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { error } = await context.supabase
      .from("facebook_page_integrations")
      .update({ webhook_enabled: data.enabled } as any)
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Reads (and can repair) the page -> app webhook subscription. */
export const facebookWebhookSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ subscribe: z.boolean().optional() }).optional().parse(d))
  .handler(async ({ context, data }) => {
    const storeId = await assertPlan(context.supabase, context.userId, "facebook_page");
    const { loadPageContext, subscribePageToApp, pageSubscribedFields } = await import(
      "@/lib/facebook-page.server"
    );
    const { row, token } = await loadPageContext(context.supabase, storeId);
    if (!row?.page_id || !token) throw new Error("Facebook Page is not connected.");
    if (data?.subscribe) await subscribePageToApp(row.page_id, token);
    const fields = await pageSubscribedFields(row.page_id, token);
    return { subscribed: fields.length > 0, fields };
  });
