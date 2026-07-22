## সমস্যাটা কেন হচ্ছে

- Messenger conversation data অনুযায়ী `Buy Now` চাপার পর `pending_order`-এ শুধু `product_id` এবং `qty` সেভ হচ্ছে।
- এরপর আপনি নাম/ফোন/ঠিকানা/COD একসাথে পাঠালেও deterministic webhook flow সেই order details parse করে `pending_order`-এ সেভ করছে না।
- ফলে message-টি আবার AI/product-search path-এ যাচ্ছে এবং AI আগের product card/availability রিপ্লাই করছে; `finalizeOrder` কল হচ্ছে না, তাই order create হচ্ছে না।

## Implementation plan

1. **Dedicated Messenger order state machine বানাব**
   - `pending_order.product_id` থাকলে পরের customer text-কে আগে order-details হিসেবে handle করবে।
   - Product search/photo reply এর আগে order flow চলবে, যাতে order details message কখনও product card reply-তে না চলে যায়।

2. **Bangla/English mixed order details parser যোগ করব**
   - এক message থেকে name, phone, full address, payment method (`COD`, `bKash`, `Nagad`, etc.) extract করবে।
   - Screenshot-এর format যেমন:
     ```text
     মারুফ
     01623239446
     Chittagong, Sandeep, ...
     COD
     ```
     এটাকে valid complete order হিসেবে ধরবে।

3. **Deterministic order creation করব**
   - সব required fields থাকলে model-এর উপর নির্ভর না করে direct database order তৈরি করবে।
   - Trusted product price/stock থেকে total calculate করবে।
   - `orders`, `order_items`, admin notification তৈরি করবে।
   - Success হলে `pending_order` clear করবে এবং customer-কে invoice/order confirmation পাঠাবে।

4. **Missing fields হলে professional prompt দেবে**
   - সব তথ্য না থাকলে শুধু missing fields চাইবে।
   - আগের product card বা “product আছে” রিপ্লাই repeat করবে না।

5. **Duplicate/retry safety যোগ করব**
   - Messenger retry বা user একই details আবার পাঠালে duplicate order তৈরি না করে existing pending/created state অনুযায়ী safe reply দেবে।
   - Order creation failure হলে `ai_messages.error`/integration error-এ clear reason রাখবে।

6. **Testing/verification করব**
   - Simulate করব: product query → Buy Now → order details → order created.
   - Verify করব order row, order_items row, notification, and `pending_order` cleared.
   - Also test: incomplete details, greeting after product card, and product query after completed order.