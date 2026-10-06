// Runs synchronously in <head>: covers the page with the sky + wing mark until intro.js takes over.
(function () {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var root = document.documentElement;
    root.classList.add('booting');
    // Safety net: never keep the page hidden if something fails.
    setTimeout(function () { root.classList.remove('booting'); }, 4500);
  } catch (e) { /* no-op */ }
})();
