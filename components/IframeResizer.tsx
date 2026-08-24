"use client";
import { useEffect } from "react";
import { sendResizeMessage } from "@/lib/iframeResize";

export default function IframeResizer() {
  useEffect(() => {
    sendResizeMessage();

    const mutation = new MutationObserver(() => sendResizeMessage());
    mutation.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", sendResizeMessage);

    return () => {
      mutation.disconnect();
      window.removeEventListener("resize", sendResizeMessage);
    };
  }, []);

  return null;
}
