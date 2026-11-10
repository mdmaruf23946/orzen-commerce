// Server-only templates for the Legal & Business Information Generator.
// Pure functions: takes structured business info + returns { title, description, html }.

export type LegalInfo = {
  store_name: string;
  owner_name: string;
  support_email: string;
  contact_phone: string;
  business_address: string;
  website_domain: string;
  country: string;
  currency: string;
};

export type GeneratedPage = {
  title: string;
  description: string;
  html: string;
  updated_at: string;
};

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function today() {
  return new Date().toISOString().slice(0, 10);
}

function wrap(sections: Array<{ h: string; body: string }>) {
  return sections
    .map(
      (s) => `<section>
  <h2>${esc(s.h)}</h2>
  ${s.body}
</section>`,
    )
    .join("\n");
}

export const LEGAL_PAGES = [
  { key: "privacy", path: "/privacy-policy", label: "Privacy Policy" },
  { key: "terms", path: "/terms", label: "Terms of Service" },
  { key: "refund", path: "/refund-policy", label: "Refund & Return Policy" },
  { key: "shipping", path: "/shipping-policy", label: "Shipping Policy" },
  { key: "contact", path: "/contact", label: "Contact Us" },
  { key: "about", path: "/about", label: "About Us" },
  { key: "data_deletion", path: "/data-deletion", label: "Data Deletion Instructions" },
] as const;

export type LegalPageKey = (typeof LEGAL_PAGES)[number]["key"];

function privacy(i: LegalInfo): GeneratedPage {
  const title = `Privacy Policy — ${i.store_name}`;
  const description = `How ${i.store_name} collects, uses, stores and protects your personal information.`;
  const html = `<p><strong>Effective date:</strong> ${today()}</p>
<p>${esc(i.store_name)} ("we", "us", "our") operates ${esc(i.website_domain)} and provides online shopping services to customers in ${esc(i.country)}. This Privacy Policy describes how we collect, use, share, and protect your information when you use our website or interact with us on Facebook, Messenger, Instagram, or other channels.</p>
${wrap([
  { h: "Information We Collect", body: `<ul>
    <li>Contact details: name, phone number, email address, delivery address.</li>
    <li>Order information: products purchased, payment method, transaction identifiers.</li>
    <li>Account credentials if you register a customer account.</li>
    <li>Technical data: IP address, device type, browser, cookies, and interaction events.</li>
    <li>Messages you send to us via chat, Messenger, Instagram, WhatsApp, email or phone.</li>
  </ul>` },
  { h: "How We Use Your Information", body: `<ul>
    <li>To process, deliver, and support your orders.</li>
    <li>To communicate about orders, promotions, and customer service.</li>
    <li>To operate, secure, improve and personalize our services.</li>
    <li>To detect and prevent fraud, abuse or unauthorized activity.</li>
    <li>To comply with applicable laws and lawful requests.</li>
  </ul>` },
  { h: "Sharing With Third Parties", body: `<p>We share information only as needed with:</p>
  <ul>
    <li>Payment gateways (to process transactions).</li>
    <li>Courier and delivery partners (to deliver orders).</li>
    <li>Meta Platforms (Facebook, Messenger, Instagram) for Conversions API, page messaging and advertising measurement.</li>
    <li>Analytics providers, hosting and infrastructure providers.</li>
    <li>Authorities where required by law.</li>
  </ul>` },
  { h: "Cookies & Tracking", body: `<p>We use cookies and similar technologies for essential site functionality, analytics and marketing, including the Meta Pixel and Conversions API.</p>` },
  { h: "Data Retention", body: `<p>We keep personal information only as long as necessary for the purposes described here or as required by law.</p>` },
  { h: "Your Rights", body: `<p>You may request access, correction, or deletion of your personal information at any time by emailing <a href="mailto:${esc(i.support_email)}">${esc(i.support_email)}</a>. See our <a href="/data-deletion">Data Deletion Instructions</a> for the Meta-specific process.</p>` },
  { h: "Security", body: `<p>We apply reasonable administrative, technical and physical safeguards to protect personal information from unauthorized access, disclosure, alteration or destruction.</p>` },
  { h: "Children", body: `<p>Our services are not directed to children under 13, and we do not knowingly collect their personal information.</p>` },
  { h: "Changes", body: `<p>We may update this Privacy Policy from time to time. The updated version will be posted on this page with a new effective date.</p>` },
  { h: "Contact", body: `<p>${esc(i.store_name)}<br/>${esc(i.business_address)}<br/>Email: <a href="mailto:${esc(i.support_email)}">${esc(i.support_email)}</a><br/>Phone: ${esc(i.contact_phone)}</p>` },
])}`;
  return { title, description, html, updated_at: new Date().toISOString() };
}

