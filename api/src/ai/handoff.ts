const person = "(?:a\\s+|an\\s+)?(?:real\\s+|live\\s+|actual\\s+)?(?:human|person|agent|representative|operator|staff member|support agent|someone)";

const negativeRequest = /\b(?:i\s+)?(?:do not|don't|dont|never|no need to)\b.{0,60}\b(?:human|person|agent|representative|operator|staff member|support agent)\b|^\s*(?:no|not)\s+(?:human|person|agent|representative|operator)\b/i;
const handoffRequests = [
  new RegExp(`\\b(?:i|we)\\s+(?:want|need|would like|prefer)\\s+(?:to\\s+)?${person}\\b`, "i"),
  new RegExp(`\\b(?:i|we)\\s+(?:want|need|would like|prefer)\\s+(?:to\\s+)?(?:talk|speak|chat|connect|transfer)\\s+(?:to|with)\\s+${person}\\b`, "i"),
  new RegExp(`\\b(?:can|could|may)\\s+(?:i|we)\\s+(?:please\\s+)?(?:talk|speak|chat)\\s+(?:to|with)\\s+${person}\\b`, "i"),
  new RegExp(`\\b(?:please\\s+)?(?:connect|transfer|put|switch)\\s+me\\s+(?:to|with)\\s+${person}\\b`, "i"),
  new RegExp(`\\b(?:talk|speak|chat)\\s+(?:to|with)\\s+${person}\\s+(?:please|now)\\b`, "i"),
  /\b(?:human|real person|live agent|human agent|customer support representative)\s+please\b/i,
  /\b(?:connect|transfer|put|switch)\s+me\s+through\s+to\s+(?:a\s+)?(?:real\s+)?(?:human|person|agent|representative|operator)\b/i,
  /\b(?:get|find|connect|transfer)\s+me\s+(?:to|with)\s+(?:a\s+)?(?:real\s+)?(?:human|person|agent|representative|operator|someone)\b/i,
  /\b(?:get|find)\s+me\s+(?:a|an)\s+(?:real\s+)?(?:human|person|agent|representative|operator)\b/i,
  /^\s*(?:human|person|agent|real person|live agent|human agent|representative|operator)\s*(?:please|pls)?[!.?]*\s*$/i
];

/** Deterministic fast path for clear customer requests to speak with a person. */
export function detectHumanHandoffRequest(text: string): string | null {
  const normalized = text.replace(/[’]/g, "'").trim();
  if (!normalized || negativeRequest.test(normalized)) return null;
  return handoffRequests.some((pattern) => pattern.test(normalized))
    ? "Customer requested a human reply"
    : null;
}

export function handoffResumeMode(mode: string | null | undefined): "inherit" | "enabled" {
  return mode === "enabled" ? "enabled" : "inherit";
}
