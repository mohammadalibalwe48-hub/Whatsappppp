/**
 * Renders the default WhatsApp OTP message. Users can override this per-app
 * later — for now we use a friendly, safe default.
 */
export function renderOtpMessage(args: {
  code: string;
  appName?: string | null;
  ttlSeconds: number;
}): string {
  const minutes = Math.max(1, Math.round(args.ttlSeconds / 60));
  const intro = args.appName
    ? `Your ${args.appName} verification code is:`
    : "Your verification code is:";

  return [
    `*${args.code}*`,
    "",
    intro,
    "",
    `This code expires in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    "Do not share this code with anyone."
  ].join("\n");
}
