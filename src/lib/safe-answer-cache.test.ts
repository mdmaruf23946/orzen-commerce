import { describe, expect, it } from "vitest";
import { cacheKey, getSafeAnswer, invalidateStoreAnswers, isCacheableReply, putSafeAnswer } from "./safe-answer-cache";

describe("safe answer cache", () => {
  it("never caches price/stock/delivery questions", () => {
    expect(cacheKey("s1", "messenger", "দাম কত?")).toBeNull();
    expect(cacheKey("s1", "messenger", "delivery charge koto")).toBeNull();
    expect(cacheKey("s1", "messenger", "আমার অর্ডার কোথায়")).toBeNull();
  });
  it("never caches replies with money, numbers or tool use", () => {
    expect(isCacheableReply("এটির দাম ৫৫০ টাকা", false)).toBe(false);
    expect(isCacheableReply("আমাদের পণ্য খাঁটি মধু", true)).toBe(false);
    expect(isCacheableReply("আমাদের পণ্য খাঁটি মধু", false)).toBe(true);
  });
  it("keeps stores isolated", () => {
    const k1 = cacheKey("s1", "messenger", "মধু কি খাঁটি?");
    const k2 = cacheKey("s2", "messenger", "মধু কি খাঁটি?");
    putSafeAnswer(k1, "জি, খাঁটি মধু।", false);
    expect(getSafeAnswer(k1)).toBe("জি, খাঁটি মধু।");
    expect(getSafeAnswer(k2)).toBeNull();
    invalidateStoreAnswers("s1");
    expect(getSafeAnswer(k1)).toBeNull();
  });
});
