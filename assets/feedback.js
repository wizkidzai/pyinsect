// Human in the loop: people tell the AI when it is wrong.
//   1. Someone taps "No" and says what the insect really is. That is one vote.
//   2. When 3 votes agree (AI said X, people say Y), it goes to "Needs a team check".
//   3. A Team person sees the photos and the 3 things the AI thought it could be, double checks
//      which one is right, and taps it to approve. The AI only changes after that.
// Votes are saved on this device (localStorage). The AI model itself is not retrained here:
// an approved fix just puts the corrected answer first in the results.
// Uses: INVASIVE, CLASS_NAMES, MODEL, commonName (app.js / species.js), el (app.js), window.account.
(() => {
  const KEY = "pyinsect-feedback", NEEDED = 3;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
  // d.votes: { "said>real": count }   d.approved: { said: real }   d.rejected: { "said>real": true }
  const pairs = d => Object.entries(d.votes || {}).map(([k, n]) => { const [said, real] = k.split(">"); return { k, said, real, n }; });
  const pending = d => pairs(d).filter(x => x.n >= NEEDED && !(d.approved || {})[x.said] && !(d.rejected || {})[x.k]);
  // A small copy of the photo to keep with the vote, so the team can look at it later
  function thumb(url) {
    return new Promise(done => {
      const img = new Image();
      img.onload = () => {
        const w = 200, h = Math.round(200 * img.naturalHeight / img.naturalWidth) || 200, c = document.createElement("canvas");
        c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h);
        done(c.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = () => done(null);
      img.src = url;
    });
  }
  const isTeam = () => window.account?.level?.() === "team";

  // An approved fix: the corrected answer goes first
  function fix(p) {
    if (!p.top3 || p.step === "tree" || p.verdict !== "ok") return p;
    const real = (load().approved || {})[p.top3[0].species];
    if (!real) return p;
    const rest = p.top3.filter(t => t.species !== real), old = p.top3.find(t => t.species === real);
    return { ...p, corrected: true, top3: [{ species: real, confidence: old ? old.confidence : p.top3[0].confidence }, ...rest].slice(0, 3) };
  }

  // Save one vote: the AI said `said`, the person says `real`. Returns a thank-you line, or null if they weren't sure ("?").
  async function vote(p, said, real) {
    if (real === "?") return null;
    const img = p.url ? await thumb(p.url) : null;
    const d = load();
    d.votes = d.votes || {}; const k = `${said}>${real}`; d.votes[k] = (d.votes[k] || 0) + 1;
    // Keep what the team needs to double check: the photos (up to 3) and what the AI thought
    d.cases = d.cases || {}; const c = d.cases[k] = d.cases[k] || { photos: [] };
    c.top3 = p.top3.map(t => ({ species: t.species, confidence: t.confidence }));
    if (img) c.photos = [...c.photos, img].slice(-3);
    save(d);
    return d.votes[k] >= NEEDED ? "Thanks! Enough people agree, so our team will check it. 🔎" : `Thanks! ${d.votes[k]} of ${NEEDED} votes so the team checks it.`;
  }

  // A reference photo of a species from iNaturalist (free, no key). Saved so each is looked up once.
  const photoCache = {};
  function referencePhoto(species) {
    const name = (typeof sciName === "function" ? species.replace(/_(damage|egg_mass)$/, "") : species).replace(/_/g, " ");
    return photoCache[name] = photoCache[name] || fetch("https://api.inaturalist.org/v1/taxa?per_page=1&q=" + encodeURIComponent(name))
      .then(r => r.json()).then(j => (j.results?.[0]?.default_photo?.medium_url) || null).catch(() => null);
  }

  // "Human in the loop" button: shows a photo of each of the AI's 3 guesses with its name under it.
  // The person taps the one they really saw. That answer is saved with their photo for the team to check.
  function human(p, label) {
    const box = el("div", "hil");
    const open = el("button", "btn hil-btn", "🧑 Human in the loop" + (label ? ` (${label})` : "")); open.type = "button";
    box.append(open);
    open.onclick = () => {
      open.hidden = true;
      box.append(el("p", "fb-ask", "Which one did you see?"));
      const grid = el("div", "hil-grid");
      for (const t of p.top3) {
        const card = el("button", "hil-card"); card.type = "button";
        const img = el("img"); img.alt = ""; img.loading = "lazy";
        const hold = el("span", "hil-hold", "🐛");
        referencePhoto(t.species).then(u => { if (u) { img.src = u; img.alt = commonName(t.species); hold.replaceWith(img); } });
        card.append(hold, el("span", "hil-name", commonName(t.species)));
        card.onclick = async () => {
          grid.querySelectorAll("button").forEach(b => b.disabled = true);
          const said = p.top3[0].species;
          const msg = t.species === said ? "Thanks! You saw the same one the AI picked. 👍" : await vote(p, said, t.species);
          grid.replaceWith(el("p", "fb-thanks", `You chose ${commonName(t.species)}. ${msg}`));
        };
        grid.append(card);
      }
      box.append(grid);
    };
    return box;
  }

  // The "Is this right?" box for one photo
  function panel(p) {
    const box = el("div", "fb"), said = p.top3[0].species;
    const ask = el("p", "fb-ask", "Is the first answer right?");
    const yes = el("button", "btn fb-yes", "👍 Yes"), no = el("button", "btn fb-no", "👎 No");
    yes.type = no.type = "button";
    const row = el("div", "fb-row"); row.append(yes, no);
    box.append(ask, row);
    const thanks = text => { box.innerHTML = ""; box.append(el("p", "fb-thanks", text)); };
    yes.onclick = () => thanks("Thanks! 👍");
    no.onclick = () => {
      row.hidden = true;
      const pick = el("select", "fb-pick"), none = el("option", null, "What is it really?"); none.value = ""; pick.append(none);
      for (const c of CLASS_NAMES.filter(c => c !== said && c !== MODEL.otherClass)) { const o = el("option", null, commonName(c)); o.value = c; pick.append(o); }
      const other = el("option", null, "Something else / not sure"); other.value = "?"; pick.append(other);
      const send = el("button", "btn primary", "Send feedback"); send.type = "button";
      send.onclick = async () => {
        if (!pick.value) return;
        send.disabled = true;
        const msg = await vote(p, said, pick.value);
        if (msg) thanks(msg);
        else thanks("Thanks! We'll have a person look at it.");
      };
      box.append(pick, send);
    };
    return box;
  }

  // Team only: the fixes waiting for a person to check them. The team sees the photos and the 3
  // things the AI thought it could be, and taps the one that is right.
  function review() {
    const d = load(), list = pending(d);
    if (!isTeam() || !list.length) return null;
    const box = el("div", "fb-review");
    box.append(el("p", "fb-ask", "🔎 Team check: double check, then tap the right one"));
    for (const x of list) {
      const item = el("div", "fb-case"), c = (d.cases || {})[x.k] || { photos: [], top3: [] };
      item.append(el("p", null, `${x.n} people say the AI is wrong. It said ${commonName(x.said)}. They say ${commonName(x.real)}.`));
      if (c.photos.length) {
        const ph = el("div", "fb-photos");
        for (const src of c.photos) { const im = el("img"); im.src = src; im.alt = "Photo people sent"; ph.append(im); }
        item.append(ph);
      }
      // The AI's 3 guesses, plus what the people said if it wasn't one of them
      const options = [...c.top3];
      if (!options.some(t => t.species === x.real)) options.push({ species: x.real, confidence: null });
      for (const t of options) {
        const row = el("div", "fb-option" + (t.species === x.real ? " voted" : ""));
        const name = el("span", "fb-opt-name", commonName(t.species));
        const sci = typeof sciName === "function" ? sciName(t.species) : "";
        const look = el("a", "fb-look", "See reference photos");
        look.href = "https://www.inaturalist.org/taxa/search?q=" + encodeURIComponent(sci || commonName(t.species));
        look.target = "_blank"; look.rel = "noopener";
        const pick = el("button", "btn primary", t.species === x.said ? "AI was right" : "✅ This is right");
        pick.type = "button";
        pick.onclick = () => {
          const e = load();
          if (t.species === x.said) e.rejected = { ...(e.rejected || {}), [x.k]: true };
          else e.approved = { ...(e.approved || {}), [x.said]: t.species };
          save(e);
          item.replaceWith(el("p", "fb-thanks", t.species === x.said ? "Checked. The AI stays the same." : `✅ Approved. The AI now says ${commonName(t.species)}.`));
        };
        row.append(name, t.confidence == null ? "" : el("span", "pct", `${t.confidence.toFixed(1)}%`), look, pick);
        item.append(row);
      }
      box.append(item);
    }
    return box;
  }

  window.Feedback = { fix, panel, review, human };
})();
