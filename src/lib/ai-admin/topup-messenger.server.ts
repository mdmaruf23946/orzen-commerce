// Wallet Add Fund -> platform owner's Messenger, with Approve / Reject buttons.
//
// The owner gets the full merchant + payment context as a Messenger button
// template. Tapping a button sends a postback which the AI Admin Messenger
// webhook routes back into `decideTopupFromMessenger` below. Only PSIDs on the
// server-side admin allow-list can ever reach that path.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadMessengerConnection, readMessengerCreds } from "./messenger.server";
import { sendPostbackButtons, sendText } from "@/lib/messenger-send.server";

export const TOPUP_APPROVE_PREFIX = "TOPUP_APPROVE_";
export const TOPUP_REJECT_PREFIX = "TOPUP_REJECT_";

function fmtBDT(n: number) {
  return `৳${Number(n || 0).toLocaleString("en-US")}`;
}

function dhaka(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString("en-GB", { timeZone: "Asia/Dhaka", hour12: false });
}

type TopupContext = {
  payment: any;
  store: any | null;
};

async function loadTopup(paymentId: string): Promise<TopupContext | null> {
  const { data: payment } = await (supabaseAdmin as any)
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return null;
  const { data: store } = await (supabaseAdmin as any)
    .from("stores")
    .select("id,name,owner_name,owner_user_id,email,phone,merchant_code")
    .eq("id", payment.store_id)
    .maybeSingle();
  return { payment, store: store ?? null };
}

function summaryText(ctx: TopupContext) {
  const { payment: p, store: s } = ctx;
  return [
    "💰 নতুন Add Fund রিকোয়েস্ট",
    "",
    `Merchant: ${s?.owner_name || s?.name || "—"}`,
    `Store: ${s?.name || "—"}${s?.merchant_code ? ` (${s.merchant_code})` : ""}`,
    `Email: ${p.customer_email || s?.email || "—"}`,
    `Phone: ${s?.phone || "—"}`,
    "",
    `Amount: ${fmtBDT(Number(p.amount))}`,
    `Method: ${String(p.method || "manual").toUpperCase()}`,
    `Sender number: ${p.sender_number || "—"}`,
    `Txn ID: ${p.txn_id || "—"}`,
    `Invoice: ${p.invoice_no || "—"}`,
    `Submitted: ${dhaka(p.created_at)} (Dhaka)`,
  ].join("\n");
}

