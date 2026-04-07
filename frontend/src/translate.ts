/**
 * Translation via MyMemory API — free, no API key needed.
 * Limit: ~5000 chars/day per IP.
 */

const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

type Lang = "en" | "fr" | "nl";

const LANG_CODES: Record<Lang, string> = {
  en: "en-GB",
  fr: "fr-FR",
  nl: "nl-NL",
};

export async function translate(
  text: string,
  from: Lang,
  to: Lang
): Promise<string> {
  if (!text.trim()) return "";
  if (from === to) return text;

  const params = new URLSearchParams({
    q: text,
    langpair: `${LANG_CODES[from]}|${LANG_CODES[to]}`,
  });

  const res = await fetch(`${MYMEMORY_URL}?${params}`);
  if (!res.ok) throw new Error(`Translation failed: ${res.status}`);

  const data = await res.json();
  if (data.responseStatus !== 200) {
    throw new Error(data.responseDetails || "Translation failed");
  }

  return data.responseData.translatedText;
}
