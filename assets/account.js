// Accounts and levels (see "Accounts and levels" in requirements.md).
// You sign in with your made-up name (like "BraveBeetle42") and a password. The game server
// (server/index.js) keeps the accounts. There are no emails, so nothing about the real person is saved.
// You can also sign in with Google: the server keeps only a hash of Google's number for you (no email
// or real name), and you still pick a made-up name.
//
// Levels:
//   Team     (our team)  can do anything: fix and delete reports, and manage accounts
//   Manager              can look at all the reports, but can't change them
//   Player               can report bugs and play the game
//   Visitor (not signed in) can report bugs. The game needs an account.
//
// It uses pieces from the other files: store (app.js), el (reports.js), openPopup (game.js).

// The game server. A page can set window.INNVADEX_HTTP first (for testing on your own computer).
const GAME_SERVER_HTTP = window.INNVADEX_HTTP || "https://innvadex-server.pandadifferent246.workers.dev";
const ACCOUNT_URL = GAME_SERVER_HTTP + "/account";
// Google's sign-in button (loaded only when a sign-in pop-up opens)
const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";
const ACCOUNT_KEY = "pyinsect.account";   // { session, me } on this device. The session is like a key: never shown.
// This device's random number, so our team can block a device (not a whole network). Nothing else in it.
const DEVICE_KEY = "pyinsect.device", DEVICE_BLOCKED_KEY = "pyinsect.deviceBlocked";
// The reports page (relay/worker.js). Team and Manager accounts sign in there to see reports.
const REVIEW_URL = "https://pyinsect-relay.pandadifferent246.workers.dev/review/";
// How long our team can block someone for (Manage accounts)
const BLOCK_CHOICES = [["hour", "1 hour"], ["day", "1 day"], ["week", "1 week"], ["forever", "Forever"], ["device", "Forever + their device"]];
const LEVELS = {
  team: { name: "Team", emoji: "⭐", about: "You can do anything: fix and delete reports, and manage accounts." },
  manager: { name: "Manager", emoji: "📋", about: "You can look at all the reports, but you can't change them." },
  player: { name: "Player", emoji: "🎮", about: "You can report bugs and play the game." },
  owner: { name: "Owner", emoji: "👑", about: "You own Pyinsect: you can do anything, and nobody can block you or change your account." },
  visitor: { name: "Visitor", emoji: "👋", about: "You can report bugs. Sign in to play the game too." },
};
const ACCOUNT_ERRORS = {
  wrong: "That name and password don't match. Check them and try again.",
  slow: "Too many tries. Wait 15 minutes, then try again.",
  short: "Your password needs at least 6 letters or numbers.",
  taken: "Someone just took that name. Pick another one.",
  name: "Pick one of the names first.",
  blocked: "This account is blocked. Ask our team if you think that's a mistake.",
  deviceBlocked: "This device is blocked. Ask our team if you think that's a mistake.",
  offline: "Can't reach the server. Check your internet and try again.",
  code: "That code isn't right.",
  self: "You can't change your own account here. Ask another team member.",
  notFound: "There's no account with that name.",
  level: "Your level can't do that.",
  badName: "Names can have 3 to 20 letters, numbers, or _ (no spaces), and nothing rude.",
  nameTaken: "Someone already has that name. Try another one.",
  owner: "Nobody can block or change the owner's account.",
  google: "Google sign-in didn't work. Try again.",
  googleTaken: "That Google account is already used by another Pyinsect account.",
  needPassword: "You sign in only with Google, so it can't be taken off. Ask our team for a password first.",
};

const account = {
  session: () => store.get(ACCOUNT_KEY, null)?.session || null,
  me: () => store.get(ACCOUNT_KEY, null)?.me || null,
  level: () => (account.session() && account.me()?.level) || "visitor",
  signedIn: () => !!account.session(),
  // What to show as your level: "owner" for the owner (who is Team underneath)
  shownLevel: () => account.signedIn() && account.me()?.owner ? "owner" : account.level(),
  forget: () => forgetAccount(),
  blockDevice: () => setDeviceBlocked(true),
};
window.account = account;

// A small tag like "📋 Manager" to show next to a name
function levelTag(level) {
  const lv = LEVELS[level] || LEVELS.player;
  return el("span", `level-tag ${level}`, `${lv.emoji} ${lv.name}`);
}
window.levelTag = levelTag;

