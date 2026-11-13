// Website analytics (Google Analytics), see "Website analytics" in requirements.md and part 6 of
// privacy.html. It counts visits, screens, devices, and countries. Photos, reports, and locations are
// never sent to it. Google's ad features are off, because we don't use analytics for ads.
// The tag (G-...) isn't a secret: every visitor's browser sees it.
const GA_ID = "G-Z9TZM6MQKK";
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag("js", new Date());
gtag("config", GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });

// Each screen (#home, #detect, #game, #map) counts as a page. The address only has the screen's
// name after the #, nothing about a report.
window.addEventListener("hashchange", () => {
  gtag("event", "page_view", { page_title: `Pyinsect: ${location.hash.slice(1) || "home"}`, page_location: location.href });
});
