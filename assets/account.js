// Accounts and levels (see "Accounts and levels" in requirements.md).
// You sign in with your made-up name (like "BraveBeetle42") and a password. The game server
// (server/index.js) keeps the accounts. There are no emails, so nothing about the real person is saved.
//
// Levels:
//   Team     (our team)  can do anything: fix and delete reports, and manage accounts
//   Manager              can look at all the reports, but can't change them
//   Player               can report bugs and play the game
//   Visitor (not signed in) can report bugs. The game needs an account.
//
// It uses pieces from the other files: store (app.js), el (reports.js), openPopup (game.js).

// The game server. A page can set window.INNVADEX_HTTP first (for testing on your own computer).
const ACCOUNT_URL = (window.INNVADEX_HTTP || "https://innvadex-server.pandadifferent246.workers.dev") + "/account";
const ACCOUNT_KEY = "pyinsect.account";   // { session, me } on this device. The session is like a key: never shown.
const LEVELS = {
  team: { name: "Team", emoji: "⭐", about: "You can do anything: fix and delete reports, and manage accounts." },
  manager: { name: "Manager", emoji: "📋", about: "You can look at all the reports, but you can't change them." },
  player: { name: "Player", emoji: "🎮", about: "You can report bugs and play the game." },
  visitor: { name: "Visitor", emoji: "👋", about: "You can report bugs. Sign in to play the game too." },
};
const ACCOUNT_ERRORS = {
  wrong: "That name and password don't match. Check them and try again.",
  slow: "Too many tries. Wait 15 minutes, then try again.",
  short: "Your password needs at least 6 letters or numbers.",
  taken: "Someone just took that name. Pick another one.",
  name: "Pick one of the names first.",
  blocked: "This account is blocked. Ask our team if you think that's a mistake.",
  offline: "Can't reach the server. Check your internet and try again.",
  code: "That setup code isn't right.",
  self: "You can't change your own account here. Ask another team member.",
  notFound: "There's no account with that name.",
  level: "Your level can't do that.",
  badName: "Names can have 3 to 20 letters, numbers, or _ (no spaces), and nothing rude.",
  nameTaken: "Someone already has that name. Try another one.",
};

const account = {
  session: () => store.get(ACCOUNT_KEY, null)?.session || null,
  me: () => store.get(ACCOUNT_KEY, null)?.me || null,
  level: () => (account.session() && account.me()?.level) || "visitor",
  signedIn: () => !!account.session(),
  forget: () => forgetAccount(),
};
window.account = account;

function saveAccount(session, me) { store.set(ACCOUNT_KEY, { session, me }); accountChanged(); }
function forgetAccount() { store.del(ACCOUNT_KEY); accountChanged(); }

// Asks the game server to do something. Answers the server's reply, or { error: "..." }.
async function accountCall(what, data = {}) {
  let res, body = {};
  try {
    res = await fetch(ACCOUNT_URL, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ do: what, session: account.session() || undefined, ...data }) });
    body = await res.json().catch(() => ({}));
  } catch { return { error: "offline" }; }
  if (!res.ok && !body.error) body.error = "oops";
  // Signed out somewhere else, or blocked: this device forgets the account
  if (account.session() && (body.error === "signin" || body.error === "blocked")) forgetAccount();
  return body;
}
const errorText = e => ACCOUNT_ERRORS[e] || "Something went wrong. Try again.";

// ---------- the parts of the page that change with your level ----------
function accountChanged() {
  const me = account.me(), on = account.signedIn();
  const btn = $("accountBtn");
  if (btn) btn.querySelector("span").textContent = on && me ? me.name : "Sign in";
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
  try { const err = await job(); if (err) msg.textContent = errorText(err); }
  finally { btn.disabled = false; }
}
const acBox = (...parts) => { const d = el("div", "account"); d.append(...parts); return d; };

