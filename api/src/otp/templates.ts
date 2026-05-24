/**
 * Renders the WhatsApp OTP message. Users can override this via message_template.
 */
export function renderOtpMessage(args: {
  code: string;
  appName?: string | null;
  ttlSeconds: number;
  template?: string | null;
  language?: string | null;
}): string {
  if (args.template) {
    let msg = args.template;
    msg = msg.replace(/\{\{code\}\}/g, args.code);
    msg = msg.replace(/\{\{appName\}\}/g, args.appName || "");
    const minutes = Math.max(1, Math.round(args.ttlSeconds / 60));
    msg = msg.replace(/\{\{ttlMinutes\}\}/g, minutes.toString());
    return msg;
  }

  const minutes = Math.max(1, Math.round(args.ttlSeconds / 60));
  const lang = args.language || 'en';

  if (lang === 'es') {
    const intro = args.appName ? `Tu código de verificación de ${args.appName} es:` : "Tu código de verificación es:";
    return [
      `*${args.code}*`,
      "",
      intro,
      "",
      `Este código expira en ${minutes} minuto${minutes === 1 ? "" : "s"}.`,
      "No compartas este código con nadie."
    ].join("\n");
  } else if (lang === 'fr') {
    const intro = args.appName ? `Votre code de vérification ${args.appName} est:` : "Votre code de vérification est:";
    return [
      `*${args.code}*`,
      "",
      intro,
      "",
      `Ce code expire dans ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      "Ne partagez ce code avec personne."
    ].join("\n");
  } else if (lang === 'pt') {
    const intro = args.appName ? `Seu código de verificação do ${args.appName} é:` : "Seu código de verificação é:";
    return [
      `*${args.code}*`,
      "",
      intro,
      "",
      `Este código expira em ${minutes} minuto${minutes === 1 ? "" : "s"}.`,
      "Não compartilhe este código com ninguém."
    ].join("\n");
  } else if (lang === 'ar') {
    const intro = args.appName ? `رمز التحقق الخاص بك لـ ${args.appName} هو:` : "رمز التحقق الخاص بك هو:";
    return [
      `*${args.code}*`,
      "",
      intro,
      "",
      `تنتهي صلاحية هذا الرمز خلال ${minutes} دقيقة.`,
      "لا تشارك هذا الرمز مع أي شخص."
    ].join("\n");
  }

  // default 'en'
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
