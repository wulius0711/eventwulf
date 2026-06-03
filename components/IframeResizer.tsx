"use client";
import { useEffect, useRef } from "react";
import { useFormStore } from "@/store/form";

export default function IframeResizer() {
  const { step } = useFormStore();
  const prevStep = useRef(step);
  const rafRef = useRef<number>(0);
  const scrollTopPending = useRef(false);

  useEffect(() => {
    const send = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const root = document.getElementById("embed-root");
        const height = root ? root.offsetHeight : document.body.offsetHeight;
        const scrollTop = scrollTopPending.current;
        scrollTopPending.current = false;
        window.parent.postMessage({ type: "eventwulf-resize", height, scrollTop }, "*");
      });
    };

    const stepChanged = step !== prevStep.current;
    prevStep.current = step;

    if (stepChanged) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      scrollTopPending.current = true;
    }
    send();

    const mutation = new MutationObserver(() => send());
    mutation.observe(document.body, { childList: true, subtree: true, attributes: true });
    const onResize = () => send();
    window.addEventListener("resize", onResize);

    return () => {
      mutation.disconnect();
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [step]);

  return null;
}
