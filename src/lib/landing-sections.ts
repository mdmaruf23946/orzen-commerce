// Landing Page section registry.
//
// SINGLE SOURCE OF TRUTH for:
//   • the Content tab (Used Sections + Section Library)
//   • the generic section editors
//   • the published page renderer
//   • the AI field manifest / section selection
//
// Adding a section here makes it appear in the library, get an editor, render
// on the page and become available to the AI generator — no other change needed.

export type LPFieldSpec =
  | {
      key: string;
      type: "text" | "textarea" | "image" | "products";
      label: string;
      max?: number;
      /** Max picked products (products field only). */
      maxItems?: number;
      placeholder?: string;
      /** Guidance handed to the AI generator. Omit to hide the field from AI. */
      ai?: string;
    }
  | {
      key: string;
      type: "list";
      label: string;
      itemLabel: string;
      maxItems: number;
      ai?: string;
      fields: LPFieldSpec[];
    };

/** Specialised public renderers. Undefined = the standard generic layout. */
export type LPRender = "before_after" | "video" | "gallery" | "products";

export type LPSectionSpec = {
  key: string;
  name: string;
  description: string;
  /** Required sections are always visible and cannot be removed. */
  required: boolean;
  /** Hand-written editor + renderer (the original eight sections). */
  builtin: boolean;
  /** Shown inside the editor: where the data comes from. */
  note?: string;
  /** Specialised frontend renderer for this section. */
  render?: LPRender;
  /** Where the product cards come from (render: "products" only). */
  productSource?: "picked" | "related" | "recent";
  fields: LPFieldSpec[];
};

const t = (key: string, label: string, max: number, ai?: string): LPFieldSpec => ({ key, type: "text", label, max, ai });
const ta = (key: string, label: string, max: number, ai?: string): LPFieldSpec => ({ key, type: "textarea", label, max, ai });
const img = (key: string, label: string): LPFieldSpec => ({ key, type: "image", label });

