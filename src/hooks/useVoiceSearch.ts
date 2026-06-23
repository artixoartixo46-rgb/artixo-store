// Voice search hook — wraps Web Speech API (SpeechRecognition)
// Supported: Chrome, Edge, Safari (webkit). Not supported: Firefox.

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "listening" | "processing" | "unsupported";

interface UseVoiceSearchOptions {
  lang?: string;
  onResult: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
}

export function useVoiceSearch({ lang = "en-LK", onResult, onInterim }: UseVoiceSearchOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const recognitionRef = useRef<any>(null);

  // Detect browser support
  const SpeechRecognition =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const supported = !!SpeechRecognition;

  useEffect(() => {
    if (!supported) { setState("unsupported"); return; }
  }, [supported]);

  const start = useCallback(() => {
    if (!supported) return;
    if (state === "listening") {
      recognitionRef.current?.stop();
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onstart = () => setState("listening");

    rec.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim) onInterim?.(interim);
      if (final) {
        setState("processing");
        onResult(final.trim());
      }
    };

    rec.onerror = () => setState("idle");
    rec.onend = () => setState(s => s === "listening" ? "idle" : s);

    recognitionRef.current = rec;
    rec.start();
  }, [supported, state, lang, onResult, onInterim]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setState("idle");
  }, []);

  // Cleanup on unmount
  useEffect(() => () => recognitionRef.current?.stop(), []);

  return { state, supported, start, stop };
}
