// Applies the saved (or OS) colour scheme before the first paint, so a
// dark-mode user never sees a flash of the light theme while React boots.
//
// Deliberately an external file rather than an inline <script>: keeping it out
// of index.html is what lets the Content-Security-Policy drop 'unsafe-inline'
// from script-src. It must stay small and synchronous — it runs render-blocking
// in <head> order, ahead of the module bundle.
(function () {
  try {
    var stored = localStorage.getItem('zity_theme');
    var dark = stored
      ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {
    /* storage unavailable (private mode) — keep the light default */
  }
})();
