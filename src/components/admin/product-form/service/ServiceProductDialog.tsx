// Dedicated 12-step Service product form. Fully isolated from physical /
// digital / subscription forms — no stock, shipping or variant fields.
import { lazy, Suspense, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  applyDescriptionFooter,
  defaultsForType,
  mergeTags,
  resolveDefaultStatus,
} from "@/lib/product-defaults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { GalleryUploader } from "@/components/admin/GalleryUploader";
import { Field, RepeatableList, ServiceWizard, StepCard, selectCls } from "./ui";
import {
  AVAILABILITY_LABEL,
  BOOKING_TYPE_LABEL,
  PRICING_TYPE_LABEL,
  WEEK_DAYS,
  type BeforeAfter,
  type ServiceAddon,
  type ServiceAvailability,
  type ServiceBookingType,
  type ServiceFaq,
  type ServiceMeta,
  type ServicePricingType,
} from "./service-meta";

const RichTextEditor = lazy(() => import("../RichTextEditor"));

type Category = { id: string; name: string; parent_id?: string | null };

const newPkgId = () => `pkg_${Math.random().toString(36).slice(2, 10)}`;

export function ServiceProductDialog({
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
  productDefaults: any;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const meta0 = (editing?.meta ?? {}) as any;

  const pd = defaultsForType(productDefaults, "service");
  const svc0 = (meta0.service ?? {}) as ServiceMeta;

  // Step 1 — General
  const [name, setName] = useState<string>(editing?.name ?? "");
  const [categoryId, setCategoryId] = useState<string>(editing?.category_id ?? "");
  const [subcategoryId, setSubcategoryId] = useState<string>(meta0.subcategory_id ?? "");
  const [brand, setBrand] = useState<string>(editing?.brand ?? "");
  const [shortDesc, setShortDesc] = useState<string>(editing?.short_description ?? "");
  const [description, setDescription] = useState<string>(
    editing ? (editing.description ?? "") : applyDescriptionFooter("", pd.footer),
  );
  const [image, setImage] = useState<string | null>(editing?.primary_image_url ?? null);
  const [gallery, setGallery] = useState<string[]>(Array.isArray(editing?.gallery) ? editing.gallery : []);
  const [introVideo, setIntroVideo] = useState<string>(editing?.video_url ?? "");
  const [status, setStatus] = useState<"draft" | "active">(
    editing ? (editing.status === "draft" ? "draft" : "active") : resolveDefaultStatus(pd),
  );

  // Step 2 — Pricing
  const [pricingType, setPricingType] = useState<ServicePricingType>(svc0.pricing_type ?? "fixed");
  const [regularPrice, setRegularPrice] = useState<string>(
    editing?.old_price != null ? String(editing.old_price) : editing ? String(editing.price) : "",
  );
  const [salePrice, setSalePrice] = useState<string>(
    editing?.old_price != null && Number(editing.old_price) > Number(editing.price) ? String(editing.price) : "",
  );
  const [taxIncluded, setTaxIncluded] = useState<boolean>(svc0.tax_included ?? false);
  const [isFeatured, setIsFeatured] = useState<boolean>(!!editing?.is_featured);

  // Step 3 — Delivery
  const [delTime, setDelTime] = useState<string>(svc0.delivery?.time != null ? String(svc0.delivery.time) : "");
  const [delUnit, setDelUnit] = useState<"hours" | "days" | "weeks">(svc0.delivery?.unit ?? "days");
  const [express, setExpress] = useState<boolean>(svc0.delivery?.express ?? false);
  const [expressFee, setExpressFee] = useState<string>(
    svc0.delivery?.express_fee != null ? String(svc0.delivery.express_fee) : "",
  );
  const [expressTime, setExpressTime] = useState<string>(svc0.delivery?.express_time ?? "");
  const [availability, setAvailability] = useState<ServiceAvailability>(svc0.availability ?? "available");
  const [maxOrders, setMaxOrders] = useState<string>(svc0.max_orders != null ? String(svc0.max_orders) : "");
  const [maxOrdersPeriod, setMaxOrdersPeriod] = useState<"day" | "week" | "month">(
    svc0.max_orders_period ?? "day",
  );

  // Step 4 — Service details
  const [included, setIncluded] = useState<string[]>(svc0.included ?? []);
  const [requirements, setRequirements] = useState<string[]>(svc0.requirements ?? []);
  const [deliverables, setDeliverables] = useState<string[]>(svc0.deliverables ?? []);

  // Step 5 — Booking
  const [bookingType, setBookingType] = useState<ServiceBookingType>(svc0.booking?.type ?? "request");
  const [workingDays, setWorkingDays] = useState<string[]>(svc0.booking?.working_days ?? []);
  const [hoursStart, setHoursStart] = useState<string>(svc0.booking?.working_hours?.start ?? "09:00");
  const [hoursEnd, setHoursEnd] = useState<string>(svc0.booking?.working_hours?.end ?? "18:00");
  const [slotMinutes, setSlotMinutes] = useState<string>(
    svc0.booking?.slot_minutes != null ? String(svc0.booking.slot_minutes) : "60",
  );
  const [bufferMinutes, setBufferMinutes] = useState<string>(
    svc0.booking?.buffer_minutes != null ? String(svc0.booking.buffer_minutes) : "0",
  );

  // Step 6 — Media
  const [portfolio, setPortfolio] = useState<string[]>(svc0.media?.portfolio ?? []);
  const [beforeAfter, setBeforeAfter] = useState<BeforeAfter[]>(svc0.media?.before_after ?? []);
  const [demoVideo, setDemoVideo] = useState<string>(svc0.media?.demo_video ?? "");

  // Step 7 — Add-ons
  const [addons, setAddons] = useState<ServiceAddon[]>(svc0.addons ?? []);

  // Packages (Basic / Standard / Premium) — saved as product variants so the
  // storefront picker, cart and server-side pricing reuse the variant path.
  const [packages, setPackages] = useState<{ id: string; name: string; price: string; description: string }[]>(() => {
    const v = editing?.variants;
    if (!v || !Array.isArray(v.items)) return [];
    return v.items.map((it: any) => ({
      id: String(it.id),
      name: String(it.options?.Package ?? Object.values(it.options ?? {})[0] ?? ""),
      price: it.price != null ? String(it.price) : "",
      description: String(it.description ?? ""),
    }));
  });
  const cleanPkgs = packages
    .filter((p) => p.name.trim() && Number(p.price) > 0)
    .map((p) => ({ id: p.id, name: p.name.trim(), price: Number(p.price), description: p.description.trim() }));

  // Step 8 — FAQ
  const [faq, setFaq] = useState<ServiceFaq[]>(svc0.faq ?? []);

  // Step 9 — SEO
  const [seo, setSeo] = useState<{ title?: string; description?: string; slug?: string; keywords?: string }>(
    editing
      ? (meta0.seo ?? {})
      : { ...(meta0.seo ?? {}), keywords: mergeTags((meta0.seo as any)?.keywords, pd.tags) },
  );

  // Step 10 — Visibility
  const [bestSeller, setBestSeller] = useState<boolean>(svc0.flags?.best_seller ?? false);
  const [recommended, setRecommended] = useState<boolean>(svc0.flags?.recommended ?? false);
  const [isNew, setIsNew] = useState<boolean>(svc0.flags?.new ?? false);
  const [scheduledAt, setScheduledAt] = useState<string>(meta0.visibility?.scheduled_at ?? "");

  // Step 11 — Policies
  const [refund, setRefund] = useState<string>(
    svc0.policies?.refund ?? editing?.return_policy ?? "",
  );
  const [cancellation, setCancellation] = useState<string>(svc0.policies?.cancellation ?? "");
  const [terms, setTerms] = useState<string>(svc0.policies?.terms ?? "");
  const [warranty, setWarranty] = useState<string>(
    svc0.policies?.warranty ?? editing?.warranty ?? "",
  );

  const [saving, setSaving] = useState(false);

  const mainCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const subCategories = useMemo(
    () => categories.filter((c) => c.parent_id && c.parent_id === categoryId),
    [categories, categoryId],
  );

  const isQuote = pricingType === "quote";
  const reg = Number(regularPrice) || 0;
  const sale = salePrice === "" ? null : Number(salePrice);
  const hasDiscount = !isQuote && sale != null && sale > 0 && sale < reg;
  const finalPrice = isQuote ? 0 : hasDiscount ? sale! : reg;

  function toggleDay(d: string) {
    setWorkingDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function buildMeta(): any {
    const service: ServiceMeta = {
      pricing_type: pricingType,
      tax_included: taxIncluded,
      delivery: {
        time: delTime === "" ? null : Number(delTime),
        unit: delUnit,
        express,
        express_fee: expressFee === "" ? null : Number(expressFee),
        express_time: expressTime.trim() || null,
      },
      availability,
      max_orders: maxOrders === "" ? null : Number(maxOrders),
      max_orders_period: maxOrdersPeriod,
      included: included.map((s) => s.trim()).filter(Boolean),
      requirements: requirements.map((s) => s.trim()).filter(Boolean),
      deliverables: deliverables.map((s) => s.trim()).filter(Boolean),
      booking: {
        type: bookingType,
        working_days: workingDays,
        working_hours: { start: hoursStart, end: hoursEnd },
        slot_minutes: slotMinutes === "" ? null : Number(slotMinutes),
        buffer_minutes: bufferMinutes === "" ? null : Number(bufferMinutes),
      },
      media: {
        portfolio,
        before_after: beforeAfter.filter((b) => b.before || b.after),
        demo_video: demoVideo.trim() || null,
      },
      addons: addons
        .filter((a) => a.name.trim())
        .map((a) => ({ name: a.name.trim(), price: a.price ?? null, description: a.description ?? "" })),
      faq: faq.filter((f) => f.question.trim()),
      policies: { refund, cancellation, terms, warranty },
      flags: { best_seller: bestSeller, recommended, new: isNew },
      booking_type: bookingType,
      delivery_time: delTime ? `${delTime} ${delUnit}` : null,
    };
    return {
      product_type: "service",
      subcategory_id: subcategoryId || null,
      quote_only: isQuote,
      seo,
      visibility: { scheduled_at: scheduledAt || null },
      labels: [
        ...(isFeatured ? ["Featured"] : []),
        ...(bestSeller ? ["Best Seller"] : []),
        ...(recommended ? ["Recommended"] : []),
        ...(isNew ? ["New"] : []),
      ],
      service,
    };
  }

  async function persist(nextStatus: "draft" | "active") {
    if (!name.trim()) {
      toast.error("Enter a service name");
      return;
    }
    if (!categoryId) {
      toast.error("Select a category");
      return;
    }
    if (packages.some((p) => p.name.trim() && !(Number(p.price) > 0))) {
      toast.error("প্রতিটা প্যাকেজের দাম দিন");
      return;
    }
    if (!isQuote && (!regularPrice || reg <= 0)) {
      toast.error("Enter a regular price, or choose Custom quote pricing");
      return;
    }
    if (sale != null && !isQuote && sale > reg) {
      toast.error("Sale price must be less than the regular price");
      return;
    }
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
        primary_image_url: image || gallery[0] || null,
        gallery,
        video_url: introVideo.trim() || null,
        category_id: categoryId || null,
        warranty: warranty || null,
        return_policy: refund || null,
        shipping_info: null,
        is_featured: isFeatured,
        specifications: [],
        variants: cleanPkgs.length
          ? {
              options: [{ name: "Package", values: cleanPkgs.map((p) => p.name) }],
              items: cleanPkgs.map((p) => ({ id: p.id, options: { Package: p.name }, price: p.price, description: p.description })),
            }
          : [],
        related_product_ids: [],
        product_type: "service",
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
          <StepCard title="Service information">
            <Field label="Service name" required>
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Web Development" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category" required>
                <select
                  className={selectCls}
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setSubcategoryId("");
                  }}
                >
                  <option value="">Select category</option>
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
                  <option value="">{subCategories.length ? "Select subcategory" : "No subcategories"}</option>
                  {subCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Brand / provider name">
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Short description" hint="Shown on cards and search results.">
              <Textarea rows={2} value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} />
            </Field>
            <Field label="Full description">
              <Suspense fallback={<div className="h-32 rounded-md border bg-muted/30" />}>
                <RichTextEditor value={description} onChange={setDescription} />
              </Suspense>
            </Field>
          </StepCard>
          <StepCard title="Media & status">
            <Field label="Thumbnail">
              <ImageUploader storeId={storeId} value={image} onChange={setImage} />
            </Field>
            <Field label="Gallery">
              <GalleryUploader storeId={storeId} value={gallery} onChange={setGallery} />
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
      id: "pricing",
      label: "Pricing",
      content: (
        <StepCard title="Pricing" description="Choose how customers are charged for this service.">
          <Field label="Pricing type">
            <select className={selectCls} value={pricingType} onChange={(e) => setPricingType(e.target.value as any)}>
              {(Object.keys(PRICING_TYPE_LABEL) as ServicePricingType[]).map((k) => (
                <option key={k} value={k}>
                  {PRICING_TYPE_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          {isQuote ? (
            <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              Custom quote: no price is shown on the storefront. Customers submit a request instead of paying up front.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Regular price (BDT)" required>
                  <Input
                    type="number"
                    min={0}
                    value={regularPrice}
                    onChange={(e) => setRegularPrice(e.target.value)}
                  />
                </Field>
                <Field label="Sale price (BDT)" hint="Leave empty for no discount.">
                  <Input type="number" min={0} value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
                </Field>
              </div>
              {hasDiscount && (
                <Badge variant="secondary">
                  {Math.round(((reg - sale!) / reg) * 100)}% off — customers pay ৳{sale}
                </Badge>
              )}
            </>
          )}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">Tax included in price</span>
            <Switch checked={taxIncluded} onCheckedChange={setTaxIncluded} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">Featured service</span>
            <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
          </div>
        </StepCard>
      ),
    },
    {
      id: "delivery",
      label: "Delivery",
      content: (
        <div className="space-y-4">
          <StepCard title="Delivery time">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Estimated delivery">
                <Input type="number" min={0} value={delTime} onChange={(e) => setDelTime(e.target.value)} />
              </Field>
              <Field label="Unit">
                <select className={selectCls} value={delUnit} onChange={(e) => setDelUnit(e.target.value as any)}>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                </select>
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">Offer express delivery</span>
              <Switch checked={express} onCheckedChange={setExpress} />
            </div>
            {express && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Express fee (BDT)">
                  <Input type="number" min={0} value={expressFee} onChange={(e) => setExpressFee(e.target.value)} />
                </Field>
                <Field label="Express delivery time">
                  <Input value={expressTime} onChange={(e) => setExpressTime(e.target.value)} placeholder="e.g. 24 hours" />
                </Field>
              </div>
            )}
          </StepCard>
          <StepCard title="Availability & capacity">
            <Field label="Availability">
              <select
                className={selectCls}
                value={availability}
                onChange={(e) => setAvailability(e.target.value as any)}
              >
                {(Object.keys(AVAILABILITY_LABEL) as ServiceAvailability[]).map((k) => (
                  <option key={k} value={k}>
                    {AVAILABILITY_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Max orders" hint="Leave empty for unlimited.">
                <Input type="number" min={0} value={maxOrders} onChange={(e) => setMaxOrders(e.target.value)} />
              </Field>
              <Field label="Per">
                <select
                  className={selectCls}
                  value={maxOrdersPeriod}
                  onChange={(e) => setMaxOrdersPeriod(e.target.value as any)}
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </Field>
            </div>
          </StepCard>
        </div>
      ),
    },
    {
      id: "details",
      label: "Service details",
      content: (
        <div className="space-y-4">
          <StepCard title="What's included" description="Everything the customer gets with this service.">
            <RepeatableList value={included} onChange={setIncluded} placeholder="e.g. 5 pages responsive website" addLabel="Add included item" />
          </StepCard>
          <StepCard title="Customer requirements" description="What you need from the customer to start.">
            <RepeatableList value={requirements} onChange={setRequirements} placeholder="e.g. Brand logo files" addLabel="Add requirement" />
          </StepCard>
          <StepCard title="Deliverables" description="What is handed over at the end.">
            <RepeatableList value={deliverables} onChange={setDeliverables} placeholder="e.g. Source code + documentation" addLabel="Add deliverable" />
          </StepCard>
        </div>
      ),
    },
    {
      id: "booking",
      label: "Booking",
      content: (
        <StepCard title="Booking & workflow">
          <Field label="Booking type">
            <select className={selectCls} value={bookingType} onChange={(e) => setBookingType(e.target.value as any)}>
              {(Object.keys(BOOKING_TYPE_LABEL) as ServiceBookingType[]).map((k) => (
                <option key={k} value={k}>
                  {BOOKING_TYPE_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          {bookingType === "appointment" && (
            <div className="space-y-3 rounded-lg border p-3">
              <Field label="Working days">
                <div className="flex flex-wrap gap-2">
                  {WEEK_DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        workingDays.includes(d)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Start time">
                  <Input type="time" value={hoursStart} onChange={(e) => setHoursStart(e.target.value)} />
                </Field>
                <Field label="End time">
                  <Input type="time" value={hoursEnd} onChange={(e) => setHoursEnd(e.target.value)} />
                </Field>
                <Field label="Slot duration (minutes)">
                  <Input type="number" min={5} value={slotMinutes} onChange={(e) => setSlotMinutes(e.target.value)} />
                </Field>
                <Field label="Buffer between slots (minutes)">
                  <Input type="number" min={0} value={bufferMinutes} onChange={(e) => setBufferMinutes(e.target.value)} />
                </Field>
              </div>
            </div>
          )}
        </StepCard>
      ),
    },
    {
      id: "media",
      label: "Media",
      content: (
        <div className="space-y-4">
          <StepCard title="Portfolio images" description="Past work samples shown on the service page.">
            <GalleryUploader storeId={storeId} value={portfolio} onChange={setPortfolio} max={12} />
          </StepCard>
          <StepCard title="Before / after">
            <div className="space-y-3">
              {beforeAfter.map((pair, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <Input
                      value={pair.label ?? ""}
                      placeholder="Label (optional)"
                      onChange={(e) =>
                        setBeforeAfter(beforeAfter.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove pair"
                      onClick={() => setBeforeAfter(beforeAfter.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Before">
                      <ImageUploader
                        storeId={storeId}
                        value={pair.before}
                        onChange={(v) => setBeforeAfter(beforeAfter.map((p, j) => (j === i ? { ...p, before: v } : p)))}
                      />
                    </Field>
                    <Field label="After">
                      <ImageUploader
                        storeId={storeId}
                        value={pair.after}
                        onChange={(v) => setBeforeAfter(beforeAfter.map((p, j) => (j === i ? { ...p, after: v } : p)))}
                      />
                    </Field>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBeforeAfter([...beforeAfter, { before: null, after: null }])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add before/after
              </Button>
            </div>
          </StepCard>
          <StepCard title="Demo video">
            <Field label="Demo video URL">
              <Input value={demoVideo} onChange={(e) => setDemoVideo(e.target.value)} placeholder="https://…" />
            </Field>
          </StepCard>
        </div>
      ),
    },
    {
      id: "addons",
      label: "Add-ons",
      content: (
        <StepCard title="Optional add-ons" description="Extras a customer can add while booking.">
          <div className="space-y-3">
            {addons.map((a, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={a.name}
                    placeholder="Add-on name"
                    onChange={(e) => setAddons(addons.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  />
                  <Input
                    type="number"
                    min={0}
                    className="w-28"
                    placeholder="Price"
                    value={a.price ?? ""}
                    onChange={(e) =>
                      setAddons(
                        addons.map((x, j) =>
                          j === i ? { ...x, price: e.target.value === "" ? null : Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove add-on"
                    onClick={() => setAddons(addons.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Description (optional)"
                  value={a.description ?? ""}
                  onChange={(e) =>
                    setAddons(addons.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))
                  }
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddons([...addons, { name: "", price: null, description: "" }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add add-on
            </Button>
          </div>
        </StepCard>
      ),
    },
    {
      id: "faq",
      label: "FAQ",
      content: (
        <StepCard title="Frequently asked questions">
          <div className="space-y-3">
            {faq.map((f, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={f.question}
                    placeholder="Question"
                    onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove FAQ"
                    onClick={() => setFaq(faq.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Answer"
                  value={f.answer}
                  onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
                />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setFaq([...faq, { question: "", answer: "" }])}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add FAQ
            </Button>
          </div>
        </StepCard>
      ),
    },
    {
      id: "seo",
      label: "SEO",
      content: (
        <StepCard title="Search engine optimization">
          <Field label="Meta title" hint="Up to 60 characters.">
            <Input value={seo.title ?? ""} onChange={(e) => setSeo({ ...seo, title: e.target.value })} />
          </Field>
          <Field label="Meta description" hint="Up to 155 characters.">
            <Textarea rows={2} value={seo.description ?? ""} onChange={(e) => setSeo({ ...seo, description: e.target.value })} />
          </Field>
          <Field label="URL slug">
            <Input value={seo.slug ?? ""} onChange={(e) => setSeo({ ...seo, slug: e.target.value })} placeholder="web-development" />
          </Field>
          <Field label="Keywords" hint="Comma separated.">
            <Input value={seo.keywords ?? ""} onChange={(e) => setSeo({ ...seo, keywords: e.target.value })} />
          </Field>
        </StepCard>
      ),
    },
    {
      id: "visibility",
      label: "Visibility",
      content: (
        <StepCard title="Visibility & scheduling">
          {[
            ["Featured", isFeatured, setIsFeatured] as const,
            ["Best seller", bestSeller, setBestSeller] as const,
            ["Recommended", recommended, setRecommended] as const,
            ["New service", isNew, setIsNew] as const,
          ].map(([label, val, set]) => (
            <div key={label} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">{label}</span>
              <Switch checked={val} onCheckedChange={set as any} />
            </div>
          ))}
          <Field label="Schedule publish" hint="Leave empty to publish immediately.">
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </Field>
        </StepCard>
      ),
    },
    {
      id: "policies",
      label: "Policies",
      content: (
        <StepCard title="Policies">
          <Field label="Refund policy">
            <Textarea rows={3} value={refund} onChange={(e) => setRefund(e.target.value)} />
          </Field>
          <Field label="Cancellation policy">
            <Textarea rows={3} value={cancellation} onChange={(e) => setCancellation(e.target.value)} />
          </Field>
          <Field label="Service terms">
            <Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </Field>
          <Field label="Warranty / support">
            <Textarea rows={3} value={warranty} onChange={(e) => setWarranty(e.target.value)} />
          </Field>
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
              ["Pricing", isQuote ? "Custom quote" : `${PRICING_TYPE_LABEL[pricingType]} — ৳${finalPrice}`],
              ["Delivery", delTime ? `${delTime} ${delUnit}${express ? " (express available)" : ""}` : "—"],
              ["Availability", AVAILABILITY_LABEL[availability]],
              ["Booking", BOOKING_TYPE_LABEL[bookingType]],
              ["Included", String(included.filter(Boolean).length)],
              ["Requirements", String(requirements.filter(Boolean).length)],
              ["Deliverables", String(deliverables.filter(Boolean).length)],
              ["Packages", cleanPkgs.length ? cleanPkgs.map((p) => `${p.name} ৳${p.price}`).join(", ") : "—"],
              ["Add-ons", String(addons.filter((a) => a.name.trim()).length)],
              ["FAQ", String(faq.filter((f) => f.question.trim()).length)],
              ["Portfolio images", String(portfolio.length)],
              ["Status", status === "draft" ? "Draft" : "Active"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="truncate font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </StepCard>
      ),
    },
  ];

  const T = (id: string) => tabs.find((t) => t.id === id)!.content;
  const issues: string[] = [];
  if (!name.trim()) issues.push("সার্ভিসের নাম দিন (ধাপ ১)");
  if (!categoryId) issues.push("ক্যাটাগরি বেছে নিন (ধাপ ১)");
  if (!isQuote && (!regularPrice || reg <= 0)) issues.push("দাম দিন (ধাপ ২)");
  if (!isQuote && sale != null && sale >= reg) issues.push("অফার দাম মূল দামের চেয়ে কম হতে হবে");
  if (!delTime) issues.push("কাজ শেষ হতে কত সময় লাগবে লিখুন (ধাপ ২)");
  if (!image) issues.push("একটি ছবি দিলে ভালো হয় (ঐচ্ছিক)");
  const steps = [
    { id: "basic", label: "Basic info", content: T("general") },
    {
      id: "price",
      label: "Price, Time & Booking",
      content: (
        <div className="space-y-4">
          {T("pricing")}
          {T("delivery")}
          {T("booking")}
          <StepCard title="প্যাকেজ (Basic / Standard / Premium) — ঐচ্ছিক">
            <p className="mb-3 text-xs text-muted-foreground">
              প্যাকেজ দিলে কাস্টমার দোকানে একটা বেছে নেবে, আর সেই প্যাকেজের দামই নেওয়া হবে। না দিলে উপরের দামই থাকবে।
            </p>
            <div className="space-y-3">
              {packages.map((p, i) => (
                <div key={p.id} className="space-y-2 rounded-lg border p-3">
                  <div className="grid grid-cols-[1fr_110px_auto] gap-2">
                    <Input placeholder="নাম (যেমন Basic)" value={p.name} onChange={(e) => setPackages(packages.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <Input type="number" min={0} placeholder="দাম ৳" value={p.price} onChange={(e) => setPackages(packages.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setPackages(packages.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Input placeholder="কী কী থাকবে (ছোট করে)" value={p.description} onChange={(e) => setPackages(packages.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {packages.length === 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setPackages(["Basic", "Standard", "Premium"].map((n) => ({ id: newPkgId(), name: n, price: "", description: "" })))}>
                    Basic / Standard / Premium যোগ করুন
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => setPackages([...packages, { id: newPkgId(), name: "", price: "", description: "" }])}>
                  <Plus className="mr-1 h-4 w-4" /> প্যাকেজ যোগ করুন
                </Button>
              </div>
            </div>
          </StepCard>
          <Fold title="Add-ons (অতিরিক্ত সেবা)">{T("addons")}</Fold>
        </div>
      ),
    },
    {
      id: "review",
      label: "Review & Publish",
      content: (
        <div className="space-y-4">
          {T("review")}
          {issues.length ? (
            <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {issues.map((m) => <li key={m}>• {m}</li>)}
            </ul>
          ) : (
            <p className="rounded-md bg-primary/10 p-3 text-xs text-primary">সব ঠিক আছে — নিচের বাটনে চাপ দিয়ে Publish করুন।</p>
          )}
          {T("visibility")}
          <Fold title="কী কী পাবেন, Requirements ও Deliverables">{T("details")}</Fold>
          <Fold title="Portfolio ও ভিডিও">{T("media")}</Fold>
          <Fold title="FAQ">{T("faq")}</Fold>
          <Fold title="Policies">{T("policies")}</Fold>
          <Fold title="SEO">{T("seo")}</Fold>
        </div>
      ),
    },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-3 py-3 sm:px-4">
          <DialogTitle className="text-base sm:text-lg">
            {editing ? "Edit service" : "Create service"}
          </DialogTitle>
        </DialogHeader>
        <ServiceWizard
          tabs={steps}
          saving={saving}
          editing={!!editing}
          onCancel={onClose}
          onSaveDraft={() => persist("draft")}
          onSubmit={(e) => {
            e.preventDefault();
            persist(status);
          }}
          footerInfo="Service products have no stock, shipping or variants — only service fields are saved."
        />
      </DialogContent>
    </Dialog>
  );
}

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border">
      <summary className="cursor-pointer list-none p-3 text-sm font-medium">
        <span className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>
        {title} <span className="text-xs text-muted-foreground">(ঐচ্ছিক)</span>
      </summary>
      <div className="border-t p-3">{children}</div>
    </details>
  );
}
