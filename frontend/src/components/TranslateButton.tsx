import { useState } from "react";
import { translate } from "../translate";

type Lang = "en" | "fr" | "nl";

interface Props {
  descriptions: Record<Lang, string>;
  targetLang: Lang;
  onTranslated: (text: string) => void;
}

/**
 * Finds the best source language to translate from:
 * picks the first non-empty language that isn't the target.
 */
function findSource(descriptions: Record<Lang, string>, target: Lang): Lang | null {
  const priority: Lang[] = ["en", "fr", "nl"];
  for (const lang of priority) {
    if (lang !== target && descriptions[lang].trim()) return lang;
  }
  return null;
}

export function TranslateButton({ descriptions, targetLang, onTranslated }: Props) {
  const [loading, setLoading] = useState(false);

  const sourceLang = findSource(descriptions, targetLang);
  const hasTarget = descriptions[targetLang].trim().length > 0;

  async function handleTranslate() {
    if (!sourceLang) return;
    setLoading(true);
    try {
      const result = await translate(descriptions[sourceLang], sourceLang, targetLang);
      onTranslated(result);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setLoading(false);
    }
  }

  if (!sourceLang) return null;

  return (
    <button
      className="translate-btn"
      onClick={handleTranslate}
      disabled={loading}
      title={`Translate from ${sourceLang.toUpperCase()} to ${targetLang.toUpperCase()}${hasTarget ? " (will overwrite)" : ""}`}
    >
      {loading ? "..." : `${sourceLang.toUpperCase()}\u2192${targetLang.toUpperCase()}`}
    </button>
  );
}
