/**
 * useTranslate — auto-translate text when Tamil mode is active.
 *
 * Usage:
 *   const t = useTranslate();
 *   const name = t(product.name);          // returns Tamil if active, English otherwise
 *   const [n, d] = useTranslateBatch([name, desc]);
 */

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { translate, translateBatch } from "@/lib/translate";

/** Translate a single string. Returns the original while loading. */
export function useTranslate() {
  const { isTamil } = useLanguage();

  return function t(text: string | null | undefined): string {
    if (!text) return text ?? "";
    // This is a synchronous wrapper — use useTranslatedText for async auto-update
    return text;
  };
}

/** Reactively translate a single string. Shows original until Gemini responds. */
export function useTranslatedText(text: string | null | undefined): string {
  const { isTamil } = useLanguage();
  const [translated, setTranslated] = useState<string>(text ?? "");
  const lastText = useRef<string>("");
  const lastLang = useRef<boolean>(false);

  useEffect(() => {
    const src = text ?? "";
    if (!isTamil) { setTranslated(src); return; }
    if (src === lastText.current && isTamil === lastLang.current) return;
    lastText.current = src;
    lastLang.current = isTamil;

    if (!src) { setTranslated(""); return; }
    setTranslated(src); // show original immediately
    translate(src).then(setTranslated);
  }, [text, isTamil]);

  return translated;
}

/** Reactively translate multiple strings in one Gemini call. */
export function useTranslatedBatch(texts: (string | null | undefined)[]): string[] {
  const { isTamil } = useLanguage();
  const normalized = texts.map((t) => t ?? "");
  const [results, setResults] = useState<string[]>(normalized);
  const keyRef = useRef<string>("");

  useEffect(() => {
    const key = isTamil + "|" + normalized.join("||");
    if (key === keyRef.current) return;
    keyRef.current = key;

    if (!isTamil) { setResults(normalized); return; }
    setResults(normalized); // show original immediately
    translateBatch(normalized).then(setResults);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTamil, texts.join("|")]);

  return results;
}