function deviceId() {
  let id = store.get(DEVICE_KEY, null);
  if (!/^[0-9a-f]{32}$/.test(id || "")) {
    id = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
    store.set(DEVICE_KEY, id);
  }
  return id;
}
window.deviceId = deviceId;
const deviceBlocked = () => !!store.get(DEVICE_BLOCKED_KEY, false);
function setDeviceBlocked(yes) {
  if (yes) { store.set(DEVICE_BLOCKED_KEY, true); if (account.signedIn()) forgetAccount(); }
  else store.del(DEVICE_BLOCKED_KEY);
}

function saveAccount(session, me) { store.set(ACCOUNT_KEY, { session, me }); accountChanged(); }
function forgetAccount() { store.del(ACCOUNT_KEY); accountChanged(); }

// Asks the game server to do something. Answers the server's reply, or { error: "..." }.
async function accountCall(what, data = {}) {
  let res, body = {};
  try {
    res = await fetch(ACCOUNT_URL, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ do: what, session: account.session() || undefined, device: deviceId(), ...data }) });
    body = await res.json().catch(() => ({}));
  } catch { return { error: "offline" }; }
  if (!res.ok && !body.error) body.error = "oops";
  // Signed out somewhere else, or blocked: this device forgets the account
  if (account.session() && (body.error === "signin" || body.error === "blocked")) forgetAccount();
  if (body.error === "deviceBlocked") setDeviceBlocked(true);
  return body;
}
const whenText = ms => new Date(ms).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const errorText = (e, until) => e === "blocked" && until ? `This account is blocked until ${whenText(until)}.`
  : ACCOUNT_ERRORS[e] || "Something went wrong. Try again.";

// ---------- the parts of the page that change with your level ----------
function accountChanged() {
  const me = account.me(), on = account.signedIn();
  const btn = $("accountBtn");
  if (btn) {
    btn.querySelector("span").textContent = on && me ? me.name : "Sign in";
    // Your level next to your name (Team, Manager, or Player)
    btn.querySelector(".level-tag")?.remove();
    if (on && me) btn.append(" ", levelTag(account.shownLevel()));
  }
  // The game needs an account
  if ($("game")) { $("game").hidden = !on; $("gameLocked").hidden = on; }
  if (!on && !$("gamePopup").hidden && !$("gamePopupBox").querySelector(".account")) window.Innvadex?.closePopup();
}

// The game can't be played when you're not signed in (reporting still works)
if (window.Innvadex) {
  for (const f of ["encounter", "native", "fakePhoto", "firstHowTo"]) {
    const real = window.Innvadex[f];
    window.Innvadex[f] = (...args) => account.signedIn() ? real(...args) : undefined;
  }
  const route = window.Innvadex.route;
  window.Innvadex.route = sub => route(account.signedIn() ? sub : null);   // null also closes the game's camera
}

// ---------- the account pop-up ----------
const acField = (label, type, opts = {}) => {
  const box = el("label", "account-field"), input = el("input");
  input.type = type; input.autocomplete = opts.autocomplete || "off"; input.maxLength = opts.max || 100;
  input.spellcheck = false; input.autocapitalize = "off";
  if (opts.placeholder) input.placeholder = opts.placeholder;
  box.append(el("span", null, label), input);
  return [box, input];
};
const acButton = (text, onClick, primary) => {
  const b = el("button", "btn" + (primary ? " primary" : ""), text); b.type = "button"; b.onclick = onClick; return b;
};
// Runs a button's job: the button waits, then the error (if any) shows in `msg`
async function acBusy(btn, msg, job) {
  btn.disabled = true; msg.textContent = "";
  // A job answers nothing, an error word, or the server's reply (for "blocked until ...")
  try { const err = await job(); if (err) msg.textContent = typeof err === "object" ? errorText(err.error, err.until) : errorText(err); }
  finally { btn.disabled = false; }
}
const acBox = (...parts) => { const d = el("div", "account"); d.append(...parts); return d; };
// "By signing in, you agree to the Terms of Use and Privacy Policy" (pages in terms/ and privacy/)
function agreeLine(what) {
  const p = el("p", "muted agree-line", `By ${what}, you agree to our `), terms = el("a", null, "Terms of Use"), priv = el("a", null, "Privacy Policy");
  terms.href = "terms/"; priv.href = "privacy/"; terms.target = priv.target = "_blank"; terms.rel = priv.rel = "noopener";
  p.append(terms, " and ", priv, ".");
  return p;
}

