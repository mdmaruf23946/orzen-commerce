// Facebook Messenger Graph API helpers. Server-only.
const GRAPH = "https://graph.facebook.com/v19.0";

type SendResult = { message_id?: string };

async function post(token: string, body: any): Promise<SendResult> {
  const r = await fetch(
    `${GRAPH}/me/messages?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok) {
    const err = j?.error ?? {};
    const parts = [err.message || `Send failed (${r.status})`, err.code ? `code:${err.code}` : null, err.error_subcode ? `subcode:${err.error_subcode}` : null]
      .filter(Boolean)
      .join(" ");
    throw new Error(parts);
  }
  return j;
}

export function sendText(token: string, psid: string, text: string) {
  return post(token, {
    recipient: { id: psid },
    messaging_type: "RESPONSE",
    message: { text: text.slice(0, 1900) },
  });
}

export async function sendPostPurchaseUpdate(token: string, psid: string, text: string) {
  const message = { text: text.slice(0, 1900) };
  try {
    return await post(token, {
      recipient: { id: psid },
      messaging_type: "MESSAGE_TAG",
      tag: "POST_PURCHASE_UPDATE",
      message,
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (/invalid parameter|code:100/i.test(msg)) {
      try {
        return await post(token, {
          recipient: { id: psid },
          messaging_type: "UPDATE",
          message,
        });
      } catch {
        return post(token, {
          recipient: { id: psid },
          messaging_type: "RESPONSE",
          message,
        });
      }
    }
    throw e;
  }
}

export type ProductCardInput = {
  title: string;
  subtitle?: string;
  image_url?: string;
  buy_url?: string; // opens storefront checkout / product page
  product_id?: string; // used for postback "buy now via AI"
  /** false for digital/service/subscription — purchase happens on the website only */
  orderable?: boolean;
  /** overrides the web_url button label (default: "View site") */
  link_title?: string;
};

function buildElement(p: ProductCardInput) {
  const buttons: any[] = [];
  const orderable = p.orderable !== false;
  if (p.buy_url) {
    buttons.push({
      type: "web_url",
      url: p.buy_url,
      title: (p.link_title || "View site").slice(0, 20),
      webview_height_ratio: "tall",
    });
  }
  if (p.product_id && orderable) {
    buttons.push({
      type: "postback",
      title: "Buy Now",
      payload: `BUY_${p.product_id}`,
    });
  }
  return {
    title: p.title.slice(0, 80),
    subtitle: p.subtitle?.slice(0, 80),
    image_url: p.image_url,
    buttons: buttons.length ? buttons.slice(0, 3) : undefined,
  };
}


export function sendProductCard(token: string, psid: string, product: ProductCardInput) {
  return post(token, {
    recipient: { id: psid },
    messaging_type: "RESPONSE",
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [buildElement(product)],
        },
      },
    },
  });
}

export function sendProductCarousel(
  token: string,
  psid: string,
  products: ProductCardInput[],
) {
  return post(token, {
    recipient: { id: psid },
    messaging_type: "RESPONSE",
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: products.slice(0, 10).map(buildElement),
        },
      },
    },
  });
}

export function sendQuickReplies(
  token: string,
  psid: string,
  text: string,
  replies: { title: string; payload: string }[],
) {
  return post(token, {
    recipient: { id: psid },
    messaging_type: "RESPONSE",
    message: {
      text: text.slice(0, 640),
      quick_replies: replies.slice(0, 13).map((r) => ({
        content_type: "text",
        title: r.title.slice(0, 20),
        payload: r.payload.slice(0, 1000),
      })),
    },
  });
}
