// Custom analytics events. They go to Google Tag Manager's dataLayer, which client/public/analytics.js
// creates on the real site only, so on localhost and preview builds this does nothing. Tag Manager
// decides what reaches GA4: each event needs a Custom Event trigger there, with the same name.
//   pixel_cup_finish  a PIXEL CUP match reached full time (goals_for, goals_against)
//   email_copy        COPY ADDRESS worked
// (Clicks on EMAIL ME need no code: Tag Manager sees mailto: links by itself.)
export function track(event, params = {}) {
  window.dataLayer?.push({ event, ...params });
}
