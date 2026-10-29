export interface ImportedPhoneContact {
  name: string;
  phone: string;
}

function unescapeVCard(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\([,;\\])/g, "$1")
    .trim();
}

function valueFor(lines: string[], property: string): string | null {
  const line = lines.find((item) => item.slice(0, item.indexOf(":")).split(";")[0].split(".").pop()?.toUpperCase() === property);
  if (!line) return null;
  const separator = line.indexOf(":");
  return separator < 0 ? null : unescapeVCard(line.slice(separator + 1));
}

function contactName(lines: string[]): string | null {
  const formatted = valueFor(lines, "FN");
  if (formatted) return formatted.slice(0, 120);
  const structured = valueFor(lines, "N");
  if (!structured) return null;
  const [family, given, additional, prefix, suffix] = structured.split(";").map((part) => part.trim());
  const name = [prefix, given, additional, family, suffix].filter(Boolean).join(" ");
  return name ? name.slice(0, 120) : null;
}

function normalizePhone(value: string, countryCode?: string): string | null {
  const cleaned = value.replace(/^tel:/i, "").replace(/[\s().-]/g, "");
  let digits: string;
  if (cleaned.startsWith("+")) digits = cleaned.slice(1).replace(/\D/g, "");
  else if (cleaned.startsWith("00")) digits = cleaned.slice(2).replace(/\D/g, "");
  else {
    const callingCode = countryCode?.trim().replace(/^\+/, "").replace(/\D/g, "");
    if (!callingCode) return null;
    const national = cleaned.replace(/\D/g, "").replace(/^0+/, "");
    digits = callingCode + national;
  }
  if (digits.length < 7 || digits.length > 15) return null;
  return `+${digits}`;
}

export function parseVCard(input: Buffer | string, countryCode?: string): { contacts: ImportedPhoneContact[]; skipped: number } {
  const content = (Buffer.isBuffer(input) ? input.toString("utf8") : input).replace(/^\uFEFF/, "");
  const unfolded = content.replace(/\r?\n[ \t]/g, "").replace(/\r/g, "");
  const cards = unfolded.match(/BEGIN:VCARD[\s\S]*?END:VCARD/gi) ?? [];
  const contacts: ImportedPhoneContact[] = [];
  let skipped = 0;

  for (const card of cards) {
    const lines = card.split("\n").map((line) => line.trim()).filter(Boolean);
    const name = contactName(lines);
    const numbers = lines
      .filter((line) => line.slice(0, line.indexOf(":")).split(";")[0].toUpperCase().endsWith("TEL"))
      .map((line) => line.slice(line.indexOf(":") + 1));

    if (!name || !numbers.length) {
      skipped += Math.max(1, numbers.length);
      continue;
    }

    for (const number of numbers) {
      const phone = normalizePhone(number, countryCode);
      if (!phone) {
        skipped++;
        continue;
      }
      contacts.push({ name, phone });
      if (contacts.length >= 10_000) return { contacts, skipped };
    }
  }

  return { contacts, skipped };
}
