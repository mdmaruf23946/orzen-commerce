// Approximate USD price per 1M tokens [input, output] by model family.
const PRICES: [RegExp, number, number][] = [
  [/flash-lite|flash-8b/i, 0.1, 0.4],
  [/gemini.*flash/i, 0.3, 2.5],
  [/gemini.*pro/i, 1.25, 10],
  [/gpt-5-nano|gpt-4\.1-nano/i, 0.05, 0.4],
  [/gpt-5-mini|gpt-4o-mini|gpt-4\.1-mini/i, 0.25, 2],
  [/gpt-5|gpt-4\.1|gpt-4o/i, 1.25, 10],
  [/claude.*haiku/i, 1, 5],
  [/claude/i, 3, 15],
  [/llama|mixtral|qwen|deepseek|groq/i, 0.2, 0.6],
];

export function estimateCostUsd(model: string | null | undefined, promptTokens: number, completionTokens: number): number {
  const m = String(model || "");
  const hit = PRICES.find(([re]) => re.test(m));
  const [inP, outP] = hit ? [hit[1], hit[2]] : [0.3, 2.5];
  return (Number(promptTokens || 0) * inP + Number(completionTokens || 0) * outP) / 1_000_000;
}