function terms(i: LegalInfo): GeneratedPage {
  const title = `Terms of Service — ${i.store_name}`;
  const description = `Terms and conditions for using ${i.store_name} and purchasing our products.`;
  const html = `<p><strong>Effective date:</strong> ${today()}</p>
<p>These Terms of Service ("Terms") govern your use of ${esc(i.website_domain)} operated by ${esc(i.store_name)} ("we", "us"). By using our services you agree to these Terms.</p>
${wrap([
  { h: "Eligibility", body: `<p>You must be at least 18 years old, or have parental consent, to place an order.</p>` },
  { h: "Orders & Pricing", body: `<p>All prices are shown in ${esc(i.currency)} and may change without notice. We may cancel or refuse any order at our discretion, including for suspected fraud or stock issues.</p>` },
  { h: "Payment", body: `<p>Payment is due at the time of order via the methods offered at checkout. You are responsible for providing accurate payment information.</p>` },
  { h: "Delivery", body: `<p>Delivery times are estimates. Please see our <a href="/shipping-policy">Shipping Policy</a> for details.</p>` },
  { h: "Returns & Refunds", body: `<p>Please see our <a href="/refund-policy">Refund & Return Policy</a>.</p>` },
  { h: "Acceptable Use", body: `<p>You agree not to misuse the service, attempt to access it fraudulently, or use it for unlawful purposes.</p>` },
  { h: "Intellectual Property", body: `<p>All content on ${esc(i.website_domain)} — including logos, text, images and product descriptions — is owned by ${esc(i.store_name)} or its licensors and may not be reproduced without permission.</p>` },
  { h: "Disclaimer & Limitation of Liability", body: `<p>Services are provided "as is". To the extent permitted by law, ${esc(i.store_name)} is not liable for indirect, incidental, or consequential damages.</p>` },
  { h: "Governing Law", body: `<p>These Terms are governed by the laws of ${esc(i.country)}.</p>` },
  { h: "Changes to Terms", body: `<p>We may revise these Terms at any time. Continued use of our services means you accept the updated Terms.</p>` },
  { h: "Contact", body: `<p>Questions about these Terms? Email <a href="mailto:${esc(i.support_email)}">${esc(i.support_email)}</a> or call ${esc(i.contact_phone)}.</p>` },
])}`;
  return { title, description, html, updated_at: new Date().toISOString() };
}

