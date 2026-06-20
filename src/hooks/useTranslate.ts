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
  // Stable joined key — drives effect re-run when any text changes
  const joinedKey = texts.join("\x00");
  const [results, setResults] = useState<string[]>(() => texts.map((t) => t ?? ""));
  const keyRef = useRef<string>("");

  useEffect(() => {
    const normalized = texts.map((t) => t ?? "");
    const key = (isTamil ? "1" : "0") + "|" + joinedKey;
    if (key === keyRef.current) return;
    keyRef.current = key;

    // Always update with current source texts first (instant)
    setResults(normalized);
    if (!isTamil) return;

    // Skip if all texts are empty/trivial (product not loaded yet)
    if (normalized.every((s) => !s || s.length < 2)) return;

    translateBatch(normalized).then((translated) => {
      // Only apply if the key is still current (no stale updates)
      if (keyRef.current === key) setResults(translated);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTamil, joinedKey]);

  return results;
}