// ---------- Sign in with Google ----------
// The server says if Google sign-in is on (its client ID, not a secret). Then Google's script draws its button.
let googleReady = null, onGoogle = null;
function loadGoogle() {
  return googleReady || (googleReady = (async () => {
    const info = await fetch(GAME_SERVER_HTTP + "/").then(r => r.json()).catch(() => ({}));
    if (!info.google) return false;
    await new Promise((ok, no) => { const s = document.createElement("script"); s.src = GOOGLE_SCRIPT; s.async = true; s.onload = ok; s.onerror = no; document.head.append(s); });
    google.accounts.id.initialize({ client_id: info.google, callback: r => onGoogle?.(r.credential) });
    return true;
  })().catch(() => { googleReady = null; return false; }));
}
// A box with Google's button. `then(credential)` runs after Google says who you are.
function googleButton(then, text = "signin_with") {
  const box = el("div", "google-box"); box.hidden = true;
  const spot = el("div", "google-btn");
  box.append(el("p", "muted or-line", "or"), spot);
  loadGoogle().then(on => {
    if (!on || !box.isConnected) return;
    onGoogle = then;
    google.accounts.id.renderButton(spot, { theme: "outline", size: "large", shape: "pill", text });
    box.hidden = false;
  });
  return box;
}
async function googleSignIn(credential, msg) {
  msg.textContent = "Signing in…";
  const r = await accountCall("google", { credential });
  if (r.error === "newGoogle") return googleName(credential, r.names);
  if (r.error) { msg.textContent = errorText(r.error, r.until); return; }
  saveAccount(r.session, r.me);
  if (r.me.owner) setDeviceBlocked(false);
  openAccount("me");
}
// First time with Google: pick a made-up name (Google's name for you is never used)
function googleName(credential, names) {
  const options = el("div", "name-options"), msg = el("p", "account-msg");
  let picked = null;
  const showNames = list => {
    options.innerHTML = ""; picked = null;
    for (const n of list) {
      const b = acButton(n, () => { picked = n; options.querySelectorAll(".btn").forEach(x => x.classList.toggle("primary", x === b)); });
      options.append(b);
    }
  };
  const go = acButton("Make my account", () => acBusy(go, msg, async () => {
    if (!picked) return "name";
    const r = await accountCall("google", { credential, name: picked });
    if (r.error === "taken" && r.names) showNames(r.names);
    if (r.error) return r;
    saveAccount(r.session, r.me); openAccount("me");
  }), true);
  openPopup([acBox(el("h2", null, "👤 Pick your name"),
    el("p", null, "Other players will see this name. We don't keep your email or your real name from Google."), options, msg, go)], [["Close", false]]);
  showNames(names || []);
}

function openAccount(view = account.signedIn() ? "me" : "start") {
  if (deviceBlocked() && view !== "signin") {
    const owner = el("button", "link", "I'm the owner: sign in"); owner.type = "button"; owner.onclick = () => openAccount("signin");
    openPopup([acBox(el("h2", null, "📵 This device is blocked"), el("p", null, ACCOUNT_ERRORS.deviceBlocked), owner)], [["Close", false]]);
  } else if (view === "start") {
    const msg = el("p", "account-msg");
    openPopup([acBox(el("h2", null, "👤 Your account"),
      el("p", null, "Sign in to play the Innvadex game. You can check trees and report bugs without an account."),
      acButton("Sign in", () => openAccount("signin"), true), acButton("Make an account", () => openAccount("signup")),
      googleButton(c => googleSignIn(c, msg), "continue_with"), msg, agreeLine("signing in"))], [["Close", false]]);
  } else if (view === "signin") {
    const [nameBox, name] = acField("Your name", "text", { placeholder: "BraveBeetle42", max: 40, autocomplete: "username" });
    const [passBox, pass] = acField("Password", "password", { autocomplete: "current-password" });
    const msg = el("p", "account-msg"), go = acButton("Sign in", () => acBusy(go, msg, async () => {
      if (!name.value.trim() || !pass.value) return "wrong";
      const r = await accountCall("signin", { name: name.value.trim(), password: pass.value });
      if (r.error) return r;
      saveAccount(r.session, r.me);
      if (r.me.owner) setDeviceBlocked(false);   // the owner can use any device
      openAccount("me");
    }), true);
    pass.onkeydown = e => { if (e.key === "Enter") go.click(); };
    openPopup([acBox(el("h2", null, "👤 Sign in"), nameBox, passBox, msg, go, googleButton(c => googleSignIn(c, msg)),
      acButton("I don't have an account yet", () => openAccount("signup")), agreeLine("signing in"),
      el("p", "muted", "Forgot your password? Ask our team to give you a new one."))], [["Close", false]]);
    name.focus();
  } else if (view === "signup") signUp();
  else if (view === "me") showMe();
  else if (view === "manage") manageAccounts();
}