function refund(i: LegalInfo): GeneratedPage {
  const title = `Refund & Return Policy — ${i.store_name}`;
  const description = `${i.store_name} return, exchange and refund process, timelines and conditions.`;
  const html = `<p><strong>Effective date:</strong> ${today()}</p>
${wrap([
  { h: "Return Window", body: `<p>You may request a return within 7 days of delivery, provided the item is unused, in original packaging, and with proof of purchase.</p>` },
  { h: "Non-Returnable Items", body: `<ul>
    <li>Perishable goods</li>
    <li>Personal care and hygiene items</li>
    <li>Digital products and gift cards</li>
    <li>Items marked as final sale</li>
  </ul>` },
  { h: "How to Request a Return", body: `<ol>
    <li>Email <a href="mailto:${esc(i.support_email)}">${esc(i.support_email)}</a> or call ${esc(i.contact_phone)} with your order number.</li>
    <li>We will confirm approval and share return instructions.</li>
    <li>Ship the item back or hand it to our courier.</li>
  </ol>` },
  { h: "Refunds", body: `<p>Once received and inspected, we will process refunds in ${esc(i.currency)} to the original payment method within 7–10 business days. For cash-on-delivery orders, refunds are sent by bKash / Nagad / bank transfer.</p>` },
  { h: "Exchanges", body: `<p>We replace items only if they are defective, damaged, or the wrong item was shipped. Contact us within 48 hours of delivery.</p>` },
  { h: "Shipping Costs", body: `<p>Return shipping costs are the customer's responsibility unless the return is due to our error.</p>` },
  { h: "Contact", body: `<p>${esc(i.store_name)}<br/>${esc(i.business_address)}<br/>Email: <a href="mailto:${esc(i.support_email)}">${esc(i.support_email)}</a><br/>Phone: ${esc(i.contact_phone)}</p>` },
])}`;
  return { title, description, html, updated_at: new Date().toISOString() };
}

function shipping(i: LegalInfo): GeneratedPage {
  const title = `Shipping Policy — ${i.store_name}`;
  const description = `Delivery areas, times and shipping fees for ${i.store_name}.`;
  const html = `<p><strong>Effective date:</strong> ${today()}</p>
${wrap([
  { h: "Coverage", body: `<p>We deliver across ${esc(i.country)} through our partner couriers.</p>` },
  { h: "Delivery Time", body: `<ul>
    <li>Inside city / Dhaka: 1–2 business days after confirmation.</li>
    <li>Outside city: 2–5 business days after confirmation.</li>
    <li>Remote areas may take longer.</li>
  </ul>` },
  { h: "Shipping Charges", body: `<p>Shipping charges are calculated at checkout based on delivery zone and product weight. Promotional free-shipping offers are announced on the storefront.</p>` },
  { h: "Order Tracking", body: `<p>Once dispatched, you will receive a tracking number via SMS or email. You can also track your order from your customer account.</p>` },
  { h: "Failed / Undelivered Shipments", body: `<p>If a shipment cannot be delivered due to incorrect address, unavailability, or refusal, we may charge return-shipping fees on future orders.</p>` },
  { h: "Contact", body: `<p>For any delivery question, email <a href="mailto:${esc(i.support_email)}">${esc(i.support_email)}</a> or call ${esc(i.contact_phone)}.</p>` },
])}`;
  return { title, description, html, updated_at: new Date().toISOString() };
}

function contact(i: LegalInfo): GeneratedPage {
  const title = `Contact Us — ${i.store_name}`;
  const description = `Get in touch with ${i.store_name}. Email, phone and business address.`;
  const html = `<p>We would love to hear from you. Reach out via any of the channels below.</p>