/** Registry in the recommended default page order. */
export const SECTION_REGISTRY: LPSectionSpec[] = [
  { key: "header", name: "Header", description: "Store identity and navigation", required: true, builtin: true, fields: [] },
  { key: "hero", name: "Hero", description: "Main product introduction and offer", required: true, builtin: true, fields: [] },
  {
    key: "trustbar",
    name: "Trust Bar",
    description: "Short trust points shown under the hero",
    required: false,
    builtin: false,
    fields: [
      {
        key: "items", type: "list", label: "Trust items", itemLabel: "Trust item", maxItems: 6,
        ai: "Short trust points based only on real store facts (cash on delivery, warranty, delivery time).",
        fields: [
          t("icon", "Icon", 20, "One icon name: check, shield, truck, star, clock, award, package, zap, gift, heart."),
          t("title", "Title", 40, "2-4 words."),
          t("text", "Short text", 90, "One short supporting line."),
        ],
      },
    ],
  },
  { key: "product", name: "Product", description: "Product information and features", required: false, builtin: true, fields: [] },
  {
    key: "highlights",
    name: "Product Highlights",
    description: "The strongest selling points at a glance",
    required: false,
    builtin: false,
    fields: [
      t("title", "Section title", 60, "Heading for the highlights section."),
      {
        key: "items", type: "list", label: "Highlights", itemLabel: "Highlight", maxItems: 8,
        ai: "Key product highlights taken from the supplied product facts only.",
        fields: [
          t("icon", "Icon", 20, "One icon name: check, star, shield, truck, zap, award, package, sparkles."),
          t("title", "Title", 50, "Short highlight title."),
          ta("text", "Description", 160, "One short sentence."),
        ],
      },
    ],
  },
  {
    key: "benefits",
    name: "Benefits",
    description: "Why the customer should buy",
    required: false,
    builtin: false,
    fields: [
      t("title", "Section title", 60, "Heading for the benefits section."),
      {
        key: "items", type: "list", label: "Benefits", itemLabel: "Benefit", maxItems: 8,
        ai: "Customer-facing benefits. No invented specifics.",
        fields: [
          t("icon", "Icon", 20, "One icon name: check, star, shield, truck, zap, heart, award, gift."),
          t("title", "Title", 50, "Short benefit title."),
          ta("text", "Description", 160, "One short sentence."),
        ],
      },
    ],
  },
  {
    key: "problem_solution",
    name: "Problem → Solution",
    description: "The problem the product solves",
    required: false,
    builtin: false,
    fields: [
      t("problemTitle", "Problem title", 60, "Heading for the problem side."),
      {
        key: "problems", type: "list", label: "Problem items", itemLabel: "Problem", maxItems: 6,
        ai: "Common, realistic problems this product addresses.",
        fields: [t("text", "Problem", 140, "One short problem statement.")],
      },
      t("solutionTitle", "Solution title", 60, "Heading for the solution side."),
      {
        key: "solutions", type: "list", label: "Solution items", itemLabel: "Solution", maxItems: 6,
        ai: "How the product solves each problem, using supplied facts only.",
        fields: [t("text", "Solution", 140, "One short solution statement.")],
      },
    ],
  },
  {
    key: "use_cases",
    name: "Use Cases",
    description: "Where and how the product is used",
    required: false,
    builtin: false,
    fields: [
      t("title", "Section title", 60, "Heading for the use cases section."),
      {
        key: "items", type: "list", label: "Use cases", itemLabel: "Use case", maxItems: 8,
        ai: "Realistic situations this product is used in, based on the product facts only.",
        fields: [
          t("icon", "Icon", 20, "One icon name: check, star, zap, package, heart, award, clock, sparkles."),
          t("title", "Title", 50, "Short use case title."),
          ta("text", "Description", 160, "One short sentence."),
          img("image", "Image (optional)"),
        ],
      },
    ],
  },
  { key: "description", name: "Description", description: "Product benefits and information", required: false, builtin: true, fields: [] },
  {
    key: "features",
    name: "Features",
    description: "Detailed feature list",
    required: false,
    builtin: false,
    note: "Product features are pulled from the product record when available.",
    fields: [
      t("title", "Section title", 60, "Heading for the features section."),
      {
        key: "items", type: "list", label: "Features", itemLabel: "Feature", maxItems: 12,
        ai: "Factual features from the product data only.",
        fields: [
          t("icon", "Icon", 20, "One icon name: check, star, shield, truck, zap, award, package, sparkles."),
          t("title", "Feature title", 60, "Short feature name."),
          ta("text", "Description", 180, "One short explanation."),
        ],
      },
    ],
  },
  {
    key: "technology",
    name: "Technology / Components",
    description: "The technology or components inside the product",
    required: false,
    builtin: false,
    note: "Use only technology facts from the product record.",
    fields: [
      t("title", "Section title", 60, "Heading for the technology section."),
      ta("text", "Intro", 220, "One or two factual sentences. Never invent technology."),
      {
        key: "items", type: "list", label: "Technologies", itemLabel: "Technology", maxItems: 8,
        ai: "Only technologies or components confirmed by the product facts.",
        fields: [
          t("icon", "Icon", 20, "One icon name: zap, shield, sparkles, package, check, award."),
          t("title", "Name", 50, "Technology or component name."),
          ta("text", "Description", 160, "One short explanation."),
        ],
      },
    ],
  },
  {
    key: "ingredients",
    name: "Ingredients / Materials",
    description: "What the product is made of",
    required: false,
    builtin: false,
    note: "Only list materials or ingredients confirmed by the product record.",
    fields: [
      t("title", "Section title", 60, "Heading for the ingredients or materials section."),
      ta("text", "Intro", 220, "One short factual introduction."),
      {
        key: "items", type: "list", label: "Ingredients / materials", itemLabel: "Item", maxItems: 12,
        ai: "Only ingredients or materials given in the product facts. Never invent any.",
        fields: [
          t("name", "Name", 60, "Ingredient or material name."),
          ta("text", "Description", 140, "What it does or why it is used."),
          img("image", "Image (optional)"),
        ],
      },
    ],
  },
  {
    key: "specs",
    name: "Specifications",
    description: "Technical specifications table",
    required: false,
    builtin: false,
    note: "Specifications come from the product record where available.",
    fields: [
      t("title", "Section title", 60, "Heading for the specifications table."),
      {
        key: "items", type: "list", label: "Specifications", itemLabel: "Specification", maxItems: 20,
        ai: "Only specifications given in the product facts. Never invent values.",
        fields: [t("label", "Specification name", 60), t("value", "Specification value", 120)],
      },
    ],
  },
  {
    key: "how_it_works",
    name: "How It Works",
    description: "Step-by-step explanation",
    required: false,
    builtin: false,
    fields: [
      t("title", "Section title", 60, "Heading for the how-it-works section."),
      {
        key: "items", type: "list", label: "Steps", itemLabel: "Step", maxItems: 6,
        ai: "Simple, factual steps.",
        fields: [
          t("icon", "Icon", 20, "One icon name: check, zap, package, sparkles, clock."),
          t("title", "Title", 60, "Short step title."),
          ta("text", "Description", 180, "One short sentence."),
        ],
      },
    ],
  },
  {
    key: "how_to_use",
    name: "How To Use",
    description: "Usage instructions",
    required: false,
    builtin: false,
    fields: [
      t("title", "Section title", 60, "Heading for the usage instructions."),
      {
        key: "items", type: "list", label: "Instructions", itemLabel: "Instruction", maxItems: 8,
        ai: "Clear usage instructions based on the product facts.",
        fields: [t("text", "Instruction", 200, "One instruction step."), img("image", "Image (optional)")],
      },
    ],
  },
  {
    key: "before_after",
    name: "Before & After",
    description: "Visual comparison of results",
    required: false,
    builtin: false,
    render: "before_after",
    note: "Only use real, unedited customer or product photos.",
    fields: [
      t("title", "Section title", 60, "Heading for the before and after section."),
      ta("text", "Intro", 200, "One short honest sentence. Never promise guaranteed results."),
      {
        key: "items", type: "list", label: "Comparisons", itemLabel: "Comparison", maxItems: 6,
        ai: "Short, honest captions for each before and after pair.",
        fields: [
          t("label", "Caption", 60, "Short caption for the pair."),
          img("beforeImage", "Before image"),
          img("afterImage", "After image"),
          t("beforeLabel", "Before label", 24, "Label for the first image, e.g. Before."),
          t("afterLabel", "After label", 24, "Label for the second image, e.g. After."),
        ],
      },
    ],
  },
  {
    key: "results",
    name: "Results / Outcomes",
    description: "What customers can expect",
    required: false,
    builtin: false,
    note: "Only use outcomes supported by real facts. Never invent numbers.",
    fields: [
      t("title", "Section title", 60, "Heading for the results section."),
      ta("text", "Intro", 220, "Honest expectation-setting sentence."),
      {
        key: "items", type: "list", label: "Results", itemLabel: "Result", maxItems: 6,
        ai: "Realistic outcomes only. Never invent statistics or medical claims.",
        fields: [
          t("value", "Highlight", 24, "Short highlight, only when supported by facts."),
          t("title", "Title", 50, "Short outcome title."),
          ta("text", "Description", 160, "One short sentence."),
        ],
      },
    ],
  },
  {
    key: "box_contents",
    name: "What's In The Box",
    description: "Everything included with the product",
    required: false,
    builtin: false,
    fields: [
      t("title", "Section title", 60, "Heading for the box contents."),
      {
        key: "items", type: "list", label: "Items", itemLabel: "Item", maxItems: 10,
        ai: "Only items confirmed by the product facts.",
        fields: [t("name", "Item name", 60), ta("text", "Description", 140), img("image", "Image")],
      },
    ],
  },
  {
    key: "size_guide",
    name: "Size Guide",
    description: "Sizes and measurements",
    required: false,
    builtin: false,
    fields: [
      t("title", "Section title", 60, "Heading for the size guide."),
      img("image", "Size guide image"),
      {
        key: "items", type: "list", label: "Sizes", itemLabel: "Size", maxItems: 12,
        ai: "Only sizes given in the product facts.",
        fields: [t("size", "Size", 30), t("measurement", "Measurement", 90)],
      },
    ],
  },
  {
    key: "variants",
    name: "Colors & Variants",
    description: "Available colours and variants",
    required: false,
    builtin: false,
    fields: [
      t("title", "Section title", 60, "Heading for the variants section."),
      {
        key: "items", type: "list", label: "Variants", itemLabel: "Variant", maxItems: 12,
        ai: "Only variants present in the product facts.",
        fields: [t("name", "Variant name", 50), t("options", "Available options", 120), img("image", "Variant image")],
      },
    ],
  },
  {
    key: "product_variants",
    name: "Product Variants",
    description: "Selectable variants of this product",
    required: false,
    builtin: false,
    note: "Variants are taken from the linked product record where available.",
    fields: [
      t("title", "Section title", 60, "Heading for the product variants section."),
      {
        key: "items", type: "list", label: "Variants", itemLabel: "Variant", maxItems: 12,
        ai: "Only variants present in the product facts.",
        fields: [
          t("name", "Variant name", 50),
          ta("text", "Description", 140, "One short line about this variant."),
          t("price", "Price label", 40),
          img("image", "Variant image"),
        ],
      },
    ],
  },
  {
    key: "comparison",
    name: "Comparison",
    description: "How this product compares",
    required: false,
    builtin: false,
    note: "Use factual information only.",
    fields: [
      t("title", "Section title", 60, "Heading for the comparison table."),
      t("productLabel", "Product column label", 40),
      t("otherLabel", "Comparison column label", 40),
      {
        key: "items", type: "list", label: "Rows", itemLabel: "Row", maxItems: 10,
        ai: "Factual comparison rows only. Never disparage named competitors.",
        fields: [t("feature", "Feature", 60), t("product", "Product value", 80), t("other", "Comparison value", 80)],
      },
    ],
  },
  {
    key: "offer",
    name: "Offer",
    description: "The current offer and pricing",
    required: false,
    builtin: false,
    note: "Price and discount come from the linked product.",
    fields: [
      t("title", "Offer title", 60, "Short offer heading. No fake urgency."),
      ta("text", "Offer description", 220, "Two short sentences at most."),
      t("ctaText", "Button text", 24, "Order button label."),
    ],
  },
  {
    key: "package_bundle",
    name: "Package / Bundle",
    description: "Bundle options and what each includes",
    required: false,
    builtin: false,
    note: "Prices must match your real product and offer pricing.",
    fields: [
      t("title", "Section title", 60, "Heading for the bundle section."),
      ta("text", "Intro", 200, "One short line about the packages."),
      {
        key: "items", type: "list", label: "Packages", itemLabel: "Package", maxItems: 4,
        ai: "Only packages supported by the supplied pricing facts.",
        fields: [
          t("name", "Package name", 50),
          t("price", "Price label", 40),
          ta("text", "What is included", 200, "Short list of what the package includes."),
          t("badge", "Badge", 24, "Optional short badge, e.g. Popular."),
          img("image", "Image (optional)"),
        ],
      },
    ],
  },
  {
    key: "limited_offer",
    name: "Limited Time Offer",
    description: "A time-limited promotion",
    required: false,
    builtin: false,
    note: "Only use this when the offer is genuinely limited.",
    fields: [
      t("title", "Offer title", 60, "Short offer heading. Never invent fake urgency."),
      ta("text", "Offer details", 220, "Only real offer facts."),
      t("badge", "Badge", 24, "Short badge text."),
      t("deadline", "Ends on", 40, "Only when a real end date is supplied."),
      t("ctaText", "Button text", 24, "Order button label."),
    ],
  },
  {
    key: "social_proof",
    name: "Social Proof",
    description: "Trust and popularity signals",
    required: false,
    builtin: false,
    note: "Only real, verified statistics. Never generate numbers.",
    fields: [
      t("title", "Title", 60, "Heading for the social proof section."),
      ta("text", "Supporting content", 300, "Only statements supported by the supplied facts. Never invent statistics."),
      {
        key: "items", type: "list", label: "Statistics", itemLabel: "Statistic", maxItems: 4,
        fields: [t("value", "Value", 24), t("label", "Label", 40)],
      },
    ],
  },
  { key: "reviews", name: "Reviews", description: "Customer reviews and ratings", required: false, builtin: true, fields: [] },
  {
    key: "customer_stories",
    name: "Customer Stories",
    description: "Longer stories from real customers",
    required: false,
    builtin: false,
    note: "Only publish real customer stories with permission.",
    fields: [
      t("title", "Section title", 60, "Heading for the customer stories section."),
      {
        key: "items", type: "list", label: "Stories", itemLabel: "Story",
        maxItems: 6,
        fields: [
          t("name", "Customer name", 50),
          t("location", "Location", 50),
          ta("text", "Story", 400),
          img("image", "Photo"),
        ],
      },
    ],
  },
  {
    key: "video_showcase",
    name: "Video Showcase",
    description: "A product video from YouTube or Vimeo",
    required: false,
    builtin: false,
    render: "video",
    fields: [
      t("title", "Section title", 60, "Heading for the video section."),
      ta("text", "Intro", 200, "One short supporting line."),
      { key: "videoUrl", type: "text", label: "Video URL (YouTube or Vimeo)", max: 300, placeholder: "https://youtube.com/watch?v=..." },
      img("poster", "Thumbnail (optional)"),
    ],
  },
  {
    key: "product_demo",
    name: "Product Demo",
    description: "A demo video showing the product in use",
    required: false,
    builtin: false,
    render: "video",
    fields: [
      t("title", "Section title", 60, "Heading for the product demo."),
      ta("text", "Intro", 200, "One short line describing the demo."),
      { key: "videoUrl", type: "text", label: "Demo video URL (YouTube or Vimeo)", max: 300, placeholder: "https://youtube.com/watch?v=..." },
      img("poster", "Thumbnail (optional)"),
    ],
  },
  {
    key: "image_gallery",
    name: "Image Gallery",
    description: "A gallery of product images",
    required: false,
    builtin: false,
    render: "gallery",
    note: "Product images are available in the image picker.",
    fields: [
      t("title", "Section title", 60, "Heading for the gallery."),
      {
        key: "items", type: "list", label: "Images", itemLabel: "Image", maxItems: 12,
        fields: [img("image", "Image"), t("caption", "Caption", 80)],
      },
    ],
  },
  {
    key: "customer_photos",
    name: "Customer Photos",
    description: "Photos from real customers",
    required: false,
    builtin: false,
    fields: [
      t("title", "Section title", 60, "Heading for the customer photos."),
      {
        key: "items", type: "list", label: "Photos", itemLabel: "Photo", maxItems: 12,
        fields: [img("image", "Customer photo"), t("caption", "Caption", 80)],
      },
    ],
  },
  {
    key: "guarantee",
    name: "Guarantee",
    description: "Warranty and guarantee information",
    required: false,
    builtin: false,
    note: "Only show what the store's real policies support.",
    fields: [
      t("title", "Title", 60, "Heading for the guarantee section."),
      ta("text", "Description", 300, "Only guarantees stated in the supplied facts."),
      {
        key: "items", type: "list", label: "Guarantee items", itemLabel: "Item", maxItems: 6,
        ai: "Only guarantees supported by the supplied policy facts.",
        fields: [t("title", "Title", 50), ta("text", "Description", 140)],
      },
    ],
  },
  {
    key: "brand_story",
    name: "Brand Story",
    description: "The story behind the store or brand",
    required: false,
    builtin: false,
    note: "Left blank, this falls back to your Store Settings information.",
    fields: [
      t("title", "Section title", 60, "Heading for the brand story."),
      ta("text", "Story", 600, "Two or three short paragraphs about the brand, using supplied facts only."),
      img("image", "Brand image"),
    ],
  },
  {
    key: "certifications",
    name: "Certifications / Awards",
    description: "Certificates, awards and approvals",
    required: false,
    builtin: false,
    note: "Only list certifications the store can prove.",
    fields: [
      t("title", "Section title", 60, "Heading for the certifications section."),
      {
        key: "items", type: "list", label: "Certifications", itemLabel: "Certification", maxItems: 8,
        ai: "Only certifications or awards confirmed by the supplied facts.",
        fields: [t("name", "Name", 60), ta("text", "Description", 140), img("image", "Logo or certificate")],
      },
    ],
  },
  {
    key: "partners",
    name: "Partners / Brands",
    description: "Partner or brand logos",
    required: false,
    builtin: false,
    fields: [
      t("title", "Section title", 60, "Heading for the partners section."),
      {
        key: "items", type: "list", label: "Partners", itemLabel: "Partner", maxItems: 12,
        fields: [t("name", "Name", 50), img("image", "Logo")],
      },
    ],
  },
  {
    key: "shipping",
    name: "Shipping & Delivery",
    description: "Delivery information and areas",
    required: false,
    builtin: false,
    note: "Delivery areas and charges come from the Order form tab.",
    fields: [
      t("title", "Title", 60, "Heading for the delivery section."),
      ta("text", "Delivery information", 300, "Only delivery facts supplied."),
      { key: "showZones", type: "text", label: "Delivery areas heading", max: 60 },
    ],
  },
  {
    key: "payment_info",
    name: "Payment Information",
    description: "Accepted payment methods",
    required: false,
    builtin: false,
    note: "Payment methods come from the Order form tab.",
    fields: [
      t("title", "Title", 60, "Heading for the payment section."),
      ta("text", "Supporting text", 220, "Only payment facts supplied."),
    ],
  },
  { key: "faq", name: "FAQ", description: "Frequently asked questions", required: false, builtin: true, fields: [] },
  {
    key: "recommended_products",
    name: "Recommended Products",
    description: "Hand-picked products from your store",
    required: false,
    builtin: false,
    render: "products",
    productSource: "picked",
    note: "Products come from your store catalogue and open on your storefront.",
    fields: [
      t("title", "Section title", 60, "Heading for the recommended products section."),
      { key: "productIds", type: "products", label: "Choose products", maxItems: 8 },
    ],
  },
  {
    key: "related_products",
    name: "Related Products",
    description: "Other products from your store",
    required: false,
    builtin: false,
    render: "products",
    productSource: "related",
    note: "Filled automatically from your store catalogue.",
    fields: [t("title", "Section title", 60, "Heading for the related products section.")],
  },
  {
    key: "recently_viewed",
    name: "Recently Viewed",
    description: "Products the visitor viewed on your storefront",
    required: false,
    builtin: false,
    render: "products",
    productSource: "recent",
    note: "Shown only to visitors who already browsed your storefront.",
    fields: [t("title", "Section title", 60, "Heading for the recently viewed section.")],
  },
  {
    key: "final_cta",
    name: "Final CTA",
    description: "Last call to action before the order form",
    required: false,
    builtin: false,
    fields: [
      t("headline", "Headline", 80, "Short closing headline."),
      ta("text", "Description", 200, "One or two reassuring sentences."),
      t("ctaText", "Button text", 24, "Order button label."),
    ],
  },
  { key: "order", name: "Order Form", description: "Customer order information", required: true, builtin: true, fields: [] },
  {
    key: "contact",
    name: "Contact",
    description: "How customers can reach the store",
    required: false,
    builtin: false,
    note: "Left blank, these fall back to your Store Settings.",
    fields: [
      t("title", "Section title", 60, "Heading for the contact section."),
      t("phone", "Phone", 40),
      t("email", "Email", 80),
      ta("address", "Address", 200),
      t("hours", "Business hours", 80),
    ],
  },
  { key: "footer", name: "Footer", description: "Store information and links", required: true, builtin: true, fields: [] },
];

export const DEFAULT_SECTION_ORDER: string[] = SECTION_REGISTRY.map((s) => s.key);

export const REQUIRED_SECTION_KEYS: string[] = SECTION_REGISTRY.filter((s) => s.required).map((s) => s.key);

export function sectionSpec(key: string): LPSectionSpec | undefined {
  return SECTION_REGISTRY.find((s) => s.key === key);
}

/** Registry order index, used to insert a newly added section at the right place. */
export function sectionRank(key: string): number {
  const i = DEFAULT_SECTION_ORDER.indexOf(key);
  return i === -1 ? DEFAULT_SECTION_ORDER.length : i;
}

/** Sorted list of section keys currently used on the page. */
export function usedSectionKeys(order: string[], enabled: Record<string, boolean>): string[] {
  return order.filter((k) => sectionSpec(k) && (REQUIRED_SECTION_KEYS.includes(k) || enabled[k]));
}

/** Sections available to add. */
export function librarySectionKeys(order: string[], enabled: Record<string, boolean>): string[] {
  const used = new Set(usedSectionKeys(order, enabled));
  return DEFAULT_SECTION_ORDER.filter((k) => !used.has(k));
}