/** Push the Add Fund request to every admin PSID with Approve / Reject buttons. */
export async function notifyOwnerTopupSubmitted(paymentId: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    const conn = await loadMessengerConnection();
    const creds = readMessengerCreds(conn);
    if (!conn || conn.status !== "connected" || !creds?.page_access_token) {
      return { sent: false, reason: "Messenger not connected" };
    }
    const psids = (conn.admin_psids ?? []).map((p) => String(p).trim()).filter(Boolean);
    if (!psids.length) return { sent: false, reason: "No admin PSID configured" };

    const ctx = await loadTopup(paymentId);
    if (!ctx) return { sent: false, reason: "Payment not found" };

    const text = summaryText(ctx);
    let sent = false;
    for (const psid of psids) {
      try {
        await sendPostbackButtons(creds.page_access_token, psid, text, [
          { title: "✅ Approve", payload: `${TOPUP_APPROVE_PREFIX}${paymentId}` },
          { title: "❌ Reject", payload: `${TOPUP_REJECT_PREFIX}${paymentId}` },
        ]);
        sent = true;
      } catch {
        try {
          await sendText(creds.page_access_token, psid, `${text}\n\nApprove করতে "approve ${paymentId.slice(0, 8)}" লিখুন।`);
          sent = true;
        } catch {
          /* best effort */
        }
      }
    }
    return sent ? { sent: true } : { sent: false, reason: "Delivery failed" };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Executes an Approve / Reject decision that came from the owner's Messenger.
 * Mirrors the Winner Admin panel flow: credits the wallet, marks the payment
 * and invoice, and sends the merchant the same platform email.
 */
export async function decideTopupFromMessenger(args: {
  paymentId: string;
  approve: boolean;
  actor: string;
}): Promise<string> {
  const ctx = await loadTopup(args.paymentId);
  if (!ctx) return "⚠️ এই পেমেন্টটি আর পাওয়া যাচ্ছে না।";
  const { payment: pay, store } = ctx;

  if (pay.purpose !== "wallet_topup") return "⚠️ এটি Add Fund পেমেন্ট নয়।";
  if (pay.status && pay.status !== "pending") {
    return `ℹ️ এই রিকোয়েস্টটি আগেই ${pay.status === "paid" ? "approve" : pay.status} করা হয়েছে।`;
  }

  const adm: any = supabaseAdmin;
  const now = new Date();
  const { enqueueEmail } = await import("@/lib/emails.server");

  if (!args.approve) {
    const reason = "Rejected by platform owner from Messenger after manual verification.";
    await adm
      .from("payments")
      .update({
        status: "rejected",
        verified_at: now.toISOString(),
        notes: reason,
        rejection_reason: reason,
      })
      .eq("id", pay.id);
    await adm
      .from("subscription_notifications")
      .insert({ store_id: pay.store_id, type: "payment_failed", meta: { payment_id: pay.id, reason } })
      .then(() => null, () => null);
    if (pay.customer_email) {
      try {
        const { tplPaymentRejected } = await import("@/lib/emails.server");
        const tpl = await tplPaymentRejected({
          ownerName: store?.owner_name ?? null,
          planName: "Wallet Add Fund",
          amount: Number(pay.amount),
          reason,
          supportEmail: "support@orzen.top",
          retryUrl: "/admin/billing",
          customerEmail: pay.customer_email,
        });
        await enqueueEmail({
          to: pay.customer_email,
          template: "payment_rejected",
          subject: tpl.subject,
          html: tpl.html,
          payload: { payment_id: pay.id, reason },
          relatedPaymentId: pay.id,
        });
      } catch (e) {
        console.error("[topup] reject email failed", (e as Error).message);
      }
    }
    return `❌ Reject করা হয়েছে — ${fmtBDT(Number(pay.amount))} (Txn ${pay.txn_id || "—"}). মার্চেন্টকে ইমেইলে জানানো হয়েছে।`;
  }

  const { data: inv } = await adm
    .from("subscription_invoices")
    .select("id,user_id,total")
    .eq("invoice_no", pay.invoice_no)
    .maybeSingle();
  const walletUserId = inv?.user_id ?? store?.owner_user_id;
  if (!walletUserId) return "⚠️ এই পেমেন্টের ওয়ালেট মালিক পাওয়া যায়নি।";

  const { creditWallet } = await import("@/lib/wallet.server");
  const res: any = await creditWallet(adm, {
    userId: walletUserId,
    amount: Number(pay.amount),
    type: "topup",
    invoiceId: inv?.id ?? null,
    reference: pay.invoice_no ?? null,
    note: `Fund added via ${pay.method ?? "manual"} (verified on Messenger)`,
    storeId: pay.store_id,
  });
  if (!res?.ok && !res?.already) return `⚠️ ওয়ালেটে টাকা যোগ করা যায়নি: ${res?.error ?? "unknown error"}`;

  await adm
    .from("payments")
    .update({ status: "paid", verified_at: now.toISOString(), notes: "Wallet top-up verified on Messenger" })
    .eq("id", pay.id);
  if (inv?.id) {
    await adm.from("subscription_invoices").update({ status: "paid", paid_at: now.toISOString() }).eq("id", inv.id);
  }
  await adm
    .from("subscription_notifications")
    .insert({
      store_id: pay.store_id,
      type: "payment_success",
      meta: {
        payment_id: pay.id,
        purpose: "wallet_topup",
        amount: Number(pay.amount),
        message: `৳${Number(pay.amount)} added to your wallet.`,
      },
    })
    .then(() => null, () => null);

  if (pay.customer_email) {
    try {
      const { tplWalletTopupApproved } = await import("@/lib/emails.server");
      const tpl = await tplWalletTopupApproved({
        ownerName: store?.owner_name ?? null,
        storeName: store?.name ?? null,
        customerEmail: pay.customer_email,
        amount: Number(pay.amount),
        method: pay.method ?? "manual",
        txnId: pay.txn_id ?? null,
        invoiceNo: pay.invoice_no ?? null,
        submittedAt: now.toISOString().replace("T", " ").slice(0, 16) + " UTC",
        balanceAfter: typeof res?.balance === "number" ? res.balance : null,
        walletUrl: "/admin/billing",
      });
      await enqueueEmail({
        to: pay.customer_email,
        template: "wallet_topup_approved",
        subject: tpl.subject,
        html: tpl.html,
        payload: { payment_id: pay.id, amount: Number(pay.amount) },
        relatedPaymentId: pay.id,
      });
    } catch (e) {
      console.error("[topup] approve email failed", (e as Error).message);
    }
  }

  const balance = typeof res?.balance === "number" ? ` নতুন ব্যালেন্স: ${fmtBDT(res.balance)}।` : "";
  return `✅ Approve সম্পন্ন — ${fmtBDT(Number(pay.amount))} মার্চেন্টের ওয়ালেটে যোগ হয়েছে।${balance} মার্চেন্টকে ইমেইলে জানানো হয়েছে।`;
}
