(function () {
  window.addEventListener("message", function (e) {
    if (!e.data || e.data.type !== "eventwulf-resize") return;
    var f = document.getElementById("eventwulf-widget") || document.querySelector("iframe[src*='eventwulf']");
    if (!f) return;
    if (e.data.height) f.style.height = e.data.height + "px";
    if (e.data.scrollTop) {
      var t = f.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({ top: Math.max(0, t - 80), behavior: "smooth" });
    }
  });
})();