// Make an account: pick a made-up name, then a password
async function signUp(names) {
  const options = el("div", "name-options"), msg = el("p", "account-msg");
  let picked = null;
  const showNames = list => {
    options.innerHTML = ""; picked = null;
    for (const n of list) {
      const b = acButton(n, () => { picked = n; options.querySelectorAll(".btn").forEach(x => x.classList.toggle("primary", x === b)); });
      options.append(b);
    }
  };
  const more = el("button", "link", "Show me other names"); more.type = "button";
  more.onclick = async () => { const r = await accountCall("names"); if (r.names) showNames(r.names); else msg.textContent = errorText(r.error); };
  const [passBox, pass] = acField("Password (at least 6 letters or numbers)", "password", { autocomplete: "new-password" });
  const [againBox, again] = acField("Type it again", "password", { autocomplete: "new-password" });
  const go = acButton("Make my account", () => acBusy(go, msg, async () => {
    if (!picked) return "name";
    if (pass.value.length < 6) return "short";
    if (pass.value !== again.value) { msg.textContent = "The two passwords don't match."; return; }
    const r = await accountCall("signup", { name: picked, password: pass.value });
    if (r.error === "taken" && r.names) showNames(r.names);
    if (r.error) return r.error;
    saveAccount(r.session, r.me); openAccount("me");
  }), true);
  openPopup([acBox(el("h2", null, "👤 Make an account"),
    el("p", null, "1. Pick your name. Other players will see it, and you'll sign in with it."), options, more,
    el("p", "muted", "Names are made up, so nobody uses their real name. No email needed."),
    el("p", null, "2. Pick a password, and remember it!"), passBox, againBox, msg, go,
    googleButton(c => googleSignIn(c, msg), "signup_with"), agreeLine("making an account"),
    acButton("I already have an account", () => openAccount("signin")))], [["Close", false]]);
  if (names) showNames(names);
  else { const r = await accountCall("names"); if (r.names) showNames(r.names); else msg.textContent = errorText(r.error); }
}

