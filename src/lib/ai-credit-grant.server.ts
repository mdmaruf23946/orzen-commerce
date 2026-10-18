// Grants a plan's included free AI credits to a store, once per reference
// (invoice/payment id). Requires a service-role client.
export async function grantPlanAiCredits(sb: any, storeId: string | null | undefined, packageId: string | null | undefined, ref: string) {
  try {
    if (!storeId || !packageId) return 0;
    const { data: pkg } = await sb.from("subscription_packages").select("name,ai_credits_included").eq("id", packageId).maybeSingle();
    const credits = Number(pkg?.ai_credits_included ?? 0);
    if (credits <= 0) return 0;
    const note = `Plan free credits — ${pkg?.name ?? "plan"} [${ref}]`;
    const { data: dup } = await sb.from("ai_credit_ledger").select("id").eq("store_id", storeId).eq("note", note).limit(1);
    if (dup && dup.length) return 0;
    const { error } = await sb.rpc("grant_ai_credits", { _store: storeId, _credits: credits, _kind: "plan_grant", _note: note });
    return error ? 0 : credits;
  } catch {
    return 0;
  }
}