function openAccount(view = account.signedIn() ? "me" : "start") {
  if (view === "start") {
    openPopup([acBox(el("h2", null, "👤 Your account"),
      el("p", null, "Sign in to play the Innvadex game. You can check trees and report bugs without an account."),
      acButton("Sign in", () => openAccount("signin"), true), acButton("Make an account", () => openAccount("signup")))], [["Close", false]]);
  } else if (view === "signin") {
    const [nameBox, name] = acField("Your name", "text", { placeholder: "BraveBeetle42", max: 40, autocomplete: "username" });
    const [passBox, pass] = acField("Password", "password", { autocomplete: "current-password" });
    const msg = el("p", "account-msg"), go = acButton("Sign in", () => acBusy(go, msg, async () => {
      if (!name.value.trim() || !pass.value) return "wrong";
      const r = await accountCall("signin", { name: name.value.trim(), password: pass.value });
      if (r.error) return r.error;
      saveAccount(r.session, r.me); openAccount("me");
    }), true);
    pass.onkeydown = e => { if (e.key === "Enter") go.click(); };
    openPopup([acBox(el("h2", null, "👤 Sign in"), nameBox, passBox, msg, go,
      acButton("I don't have an account yet", () => openAccount("signup")),
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
    acButton("I already have an account", () => openAccount("signin")))], [["Close", false]]);
  if (names) showNames(names);
  else { const r = await accountCall("names"); if (r.names) showNames(r.names); else msg.textContent = errorText(r.error); }
}

// Signed in: your name, your level, and what you can do
async function showMe() {
  const draw = () => {
    const me = account.me(), lv = LEVELS[account.level()] || LEVELS.player;
    const parts = [el("h2", null, `${me.look || "🙂"} ${me.name}`), el("p", "level-chip", `${lv.emoji} ${lv.name}`), el("p", null, lv.about)];
    if (account.level() === "team") {
      parts.push(acButton("👥 Manage accounts", () => openAccount("manage"), true));
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
    msg.textContent = r.accounts.length ? "" : "No accounts found.";
    for (const a of r.accounts) list.append(accountRow(a, load, msg));
  };
  let timer; find.oninput = () => { clearTimeout(timer); timer = setTimeout(load, 300); };
  openPopup([acBox(el("h2", null, "👥 Manage accounts"),
    el("p", "muted", "Team = can do anything. Manager = can look at reports. Player = can report and play."),
    findBox, msg, list, acButton("← Back", () => openAccount("me")))], [["Close", false]]);
  load();
}
function accountRow(a, reload, msg) {
  const row = el("div", "person account-row" + (a.blocked ? " away" : "")), who = el("div", "foe-who"), btns = el("div", "foe-buttons");
  const lv = LEVELS[a.level] || LEVELS.player;
  who.append(el("strong", null, a.name), el("span", "muted", a.blocked ? "🚫 Blocked" : `${lv.emoji} ${lv.name}`));
  const isMe = a.name === account.me()?.name;
  if (isMe) btns.append(el("span", "muted", "That's you"));
  else {
    const pick = el("select", "level-pick");
    pick.setAttribute("aria-label", `Level for ${a.name}`);
    for (const k of ["player", "manager", "team"]) { const o = el("option", null, LEVELS[k].name); o.value = k; o.selected = k === a.level; pick.append(o); }
    pick.onchange = async () => { const r = await accountCall("level", { name: a.name, level: pick.value }); msg.textContent = r.error ? errorText(r.error) : `${a.name} is a ${LEVELS[pick.value].name} now.`; reload(); };
    const block = acButton(a.blocked ? "Unblock" : "Block", async () => {
      if (!a.blocked && !confirm(`Block ${a.name}? They won't be able to sign in or play.`)) return;
      const r = await accountCall("block", { name: a.name, yes: !a.blocked }); msg.textContent = r.error ? errorText(r.error) : ""; reload();
    });
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
accountChanged();
// Check the saved account is still good (it may have been blocked, or its level changed)
if (account.signedIn()) accountCall("me").then(r => { if (r.me && account.signedIn()) { store.set(ACCOUNT_KEY, { session: account.session(), me: r.me }); accountChanged(); } });