// Signed in: your name, your level, and what you can do
async function showMe() {
  const draw = () => {
    const me = account.me(), lv = LEVELS[account.shownLevel()] || LEVELS.player;
    const parts = [el("h2", null, `${me.look || "🙂"} ${me.name}`), el("p", "level-chip", `${lv.emoji} ${lv.name}`), el("p", null, lv.about)];
    if (account.level() === "team" || account.level() === "manager") {
      const review = el("a", "btn primary", "📋 Review reports");
      review.href = REVIEW_URL; review.target = "_blank"; review.rel = "noopener";
      parts.push(review);
    }
    if (account.level() === "team") {
      parts.push(acButton("👥 Manage accounts", () => openAccount("manage")));
      // Team members can pick their own name
      const more = el("details", "account-setup"), msg = el("p", "account-msg");
      const [nameBox, name] = acField("New name (3 to 20 letters, numbers, or _)", "text", { max: 20, placeholder: me.name });
      const go = acButton("Change my name", () => acBusy(go, msg, async () => {
        const r = await accountCall("rename", { name: me.name, newName: name.value.trim() });
        if (r.error) return r.error;
        saveAccount(account.session(), r.me); openAccount("me");
      }));
      more.append(el("summary", null, "✏️ Change my name"), nameBox, msg, go);
      parts.push(more);
    }
    // Sign in with Google too (or take it off)
    {
      const more = el("details", "account-setup"), msg = el("p", "account-msg");
      if (me.google) {
        const off = acButton("Take Google off", () => acBusy(off, msg, async () => {
          const r = await accountCall("unlinkGoogle");
          if (r.error) return r.error;
          saveAccount(account.session(), r.me); openAccount("me");
        }));
        more.append(el("summary", null, "🔗 Google: on"), el("p", "muted", "You can sign in with Google or with your name and password."), msg, off);
      } else {
        more.append(el("summary", null, "🔗 Sign in with Google too"),
          el("p", "muted", "Then you can sign in with Google next time. We don't keep your email or real name."), msg,
          googleButton(async c => {
            const r = await accountCall("linkGoogle", { credential: c });
            if (r.error) { msg.textContent = errorText(r.error); return; }
            saveAccount(account.session(), r.me); openAccount("me");
          }, "continue_with"));
      }
      parts.push(more);
    }
    parts.push(acButton("Sign out", async () => { await accountCall("signout"); forgetAccount(); openAccount("start"); }));
    // Our team's setup code makes the first team account (a grown-up keeps the code secret)
    if (account.level() !== "team") {
      const more = el("details", "account-setup"), msg = el("p", "account-msg");
      const [codeBox, code] = acField("Team setup code", "password");
      const go = acButton("Use the code", () => acBusy(go, msg, async () => {
        const r = await accountCall("claim", { code: code.value });
        if (r.error) return r.error;
        saveAccount(account.session(), r.me); openAccount("me");
      }));
      more.append(el("summary", null, "Are you on our team?"), el("p", "muted", "Type the team setup code a grown-up gave you."), codeBox, msg, go);
      parts.push(more);
    }
    // The owner code (only the owner knows it) makes this account the owner
    if (!me.owner) {
      const more = el("details", "account-setup"), msg = el("p", "account-msg");
      const [codeBox, code] = acField("Owner code", "password");
      const go = acButton("Use the owner code", () => acBusy(go, msg, async () => {
        const r = await accountCall("claimOwner", { code: code.value });
        if (r.error) return r.error;
        saveAccount(account.session(), r.me); setDeviceBlocked(false); openAccount("me");
      }));
      more.append(el("summary", null, "👑 Are you the owner?"), codeBox, msg, go);
      parts.push(more);
    }
    openPopup([acBox(...parts)], [["Close", false]]);
  };
  draw();
  // Check the level is still right (our team may have changed it)
  const r = await accountCall("me");
  if (r.me && account.signedIn()) {
    const changed = JSON.stringify(r.me) !== JSON.stringify(account.me());
    store.set(ACCOUNT_KEY, { session: account.session(), me: r.me });
    if (changed && !$("gamePopup").hidden && $("gamePopupBox").querySelector(".account")) draw();
    accountChanged();
  } else if (!account.signedIn()) openAccount("start");
}

