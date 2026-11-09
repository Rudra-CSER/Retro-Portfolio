// Analytics: Google Tag Manager (container GTM-W4F8RLRS, which runs GA4 G-WG6FK9TVLE) and
// Microsoft Clarity (project zaz66pzpl9).
//
// These live in this file instead of inline <script> blocks in index.html because the site's
// Content Security Policy only runs scripts that come from a file (server/src/middleware/security.js
// lists this site plus the Google and Clarity hosts). A snippet pasted inline into index.html
// gets blocked, and `npm test` fails to say so.
(function () {
  // Only on the real site: not on localhost, the tailnet, or *.workers.dev preview builds.
  if (!/(^|\.)rudramundal\.dev$/.test(location.hostname)) return;

  // Google Tag Manager (the official snippet, as a file)
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function () {
      window.dataLayer.push(arguments);
    };
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var gtm = document.createElement('script');
  gtm.async = true;
  gtm.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-W4F8RLRS';
  document.head.appendChild(gtm);

  // Microsoft Clarity (its snippet, as a file)
  window.clarity =
    window.clarity ||
    function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
  var clarity = document.createElement('script');
  clarity.async = true;
  clarity.src = 'https://www.clarity.ms/tag/zaz66pzpl9';
  document.head.appendChild(clarity);
})();
