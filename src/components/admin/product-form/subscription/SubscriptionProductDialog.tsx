// Dedicated 15-step Subscription product form. Completely isolated from the
// physical / digital / service forms — no stock, shipping, variants, weight,
// digital files or booking fields. Everything lives in meta.subscription.
import { lazy, Suspense, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { GalleryUploader } from "@/components/admin/GalleryUploader";
import { Field, FormWizard, RepeatableList, StepCard, selectCls } from "../service/ui";
import {
  ACCESS_PRESETS,
  ACTIVATION_LABEL,
  BADGE_PRESETS,
  BILLING_CYCLE_LABEL,
  DEFAULT_NOTIFICATIONS,
  NOTIFICATION_LABEL,
  PLAN_TYPE_LABEL,
  RENEWAL_MODE_LABEL,
  RESET_PERIOD_LABEL,
  USAGE_METRIC_PRESETS,
  cycleLabel,
  type AccessItem,
  type ActivationType,
  type Benefit,
  type BillingCycle,
  type CustomerField,
  type CustomFieldType,
  type CycleUnit,
  type PlanType,
  type RenewalMode,
  type ResetPeriod,
  type SubscriptionMeta,
  type SubscriptionNotifications,
  type TrialUnit,
  type UsageLimit,
} from "./subscription-meta";

const RichTextEditor = lazy(() => import("../RichTextEditor"));

type Category = { id: string; name: string; parent_id?: string | null };

const num = (v: string) => (v === "" ? null : Number(v));

export function SubscriptionProductDialog({
  storeId,
  editing,
  categories,
  productDefaults,
  onClose,
  onSave,
}: {
  storeId: string;
  editing: any | null;
  categories: Category[];
  productDefaults: { warranty?: string; return_policy?: string } | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const meta0 = (editing?.meta ?? {}) as any;
  const s0 = (meta0.subscription ?? {}) as SubscriptionMeta;

  // Step 1 — General
  const [name, setName] = useState<string>(editing?.name ?? "");
  const [categoryId, setCategoryId] = useState<string>(editing?.category_id ?? "");
  const [subcategoryId, setSubcategoryId] = useState<string>(meta0.subcategory_id ?? "");
  const [brand, setBrand] = useState<string>(editing?.brand ?? "");
  const [shortDesc, setShortDesc] = useState<string>(editing?.short_description ?? "");
  const [description, setDescription] = useState<string>(editing?.description ?? "");
  const [image, setImage] = useState<string | null>(editing?.primary_image_url ?? null);
  const [gallery, setGallery] = useState<string[]>(Array.isArray(editing?.gallery) ? editing.gallery : []);
  const [introVideo, setIntroVideo] = useState<string>(editing?.video_url ?? "");
  const [status, setStatus] = useState<"draft" | "active">(editing?.status === "draft" ? "draft" : "active");

  // Step 2 — Plan
  const [cycle, setCycle] = useState<BillingCycle>(s0.billing_cycle ?? "monthly");
  const [cycleNumber, setCycleNumber] = useState<string>(
    s0.custom_cycle?.number != null ? String(s0.custom_cycle.number) : "",
  );
  const [cycleUnit, setCycleUnit] = useState<CycleUnit>(s0.custom_cycle?.unit ?? "months");
  const [planType, setPlanType] = useState<PlanType>(s0.plan_type ?? "individual");
  const [planTypeCustom, setPlanTypeCustom] = useState<string>(s0.plan_type_custom ?? "");
  const [badge, setBadge] = useState<string>(s0.badge ?? "");

  // Step 3 — Pricing
  const [regularPrice, setRegularPrice] = useState<string>(
    editing?.old_price != null ? String(editing.old_price) : editing ? String(editing.price) : "",
  );
  // Only treat as a sale when the old price is genuinely higher than the price.
  const [salePrice, setSalePrice] = useState<string>(
    editing?.old_price != null && Number(editing.old_price) > Number(editing.price) ? String(editing.price) : "",
  );
  const [setupFee, setSetupFee] = useState<string>(s0.setup_fee != null ? String(s0.setup_fee) : "");
  const [taxIncluded, setTaxIncluded] = useState<boolean>(s0.tax_included ?? false);
  const [renewalMode2, setRenewalMode2] = useState<"same" | "different">(s0.renewal_price_mode ?? "same");
  const [renewalPrice, setRenewalPrice] = useState<string>(
    s0.renewal_price != null ? String(s0.renewal_price) : "",
  );

  // Step 4 — Trial & activation
  const [trialEnabled, setTrialEnabled] = useState<boolean>(s0.trial?.enabled ?? false);
  const [trialDuration, setTrialDuration] = useState<string>(
    s0.trial?.duration != null ? String(s0.trial.duration) : "7",
  );
  const [trialUnit, setTrialUnit] = useState<TrialUnit>(s0.trial?.unit ?? "days");
  const [activation, setActivation] = useState<ActivationType>(s0.activation?.type ?? "automatic");
  const [activationDelay, setActivationDelay] = useState<string>(
    s0.activation?.delay_hours != null ? String(s0.activation.delay_hours) : "",
  );

  // Steps 5–7
  const [accessItems, setAccessItems] = useState<AccessItem[]>(s0.access_items ?? []);
  const [usageLimits, setUsageLimits] = useState<UsageLimit[]>(s0.usage_limits ?? []);
  const [benefits, setBenefits] = useState<Benefit[]>(s0.benefits ?? []);

  // Step 8 — Upgrade & renewal
  const r0 = s0.renewal ?? ({} as NonNullable<SubscriptionMeta["renewal"]>);
  const [renewalMode, setRenewalMode] = useState<RenewalMode>(r0.mode ?? "automatic");
  const [allowUpgrade, setAllowUpgrade] = useState<boolean>(r0.allow_upgrade ?? true);
  const [allowDowngrade, setAllowDowngrade] = useState<boolean>(r0.allow_downgrade ?? false);
  const [upgradeRules, setUpgradeRules] = useState<string>(r0.upgrade_rules ?? "");
  const [gracePeriod, setGracePeriod] = useState<string>(
    r0.grace_period_days != null ? String(r0.grace_period_days) : "3",
  );
  const [renewalReminder, setRenewalReminder] = useState<string>(
    r0.renewal_reminder_days != null ? String(r0.renewal_reminder_days) : "7",
  );
  const [expiryReminder, setExpiryReminder] = useState<string>(
    r0.expiry_reminder_days != null ? String(r0.expiry_reminder_days) : "3",
  );
  const [renewalDiscount, setRenewalDiscount] = useState<string>(
    r0.renewal_discount != null ? String(r0.renewal_discount) : "",
  );
  const [upgradeDiscount, setUpgradeDiscount] = useState<string>(
    r0.upgrade_discount != null ? String(r0.upgrade_discount) : "",
  );

  // Step 9
  const [customerFields, setCustomerFields] = useState<CustomerField[]>(s0.customer_fields ?? []);

  // Step 10 — Media
  const [previewImages, setPreviewImages] = useState<string[]>(s0.media?.preview_images ?? []);
  const [promoVideo, setPromoVideo] = useState<string>(s0.media?.promo_video ?? "");
  const [documents, setDocuments] = useState<string[]>(s0.media?.documents ?? []);

  // Step 11 — SEO
  const [seo, setSeo] = useState<{ title?: string; description?: string; slug?: string; keywords?: string }>(
    meta0.seo ?? {},
  );

  // Step 12 — Visibility
  const [isFeatured, setIsFeatured] = useState<boolean>(!!editing?.is_featured);
  const [popular, setPopular] = useState<boolean>(s0.flags?.popular ?? false);
  const [recommended, setRecommended] = useState<boolean>(s0.flags?.recommended ?? false);
  const [isNew, setIsNew] = useState<boolean>(s0.flags?.new ?? false);
  const [limitedOffer, setLimitedOffer] = useState<boolean>(s0.flags?.limited_offer ?? false);
  const [publishAt, setPublishAt] = useState<string>(s0.publish_at ?? "");

  // Step 13 — Policies
  const [refund, setRefund] = useState<string>(
    s0.policies?.refund ?? editing?.return_policy ?? (editing ? "" : (productDefaults?.return_policy ?? "")),
  );
  const [cancellation, setCancellation] = useState<string>(s0.policies?.cancellation ?? "");
  const [renewalPolicy, setRenewalPolicy] = useState<string>(s0.policies?.renewal ?? "");
  const [terms, setTerms] = useState<string>(s0.policies?.terms ?? "");
  const [warranty, setWarranty] = useState<string>(
    s0.policies?.warranty ?? editing?.warranty ?? (editing ? "" : (productDefaults?.warranty ?? "")),
  );

  // Step 14 — Notifications
  const [notifications, setNotifications] = useState<SubscriptionNotifications>({
    ...DEFAULT_NOTIFICATIONS,
    ...(s0.notifications ?? {}),
  });

  const [saving, setSaving] = useState(false);

  const mainCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const subCategories = useMemo(
    () => categories.filter((c) => c.parent_id && c.parent_id === categoryId),
    [categories, categoryId],
  );

  const reg = Number(regularPrice) || 0;
  const sale = salePrice === "" ? null : Number(salePrice);
  const hasDiscount = sale != null && sale > 0 && sale < reg;
  const finalPrice = hasDiscount ? sale! : reg;

  function buildMeta(): any {
    const subscription: SubscriptionMeta = {
      billing_cycle: cycle,
      custom_cycle: { number: num(cycleNumber), unit: cycleUnit },
      plan_type: planType,
      plan_type_custom: planType === "custom" ? planTypeCustom.trim() || null : null,
      badge: badge.trim() || null,
      setup_fee: num(setupFee),
      tax_included: taxIncluded,
      renewal_price_mode: renewalMode2,
      renewal_price: renewalMode2 === "different" ? num(renewalPrice) : null,
      trial: { enabled: trialEnabled, duration: num(trialDuration), unit: trialUnit },
      activation: { type: activation, delay_hours: num(activationDelay) },
      access_items: accessItems.filter((a) => a.label.trim()),
      usage_limits: usageLimits.filter((u) => u.metric.trim()),
      benefits: benefits.filter((b) => b.title.trim()),
      renewal: {
        mode: renewalMode,
        allow_upgrade: allowUpgrade,
        allow_downgrade: allowDowngrade,
        upgrade_rules: upgradeRules,
        grace_period_days: num(gracePeriod),
        renewal_reminder_days: num(renewalReminder),
        expiry_reminder_days: num(expiryReminder),
        renewal_discount: num(renewalDiscount),
        upgrade_discount: num(upgradeDiscount),
      },
      customer_fields: customerFields.filter((f) => f.label.trim()),
      media: { preview_images: previewImages, promo_video: promoVideo.trim() || null, documents },
      flags: {
        featured: isFeatured,
        popular,
        recommended,
        new: isNew,
        limited_offer: limitedOffer,
      },
      publish_at: publishAt || null,
      policies: { refund, cancellation, renewal: renewalPolicy, terms, warranty },
      notifications,
    };
    return {
      product_type: "subscription",
      subcategory_id: subcategoryId || null,
      seo,
      visibility: { scheduled_at: publishAt || null },
      labels: [
        ...(isFeatured ? ["Featured"] : []),
        ...(popular ? ["Popular"] : []),
        ...(recommended ? ["Recommended"] : []),
        ...(isNew ? ["New"] : []),
        ...(limitedOffer ? ["Limited Offer"] : []),
      ],
      subscription,
    };
  }

  async function persist(nextStatus: "draft" | "active") {
    if (!name.trim()) return toast.error("Enter a subscription name");
    if (!categoryId) return toast.error("Select a subscription category");
    if (!regularPrice || reg <= 0) return toast.error("Enter a regular price");
    if (sale != null && sale >= reg) return toast.error("Sale price must be less than the regular price");
    if (cycle === "custom" && !cycleNumber) return toast.error("Enter the custom billing cycle length");

    setSaving(true);
    try {
      await onSave({
        id: editing?.id,
        name: name.trim(),
        short_description: shortDesc || null,
        description: description || null,
        brand: brand || null,
        price: finalPrice,
        old_price: hasDiscount ? reg : null,
        cost_price: 0,
        stock: 0,
        status: nextStatus,
        primary_image_url: image,
        gallery,
        video_url: introVideo.trim() || null,
        category_id: categoryId || null,
        warranty: warranty || null,
        return_policy: refund || null,
        shipping_info: null,
        is_featured: isFeatured,
        specifications: [],
        variants: [],
        related_product_ids: [],
        product_type: "subscription",
        meta: buildMeta(),
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    {
      id: "general",
      label: "General",
      content: (
        <div className="space-y-4">
          <StepCard title="Subscription information">
            <Field label="Subscription name" required>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pro SaaS Plan"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Subscription category" required>
                <select
                  className={selectCls}
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setSubcategoryId("");
                  }}
                >
                  <option value="">Select category…</option>
                  {mainCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Subcategory">
                <select
                  className={selectCls}
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                  disabled={!subCategories.length}
                >
                  <option value="">{subCategories.length ? "Select…" : "No subcategories"}</option>
                  {subCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Brand / provider">
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Short description">
              <Textarea rows={2} value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} />
            </Field>
            <Field label="Full description">
              <Suspense fallback={<Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />}>
                <RichTextEditor value={description} onChange={setDescription} />
              </Suspense>
            </Field>
          </StepCard>

          <StepCard title="Media & status">
            <Field label="Featured thumbnail">
              <ImageUploader storeId={storeId} folder="products" value={image} onChange={setImage} />
            </Field>
            <Field label="Gallery images">
              <GalleryUploader storeId={storeId} folder="products" value={gallery} onChange={setGallery} />
            </Field>
            <Field label="Intro video URL">
              <Input value={introVideo} onChange={(e) => setIntroVideo(e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Status">
              <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </Field>
          </StepCard>
        </div>
      ),
    },
    {
      id: "plan",
      label: "Plan",
      content: (
        <div className="space-y-4">
          <StepCard title="Billing cycle" description="How often the customer is billed.">
            <Field label="Billing cycle" required>
              <select className={selectCls} value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)}>
                {(Object.keys(BILLING_CYCLE_LABEL) as BillingCycle[]).map((c) => (
                  <option key={c} value={c}>
                    {BILLING_CYCLE_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
            {cycle === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Every" required>
                  <Input
                    type="number"
                    min={1}
                    value={cycleNumber}
                    onChange={(e) => setCycleNumber(e.target.value)}
                    placeholder="3"
                  />
                </Field>
                <Field label="Unit">
                  <select className={selectCls} value={cycleUnit} onChange={(e) => setCycleUnit(e.target.value as CycleUnit)}>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </Field>
              </div>
            )}
          </StepCard>

          <StepCard title="Plan positioning">
            <Field label="Plan type">
              <select className={selectCls} value={planType} onChange={(e) => setPlanType(e.target.value as PlanType)}>
                {(Object.keys(PLAN_TYPE_LABEL) as PlanType[]).map((p) => (
                  <option key={p} value={p}>
                    {PLAN_TYPE_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
            {planType === "custom" && (
              <Field label="Custom plan type name">
                <Input value={planTypeCustom} onChange={(e) => setPlanTypeCustom(e.target.value)} />
              </Field>
            )}
            <Field label="Display badge" hint="Shown on the storefront plan card.">
              <Input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Most Popular" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {BADGE_PRESETS.map((b) => (
                  <Button key={b} type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setBadge(b)}>
                    {b}
                  </Button>
                ))}
              </div>
            </Field>
          </StepCard>
        </div>
      ),
    },
    {
      id: "pricing",
      label: "Pricing",
      content: (
        <div className="space-y-4">
          <StepCard title="Plan price" description={`Charged ${cycleLabel({ billing_cycle: cycle, custom_cycle: { number: num(cycleNumber), unit: cycleUnit } }).toLowerCase()}.`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Regular price (৳)" required>
                <Input type="number" min={0} step="0.01" value={regularPrice} onChange={(e) => setRegularPrice(e.target.value)} />
              </Field>
              <Field label="Sale price (৳)">
                <Input type="number" min={0} step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
              </Field>
              <Field label="Setup fee (৳)" hint="One-time charge on first payment.">
                <Input type="number" min={0} step="0.01" value={setupFee} onChange={(e) => setSetupFee(e.target.value)} />
              </Field>
              <Field label="Tax">
                <select className={selectCls} value={taxIncluded ? "in" : "ex"} onChange={(e) => setTaxIncluded(e.target.value === "in")}>
                  <option value="ex">Tax excluded</option>
                  <option value="in">Tax included</option>
                </select>
              </Field>
            </div>
          </StepCard>

          <StepCard title="Renewal price">
            <Field label="Renewal pricing">
              <select className={selectCls} value={renewalMode2} onChange={(e) => setRenewalMode2(e.target.value as any)}>
                <option value="same">Same price on renewal</option>
                <option value="different">Different renewal price</option>
              </select>
            </Field>
            {renewalMode2 === "different" && (
              <Field label="Renewal price (৳)">
                <Input type="number" min={0} step="0.01" value={renewalPrice} onChange={(e) => setRenewalPrice(e.target.value)} />
              </Field>
            )}
          </StepCard>
        </div>
      ),
    },
    {
      id: "trial",
      label: "Trial",
      content: (
        <div className="space-y-4">
          <StepCard title="Free trial">
            <div className="flex items-center justify-between">
              <span className="text-sm">Enable free trial</span>
              <Switch checked={trialEnabled} onCheckedChange={setTrialEnabled} />
            </div>
            {trialEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Trial duration">
                  <Input type="number" min={1} value={trialDuration} onChange={(e) => setTrialDuration(e.target.value)} />
                </Field>
                <Field label="Unit">
                  <select className={selectCls} value={trialUnit} onChange={(e) => setTrialUnit(e.target.value as TrialUnit)}>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </Field>
              </div>
            )}
          </StepCard>

          <StepCard title="Activation">
            <Field label="Activation type">
              <select className={selectCls} value={activation} onChange={(e) => setActivation(e.target.value as ActivationType)}>
                {(Object.keys(ACTIVATION_LABEL) as ActivationType[]).map((a) => (
                  <option key={a} value={a}>
                    {ACTIVATION_LABEL[a]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Activation delay (hours)" hint="Optional — leave empty for instant activation.">
              <Input type="number" min={0} value={activationDelay} onChange={(e) => setActivationDelay(e.target.value)} />
            </Field>
          </StepCard>
        </div>
      ),
    },
    {
      id: "access",
      label: "Access",
      content: (
        <StepCard title="Access control" description="What the customer unlocks after purchase. Add unlimited rules.">
          <div className="space-y-2">
            {accessItems.map((a, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={a.label}
                    placeholder="Premium Downloads"
                    onChange={(e) =>
                      setAccessItems(accessItems.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                    }
                  />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setAccessItems(accessItems.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Input
                  value={a.note ?? ""}
                  placeholder="Optional note / permission key"
                  onChange={(e) => setAccessItems(accessItems.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setAccessItems([...accessItems, { label: "", note: "" }])}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add access rule
            </Button>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ACCESS_PRESETS.map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => setAccessItems([...accessItems, { label: p }])}
                >
                  + {p}
                </Button>
              ))}
            </div>
          </div>
        </StepCard>
      ),
    },
    {
      id: "usage",
      label: "Usage",
      content: (
        <StepCard title="Usage limits" description="Set unlimited usage or hard limits per metric.">
          <div className="space-y-2">
            {usageLimits.map((u, i) => {
              const upd = (patch: Partial<UsageLimit>) =>
                setUsageLimits(usageLimits.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={i} className="space-y-2 rounded-lg border p-2">
                  <div className="flex items-center gap-2">
                    <Input value={u.metric} placeholder="Downloads" onChange={(e) => upd({ metric: e.target.value })} />
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setUsageLimits(usageLimits.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={u.unlimited} onCheckedChange={(v) => upd({ unlimited: v })} />
                      Unlimited
                    </label>
                    {!u.unlimited && (
                      <Input
                        type="number"
                        min={0}
                        className="w-28"
                        value={u.limit ?? ""}
                        placeholder="Limit"
                        onChange={(e) => upd({ limit: num(e.target.value) })}
                      />
                    )}
                    <select className="h-9 rounded-md border bg-background px-2 text-xs" value={u.reset} onChange={(e) => upd({ reset: e.target.value as ResetPeriod })}>
                      {(Object.keys(RESET_PERIOD_LABEL) as ResetPeriod[]).map((r) => (
                        <option key={r} value={r}>
                          Reset: {RESET_PERIOD_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUsageLimits([...usageLimits, { metric: "", unlimited: true, limit: null, reset: "monthly" }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add usage limit
            </Button>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {USAGE_METRIC_PRESETS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => setUsageLimits([...usageLimits, { metric: m, unlimited: true, limit: null, reset: "monthly" }])}
                >
                  + {m}
                </Button>
              ))}
            </div>
          </div>
        </StepCard>
      ),
    },
    {
      id: "benefits",
      label: "Benefits",
      content: (
        <StepCard title="Membership benefits" description="Benefit cards shown on the plan page. Unlimited items.">
          <div className="space-y-2">
            {benefits.map((b, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={b.title}
                    placeholder="Premium Support"
                    onChange={(e) => setBenefits(benefits.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                  />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setBenefits(benefits.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  value={b.description ?? ""}
                  placeholder="Short description"
                  onChange={(e) => setBenefits(benefits.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setBenefits([...benefits, { title: "", description: "" }])}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add benefit
            </Button>
          </div>
        </StepCard>
      ),
    },
    {
      id: "renewal",
      label: "Renewal",
      content: (
        <div className="space-y-4">
          <StepCard title="Renewal & upgrades">
            <Field label="Renewal mode">
              <select className={selectCls} value={renewalMode} onChange={(e) => setRenewalMode(e.target.value as RenewalMode)}>
                {(Object.keys(RENEWAL_MODE_LABEL) as RenewalMode[]).map((m) => (
                  <option key={m} value={m}>
                    {RENEWAL_MODE_LABEL[m]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-sm">Allow upgrade</span>
              <Switch checked={allowUpgrade} onCheckedChange={setAllowUpgrade} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Allow downgrade</span>
              <Switch checked={allowDowngrade} onCheckedChange={setAllowDowngrade} />
            </div>
            <Field label="Upgrade rules">
              <Textarea rows={3} value={upgradeRules} onChange={(e) => setUpgradeRules(e.target.value)} placeholder="e.g. Remaining balance is credited pro-rata." />
            </Field>
          </StepCard>

          <StepCard title="Reminders & discounts">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Grace period (days)">
                <Input type="number" min={0} value={gracePeriod} onChange={(e) => setGracePeriod(e.target.value)} />
              </Field>
              <Field label="Renewal reminder (days before)">
                <Input type="number" min={0} value={renewalReminder} onChange={(e) => setRenewalReminder(e.target.value)} />
              </Field>
              <Field label="Expiration reminder (days before)">
                <Input type="number" min={0} value={expiryReminder} onChange={(e) => setExpiryReminder(e.target.value)} />
              </Field>
              <Field label="Renewal discount (%)">
                <Input type="number" min={0} max={100} value={renewalDiscount} onChange={(e) => setRenewalDiscount(e.target.value)} />
              </Field>
              <Field label="Upgrade discount (%)">
                <Input type="number" min={0} max={100} value={upgradeDiscount} onChange={(e) => setUpgradeDiscount(e.target.value)} />
              </Field>
            </div>
          </StepCard>
        </div>
      ),
    },
    {
      id: "customer",
      label: "Customer info",
      content: (
        <StepCard title="Customer information fields" description="Extra details collected at checkout. Unlimited fields.">
          <div className="space-y-2">
            {customerFields.map((f, i) => {
              const upd = (patch: Partial<CustomerField>) =>
                setCustomerFields(customerFields.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={i} className="space-y-2 rounded-lg border p-2">
                  <div className="flex items-center gap-2">
                    <Input value={f.label} placeholder="Company Name" onChange={(e) => upd({ label: e.target.value })} />
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setCustomerFields(customerFields.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <select className="h-9 rounded-md border bg-background px-2 text-xs" value={f.type} onChange={(e) => upd({ type: e.target.value as CustomFieldType })}>
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="url">URL / Domain</option>
                      <option value="number">Number</option>
                    </select>
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={f.required} onCheckedChange={(v) => upd({ required: v })} />
                      Required
                    </label>
                  </div>
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={() => setCustomerFields([...customerFields, { label: "", type: "text", required: false }])}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add field
            </Button>
          </div>
        </StepCard>
      ),
    },
    {
      id: "media",
      label: "Media",
      content: (
        <div className="space-y-4">
          <StepCard title="Preview & promo">
            <Field label="Preview images">
              <GalleryUploader storeId={storeId} folder="products" value={previewImages} onChange={setPreviewImages} />
            </Field>
            <Field label="Promotional video URL">
              <Input value={promoVideo} onChange={(e) => setPromoVideo(e.target.value)} placeholder="https://…" />
            </Field>
          </StepCard>
          <StepCard title="Documentation" description="Links to docs, guides or PDFs shared with subscribers.">
            <RepeatableList value={documents} onChange={setDocuments} placeholder="https://…" addLabel="Add document link" />
          </StepCard>
        </div>
      ),
    },
    {
      id: "seo",
      label: "SEO",
      content: (
        <StepCard title="Search engine optimisation">
          <Field label="Meta title">
            <Input value={seo.title ?? ""} onChange={(e) => setSeo({ ...seo, title: e.target.value })} />
          </Field>
          <Field label="Meta description">
            <Textarea rows={2} value={seo.description ?? ""} onChange={(e) => setSeo({ ...seo, description: e.target.value })} />
          </Field>
          <Field label="URL slug">
            <Input value={seo.slug ?? ""} onChange={(e) => setSeo({ ...seo, slug: e.target.value })} placeholder="pro-saas-plan" />
          </Field>
          <Field label="Search keywords">
            <Input value={seo.keywords ?? ""} onChange={(e) => setSeo({ ...seo, keywords: e.target.value })} placeholder="saas, membership, pro plan" />
          </Field>
        </StepCard>
      ),
    },
    {
      id: "visibility",
      label: "Visibility",
      content: (
        <div className="space-y-4">
          <StepCard title="Plan highlights">
            {[
              ["Featured plan", isFeatured, setIsFeatured],
              ["Popular plan", popular, setPopular],
              ["Recommended", recommended, setRecommended],
              ["New", isNew, setIsNew],
              ["Limited time offer", limitedOffer, setLimitedOffer],
            ].map(([label, val, set]: any) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch checked={val} onCheckedChange={set} />
              </div>
            ))}
          </StepCard>
          <StepCard title="Publishing">
            <Field label="Schedule publish" hint="Leave empty to publish immediately.">
              <Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
            </Field>
          </StepCard>
        </div>
      ),
    },
    {
      id: "policies",
      label: "Policies",
      content: (
        <StepCard title="Subscription policies">
          <Field label="Refund policy">
            <Textarea rows={3} value={refund} onChange={(e) => setRefund(e.target.value)} />
          </Field>
          <Field label="Cancellation policy">
            <Textarea rows={3} value={cancellation} onChange={(e) => setCancellation(e.target.value)} />
          </Field>
          <Field label="Renewal policy">
            <Textarea rows={3} value={renewalPolicy} onChange={(e) => setRenewalPolicy(e.target.value)} />
          </Field>
          <Field label="Terms & conditions">
            <Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </Field>
          <Field label="Warranty / support">
            <Textarea rows={3} value={warranty} onChange={(e) => setWarranty(e.target.value)} />
          </Field>
        </StepCard>
      ),
    },
    {
      id: "notifications",
      label: "Notifications",
      content: (
        <StepCard title="Automatic emails" description="Toggle each subscription email individually.">
          {(Object.keys(NOTIFICATION_LABEL) as (keyof SubscriptionNotifications)[]).map((k) => (
            <div key={k} className="flex items-center justify-between border-b py-2 last:border-0">
              <span className="text-sm">{NOTIFICATION_LABEL[k]}</span>
              <Switch
                checked={notifications[k]}
                onCheckedChange={(v) => setNotifications({ ...notifications, [k]: v })}
              />
            </div>
          ))}
        </StepCard>
      ),
    },
    {
      id: "review",
      label: "Review",
      content: (
        <StepCard title="Review before publishing">
          <dl className="divide-y text-sm">
            {[
              ["Name", name || "—"],
              ["Category", mainCategories.find((c) => c.id === categoryId)?.name ?? "—"],
              ["Billing", cycleLabel({ billing_cycle: cycle, custom_cycle: { number: num(cycleNumber), unit: cycleUnit } })],
              ["Plan type", planType === "custom" ? planTypeCustom || "Custom" : PLAN_TYPE_LABEL[planType]],
              ["Price", `৳${finalPrice}${hasDiscount ? ` (was ৳${reg})` : ""}`],
              ["Setup fee", setupFee ? `৳${setupFee}` : "—"],
              ["Renewal price", renewalMode2 === "different" && renewalPrice ? `৳${renewalPrice}` : "Same as plan price"],
              ["Free trial", trialEnabled ? `${trialDuration} ${trialUnit}` : "No"],
              ["Activation", ACTIVATION_LABEL[activation]],
              ["Access rules", String(accessItems.filter((a) => a.label.trim()).length)],
              ["Usage limits", String(usageLimits.filter((u) => u.metric.trim()).length)],
              ["Benefits", String(benefits.filter((b) => b.title.trim()).length)],
              ["Renewal mode", RENEWAL_MODE_LABEL[renewalMode]],
              ["Customer fields", String(customerFields.filter((f) => f.label.trim()).length)],
              ["Emails enabled", String(Object.values(notifications).filter(Boolean).length)],
              ["Publish", publishAt ? `Scheduled — ${publishAt.replace("T", " ")}` : "Publish now"],
              ["Status", status === "draft" ? "Draft" : "Active"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="truncate font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {editing?.id && editing?.slug && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(`/store/${(editing as any).store_slug ?? ""}/product/${editing.id}`, "_blank")}
            >
              Preview on storefront
            </Button>
          )}
        </StepCard>
      ),
    },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-3 py-3 sm:px-4">
          <DialogTitle className="text-base sm:text-lg">
            {editing ? "Edit subscription" : "Create subscription"}
          </DialogTitle>
        </DialogHeader>
        <FormWizard
          tabs={tabs}
          saving={saving}
          editing={!!editing}
          entityLabel="subscription"
          onCancel={onClose}
          onSaveDraft={() => persist("draft")}
          onSubmit={(e) => {
            e.preventDefault();
            persist(status);
          }}
          footerInfo="Subscription plans have no stock, shipping or variants — only subscription fields are saved."
        />
      </DialogContent>
    </Dialog>
  );
}