// Team level: find accounts, change their level, block them, or give them a new password
function manageAccounts() {
  const [findBox, find] = acField("Find a name", "text", { placeholder: "Brave", max: 40 });
  const list = el("div", "account-list"), msg = el("p", "account-msg");
  const load = async () => {
    const r = await accountCall("accounts", { find: find.value.trim() });
    list.innerHTML = "";
    if (r.error) { msg.textContent = errorText(r.error); return; }
    if (!r.accounts.length) msg.textContent = "No accounts found.";   // (a message from a button stays)
    for (const a of r.accounts) list.append(accountRow(a, load, msg));
  };
  let timer; find.oninput = () => { clearTimeout(timer); msg.textContent = ""; timer = setTimeout(load, 300); };
  openPopup([acBox(el("h2", null, "👥 Manage accounts"),
    el("p", "muted", "Team = can do anything. Manager = can look at reports. Player = can report and play."),
    findBox, msg, list, acButton("← Back", () => openAccount("me")))], [["Close", false]]);
  load();
}
function accountRow(a, reload, msg) {
  const row = el("div", "person account-row" + (a.blocked ? " away" : "")), who = el("div", "foe-who"), btns = el("div", "foe-buttons");
  const lv = LEVELS[a.level] || LEVELS.player;
  const status = a.owner ? "👑 Owner" : a.device ? "📵 Device blocked" : !a.blocked ? `${lv.emoji} ${lv.name}` : a.until ? `🚫 Blocked until ${whenText(a.until)}` : "🚫 Blocked forever";
  who.append(el("strong", null, a.name), el("span", "muted", status));
  const isMe = a.name === account.me()?.name;
  if (isMe) btns.append(el("span", "muted", "That's you"));
  else if (a.owner) btns.append(el("span", "muted", "Nobody can change the owner"));
  else {
    const pick = el("select", "level-pick");
    pick.setAttribute("aria-label", `Level for ${a.name}`);
    for (const k of ["player", "manager", "team"]) { const o = el("option", null, LEVELS[k].name); o.value = k; o.selected = k === a.level; pick.append(o); }
    pick.onchange = async () => { const r = await accountCall("level", { name: a.name, level: pick.value }); msg.textContent = r.error ? errorText(r.error) : `${a.name} is a ${LEVELS[pick.value].name} now.`; reload(); };
    // Block for a while, forever, or forever with their device (blocked devices can't sign in, play, or report)
    let block;
    if (a.blocked || a.device) {
      block = acButton("Unblock", async () => {
        const r = await accountCall("block", { name: a.name, yes: false });
        msg.textContent = r.error ? errorText(r.error) : `${a.name} isn't blocked any more.`; reload();
      });
    } else {
      block = el("select", "level-pick");
      block.setAttribute("aria-label", `Block ${a.name}`);
      const first = el("option", null, "🚫 Block…"); first.value = ""; block.append(first);
      for (const [k, text] of BLOCK_CHOICES) { const o = el("option", null, text); o.value = k; block.append(o); }
      block.onchange = async () => {
        const k = block.value, text = BLOCK_CHOICES.find(c => c[0] === k)?.[1];
        block.value = "";
        if (!k) return;
        const sure = k === "device"
          ? `Block ${a.name} and the devices they used? Those phones and computers won't be able to sign in, play, or send reports until you unblock them. Other people on the same Wi-Fi are fine.`
          : `Block ${a.name} for ${text.toLowerCase()}? They won't be able to sign in or play.`;
        if (!confirm(sure)) return;
        const r = await accountCall("block", k === "device" ? { name: a.name, yes: true, withDevices: true } : { name: a.name, yes: true, for: k });
        msg.textContent = r.error ? errorText(r.error)
          : k !== "device" ? `${a.name} is blocked.`
          : r.devices ? `${a.name} and ${r.devices === 1 ? "1 device are" : `${r.devices} devices are`} blocked.`
          : `${a.name} is blocked. No devices were blocked: they haven't used this version of the site yet.`;
        reload();
      };
    }
    const reset = acButton("New password", async () => {
      const p = prompt(`Type a new password for ${a.name} (at least 6 letters or numbers). Then tell them what it is.`);
      if (p == null) return;
      const r = await accountCall("reset", { name: a.name, password: p });
      msg.textContent = r.error ? errorText(r.error) : `${a.name} has a new password now. They're signed out until they use it.`;
    });
    block.classList.add("small"); reset.classList.add("small");
    const rename = acButton("Rename", async () => {
      const n = prompt(`New name for ${a.name} (3 to 20 letters, numbers, or _):`, a.name);
      if (n == null || n.trim() === a.name) return;
      const r = await accountCall("rename", { name: a.name, newName: n.trim() });
      msg.textContent = r.error ? errorText(r.error) : `${a.name} is called ${n.trim()} now.`; reload();
    });
    rename.classList.add("small");
    btns.append(pick, block, reset, rename);
  }
  row.append(who, btns);
  return row;
}

document.addEventListener("click", e => { if (e.target.closest("[data-account]")) openAccount(); });
// Blocked devices don't send reports (reports.js's relaySend). The report is dropped, like one the relay turns down.
if (typeof relaySend === "function") {
  const send = relaySend;
  window.relaySend = (...args) => {
    if (!deviceBlocked()) return send(...args);
    const e = new Error(ACCOUNT_ERRORS.deviceBlocked); e.rejected = true; return Promise.reject(e);
  };
}
accountChanged();
// Is this device blocked? (It's checked every time the page opens, so unblocking works too.)
accountCall("device").then(r => { if (typeof r.blocked === "boolean") setDeviceBlocked(r.blocked); });
// Check the saved account is still good (it may have been blocked, or its level changed)
if (account.signedIn()) accountCall("me").then(r => { if (r.me && account.signedIn()) { store.set(ACCOUNT_KEY, { session: account.session(), me: r.me }); accountChanged(); } });
