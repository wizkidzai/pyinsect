// Website analytics (GoatCounter), see "Website analytics" in requirements.md and part 6 of
// privacy.html. It counts visits, screens, browsers, and countries. It uses no cookies and doesn't
// save anyone's IP address. Photos, reports, and locations are never sent to it.
// Pyinsect has its own GoatCounter site ("wizkidz-pyinsect"), so its numbers stay separate from our
// other projects. Its dashboard is private: only people with our team's secret link can see it.
// GoatCounter's own script (gc.zgo.at/count.js) is loaded right after this file in the page.

// Don't count by itself on load: we count each screen ourselves, with the part after the #.
window.goatcounter = { no_onload: true };

function countScreen() {
  const screen = location.hash.slice(1);
  const visit = {
    path: location.pathname + location.hash,   // like /pyinsect/#map: only the screen's name, nothing about a report
    title: screen ? `Pyinsect: ${screen}` : document.title,
  };
  // GoatCounter's script loads in the background, so wait for it (but not forever).
  let tries = 0;
  const send = () => {
    if (window.goatcounter.count) window.goatcounter.count(visit);
    else if (++tries < 50) setTimeout(send, 200);   // up to 10 seconds, then skip this one
  };
  send();
}

countScreen();                                       // the first page
window.addEventListener("hashchange", countScreen);  // each screen after that (#home, #detect, #game, #map)
