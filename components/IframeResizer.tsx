"use client";
import { useEffect, useRef } from "react";

export default function IframeResizer() {
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const send = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const root = document.getElementById("embed-root");
        const height = root ? root.offsetHeight : document.body.offsetHeight;
        window.parent.postMessage({ type: "eventwulf-resize", height, scrollTop: false }, "*");
      });
    };

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
  }, []);

  return null;
}
