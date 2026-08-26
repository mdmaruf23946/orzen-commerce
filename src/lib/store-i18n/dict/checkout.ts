import type { Dict } from "./types";

/** Cart + all checkout flows (physical, digital, service, subscription). */
export const checkoutDict: Dict = {
  "cart.title": { en: "Your cart", bn: "আপনার কার্ট" },
  "cart.empty": { en: "Your cart is empty.", bn: "আপনার কার্ট খালি।" },
  "cart.continueShopping": { en: "Continue shopping", bn: "আরও কেনাকাটা করুন" },
  "cart.checkout": { en: "Proceed to checkout", bn: "চেকআউটে যান" },
  "cart.remove": { en: "Remove", bn: "সরান" },
  "cart.itemRemoved": { en: "Item removed", bn: "আইটেম সরানো হয়েছে" },

  "checkout.title": { en: "Checkout", bn: "চেকআউট" },
  "checkout.customerInfo": { en: "Customer information", bn: "কাস্টমার তথ্য" },
  "checkout.deliveryInfo": { en: "Delivery information", bn: "Delivery তথ্য" },
  "checkout.deliveryZone": { en: "Delivery area", bn: "Delivery এলাকা" },
  "checkout.deliveryCharge": { en: "Delivery charge", bn: "Delivery চার্জ" },
  "checkout.paymentMethod": { en: "Payment method", bn: "পেমেন্ট পদ্ধতি" },
  "checkout.cod": { en: "Cash on Delivery", bn: "Cash on Delivery" },
  "checkout.onlinePayment": { en: "Online payment", bn: "অনলাইন পেমেন্ট" },
  "checkout.orderSummary": { en: "Order summary", bn: "Order সারসংক্ষেপ" },
  "checkout.placeOrder": { en: "Place order", bn: "Order কনফার্ম করুন" },
  "checkout.placing": { en: "Placing order…", bn: "Order প্রসেস হচ্ছে…" },
  "checkout.couponCode": { en: "Coupon code", bn: "কুপন কোড" },
  "checkout.applyCoupon": { en: "Apply", bn: "প্রয়োগ করুন" },
  "checkout.couponApplied": { en: "Coupon applied", bn: "কুপন প্রয়োগ হয়েছে" },
  "checkout.couponInvalid": { en: "Invalid coupon", bn: "কুপনটি সঠিক নয়" },
  "checkout.orderNote": { en: "Order note (optional)", bn: "Order নোট (ঐচ্ছিক)" },
  "checkout.success": { en: "Order placed successfully", bn: "Order সফলভাবে সম্পন্ন হয়েছে" },
  "checkout.required": { en: "Please fill in the required fields.", bn: "প্রয়োজনীয় তথ্যগুলো পূরণ করুন।" },
};
