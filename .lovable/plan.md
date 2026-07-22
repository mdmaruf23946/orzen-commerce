## What I found

- The store has 1 active in-stock product: `স্কুল ব্যাগ`, price ৳720, stock 80, and it has image paths saved.
- The image proxy URL currently returns `200 OK`, but Messenger cards are using the published app domain image URL. If Meta cannot reliably fetch that URL or the image size/format is rejected, the card appears with a blank gray image area.
- Recent chat history shows many incoming messages were saved without assistant replies earlier, and the current AI model setting is `google/gemini-2.5-pro` with a saved external-looking key prefix. That can make replies slower and less reliable than the default Lovable AI path.
- The webhook currently waits for the full AI generation and all tool calls before returning to Meta. If the AI/tool flow is slow, repeated messages can time out, be retried, or appear to stop replying.
- Product search is still too dependent on the model choosing the right tools; for clear product queries like “ব্যাগ আছে?” the system should answer from a deterministic product lookup, not only from model reasoning.

## Plan

1. **Make product image delivery reliable in Messenger**
   - Add a dedicated Messenger-safe image URL builder.
   - Prefer an absolute published app image proxy URL and validate/normalize stored image paths.
   - Add fallback image behavior only when a product truly has no image.
   - Log product-card send failures clearly instead of silently returning `{ sent: false }`.

2. **Add deterministic product reply path before AI generation**
   - In the Messenger webhook, detect obvious product/search/photo intents in Bangla/English.
   - Search the store products directly for matching active in-stock items.
   - Send a quick text reply plus Messenger product card/carousel with image and Buy buttons.
   - Use AI only for non-product conversational replies or complex order/help flows.

3. **Fix “reply stops after 2–3 messages” behavior**
   - Stop treating non-text/image/sticker messages as AI prompts unless supported.
   - Add safe duplicate-message handling using Messenger `mid` so retries do not create repeated/blocked flows.
   - Record assistant failures into `ai_messages.error` and keep the conversation in AI mode unless the AI explicitly escalates.
   - Clear stale integration errors after successful sends.

4. **Reduce reply delay**
   - Switch Messenger auto-reply to a faster default model/path for general replies.
   - Keep product lookup replies mostly database-driven so product questions respond immediately without waiting on a full model/tool loop.
   - Limit heavy conversation history passed to the model and filter out template/card system rows that confuse product search.

5. **Improve AI product accuracy**
   - Rework the product search helper so Bangla keywords like `ব্যাগ`, `স্কুল ব্যাগ`, `ছবি`, `দাম` match product name/category/specs consistently.
   - Make “send photo / এটার ছবি দাও” resolve to the last recommended product and resend the product card.
   - Prevent contradictory answers by using live product data for price/stock/image every time.

6. **Verify after implementation**
   - Check the school bag image URL and product card payload.
   - Test direct product search, photo request, normal greeting, repeated 4–5 messages, and unsupported image/sticker input.
   - Review saved `ai_messages` rows to confirm every supported customer text gets either a product card/text response or a logged failure reason.