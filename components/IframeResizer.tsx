"use client";
import { useEffect } from "react";
import { sendResizeMessage } from "@/lib/iframeResize";

export default function IframeResizer() {
  useEffect(() => {
    sendResizeMessage();

    // A single measurement right on the resize event can catch mobile browsers
    // mid-reflow (e.g. grid column count still settling after an orientation
    // change), so follow up with a delayed re-check.
    function onResize() {
      sendResizeMessage();
      setTimeout(sendResizeMessage, 300);
    }

    const mutation = new MutationObserver(() => sendResizeMessage());
    mutation.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", onResize);

    return () => {
      mutation.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
