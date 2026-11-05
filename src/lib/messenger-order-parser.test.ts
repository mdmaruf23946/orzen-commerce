import { describe, expect, test } from "vitest";
import { __messengerTestHooks, availabilityStripped } from "./messenger-webhook.server";

// Regression net for messenger-webhook.server.ts before it is split into modules.
const { parseOrderDetailsTextEx } = __messengerTestHooks;

describe("availability question cleanup", () => {
  test("strips trailing 'আছে কি' / 'ache ki'", () => {
    expect(availabilityStripped("লাল শাড়ি আছে কি?")).toBe("লাল শাড়ি");
    expect(availabilityStripped("black panjabi ache ki")).toBe("black panjabi");
  });
  test("leaves plain product names alone", () => {
    expect(availabilityStripped("Black Panjabi")).toBe("Black Panjabi");
  });
});

describe("order detail parsing", () => {
  test("picks up a Bangladeshi phone number", () => {
    const r = parseOrderDetailsTextEx("নাম: রহিম\nফোন: 01712345678\nঠিকানা: মিরপুর ১০, ঢাকা");
    expect(r.patch.phone).toBe("01712345678");
  });
  test("a question is never stored as the customer name", () => {
    const r = parseOrderDetailsTextEx("ডেলিভারি চার্জ কত?", { awaitingName: true });
    expect(r.patch.name).toBeFalsy();
  });
});