${wrap([
  { h: "Customer Support", body: `<p>
    Email: <a href="mailto:${esc(i.support_email)}">${esc(i.support_email)}</a><br/>
    Phone: <a href="tel:${esc(i.contact_phone)}">${esc(i.contact_phone)}</a><br/>
    Hours: Saturday–Thursday, 10:00 AM – 8:00 PM (${esc(i.country)} time)
  </p>` },
  { h: "Business Address", body: `<p>${esc(i.store_name)}<br/>${esc(i.business_address)}</p>` },
  { h: "Owner", body: `<p>${esc(i.owner_name)}</p>` },
  { h: "Website", body: `<p><a href="https://${esc(i.website_domain)}" target="_blank" rel="noreferrer">${esc(i.website_domain)}</a></p>` },
])}`;
  return { title, description, html, updated_at: new Date().toISOString() };
}

function about(i: LegalInfo): GeneratedPage {
  const title = `About Us — ${i.store_name}`;
  const description = `Learn more about ${i.store_name}, our mission, and how we serve customers in ${i.country}.`;
  const html = `${wrap([
  { h: `Welcome to ${i.store_name}`, body: `<p>${esc(i.store_name)} is an online store based in ${esc(i.country)}, dedicated to bringing quality products to our customers with fast delivery and reliable service.</p>` },
  { h: "Our Mission", body: `<p>To make online shopping simple, honest and enjoyable — with responsive support, transparent pricing and secure checkout.</p>` },
  { h: "What We Offer", body: `<p>A curated catalogue of products backed by clear return and refund policies. Every order is packed with care and shipped through trusted courier partners.</p>` },
  { h: "Leadership", body: `<p>Founded and operated by ${esc(i.owner_name)}.</p>` },
  { h: "Get In Touch", body: `<p>Have a question or feedback? Visit our <a href="/contact">Contact page</a> or email <a href="mailto:${esc(i.support_email)}">${esc(i.support_email)}</a>.</p>` },
])}`;
  return { title, description, html, updated_at: new Date().toISOString() };
}

function dataDeletion(i: LegalInfo): GeneratedPage {
  const title = `Data Deletion Instructions — ${i.store_name}`;
  const description = `How to request deletion of your personal data from ${i.store_name}, including data received via Facebook, Messenger, and Instagram.`;
  const html = `<p><strong>Effective date:</strong> ${today()}</p>
<p>${esc(i.store_name)} respects your right to control your personal data. This page explains how to request permanent deletion of your data from our systems, including any data we have received about you through Facebook, Messenger, or Instagram.</p>
${wrap([
  { h: "What Will Be Deleted", body: `<ul>
    <li>Your customer profile and account with ${esc(i.store_name)}.</li>
    <li>Order history, addresses and preferences linked to your account.</li>
    <li>Messages exchanged with our Facebook Page, Messenger bot or Instagram account.</li>
    <li>Any identifiers (Facebook Page-Scoped ID, Instagram ID) tied to your account.</li>
  </ul>` },
  { h: "How to Request Deletion", body: `<ol>
    <li>Send an email to <a href="mailto:${esc(i.support_email)}">${esc(i.support_email)}</a> from the email address linked to your account, with the subject "Data Deletion Request".</li>
    <li>Include your full name, phone number and, if applicable, your Facebook or Instagram username.</li>
    <li>We will confirm receipt within 3 business days and complete deletion within 30 days.</li>
  </ol>` },
  { h: "Alternative: In-App Request", body: `<p>Signed-in customers can request deletion directly from their account page. Choose "Delete my account" and confirm.</p>` },
  { h: "Meta Platforms Users", body: `<p>You can also revoke ${esc(i.store_name)}'s access to your Facebook or Instagram data at any time by visiting Facebook Settings → Apps and Websites, and removing our application. Once removed, we will delete the associated data on our side within 30 days.</p>` },
  { h: "Retention Exceptions", body: `<p>We may retain limited information where required by law (for example, tax and accounting records related to completed transactions), stored securely and separately from active customer data.</p>` },
  { h: "Contact", body: `<p>${esc(i.store_name)}<br/>${esc(i.business_address)}<br/>Email: <a href="mailto:${esc(i.support_email)}">${esc(i.support_email)}</a><br/>Phone: ${esc(i.contact_phone)}</p>` },
])}`;
  return { title, description, html, updated_at: new Date().toISOString() };
}

const GENERATORS: Record<LegalPageKey, (i: LegalInfo) => GeneratedPage> = {
  privacy,
  terms,
  refund,
  shipping,
  contact,
  about,
  data_deletion: dataDeletion,
};

export function generatePage(key: LegalPageKey, info: LegalInfo): GeneratedPage {
  return GENERATORS[key](info);
}

export function generateAllPages(info: LegalInfo): Record<LegalPageKey, GeneratedPage> {
  const out = {} as Record<LegalPageKey, GeneratedPage>;
  for (const p of LEGAL_PAGES) out[p.key] = generatePage(p.key, info);
  return out;
}
