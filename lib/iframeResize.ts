let rafId = 0;

export function sendResizeMessage() {
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    const root = document.getElementById("embed-root");
    const height = root ? root.offsetHeight : document.body.offsetHeight;
    window.parent.postMessage({ type: "eventwulf-resize", height, scrollTop: false }, "*");
  });
}
