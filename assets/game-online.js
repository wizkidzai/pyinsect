// Innvadex online: the online lobby (other players and bots) and quick battles against a bot
// (see "Innvadex: online lobby, friends, and watching battles" in requirements.md).
//
// The online lobby talks to the Innvadex game server (server/index.js, a free Cloudflare Worker):
// who's online, "Find a match", challenges by name, room codes, friends (and what they're doing),
// and watching battles live. The server rolls the dice, so both players always see the same battle.
// You need an account (assets/account.js): your online name is your account's made-up name, like
// "BraveBeetle42". There's no chat. Bots are marked "bot".
// It uses the game's own pieces from assets/game.js (moves, names, pop-ups, points, sounds).

// The game server. A page can set window.INNVADEX_SERVER first (for testing on your own computer).
const SERVER_URL = window.INNVADEX_SERVER || "wss://innvadex-server.pandadifferent246.workers.dev/ws";
const SERVER_VERSION = 2;          // must match VERSION in server/index.js
const ONLINE_WIN_POINTS = 15;

// ---------- quick battles against a bot (on this device, no internet needed) ----------
const BOT_LEVELS = [
  { level: 1, name: "Easy",   emoji: "🤖", change: -1, reward: 10 },
  { level: 2, name: "Medium", emoji: "🤖", change: 0,  reward: 15 },
  { level: 3, name: "Hard",   emoji: "🦾", change: 1,  reward: 20 },
];
// A bot with random invasive bugs: as many as your team, a bit weaker, the same, or a bit stronger
function botFoe(g, b) {
  const team = myTeam(g), all = gameSpecies();
  const avg = Math.round(team.reduce((s, f) => s + f.level, 0) / Math.max(1, team.length)) || 1;
  const picks = [...all].sort(() => Math.random() - 0.5).slice(0, Math.max(1, team.length));
  return {
    name: t("Bot ({level})", { level: t(b.name) }), emoji: b.emoji, level: b.level, reward: b.reward,
    team: picks, bugLevel: Math.max(1, Math.min(4, avg + b.change)),
    say: { hi: "Beep boop! Ready to battle?", next: "Next bug, loading…", lose: "Error 404: win not found. Good game!", win: "Beep! I win this time. Good game!" },
  };
}

// ---------- the rows on the Battles page (game.js calls this from renderBattles) ----------
function onlineBattleRows(list, g) {
  const none = !kindsCaught(g);
  const row = (emoji, name, about, buttons) => {
    const item = el("div", "foe quick"), who = el("div", "foe-who"), btns = el("div", "foe-buttons");
    who.append(el("strong", null, name), el("span", "muted", about));
    for (const [label, onClick, primary] of buttons) {
      const b = el("button", "btn" + (primary && !none ? " primary" : ""), none ? `🔒 ${t("Catch a bug first")}` : label);
      b.type = "button"; b.disabled = none; b.onclick = onClick;
      btns.append(b);
      if (none) break;   // one locked button is enough
    }
    item.append(el("span", "bug-emoji", emoji), who, btns);
    list.append(item);
  };
  list.append(el("h3", null, `⚔️ ${t("Quick battles")}`));
  row("🌐", t("Online lobby"), t("Battle players and bots from everywhere, find your friends, and watch battles live."),
    [[t("Go online"), openLobby, true]]);
  row("🤖", t("Battle a bot"), t("A quick battle any time, right here. Pick how hard."),
    BOT_LEVELS.map(b => [`${"⭐".repeat(b.level)} ${t(b.name)}`, () => battle(botFoe(loadGame(), b), false), b.level === 2]));
}

// ---------- the connection to the game server ----------
// net.view: what the pop-up shows: "connecting", "lobby", "waiting", "battle", "offline"
const net = { ws: null, view: null, me: null, players: [], online: 0, matches: [], friends: { list: [], incoming: [], outgoing: [] },
  challenges: [], note: "", found: null, match: null, waiting: null };

// Your side: avatar, team (species and levels), and your Bug Buddy's cheer
function myOnlineCard() {
  const g = loadGame();
  return { look: trainerLook(g) || "🙂", cheer: buddyBoost(g), team: myTeam(g).map(f => [f.species, f.level]) };
}
const sendNet = msg => { if (net.ws?.readyState === 1) net.ws.send(JSON.stringify(msg)); };

function openLobby() {
  if (!net.ws || net.ws.readyState > 1) {
    net.view = "connecting"; net.note = "";
    const ws = net.ws = new WebSocket(SERVER_URL);
    ws.onopen = () => ws.send(JSON.stringify({ t: "hello", v: SERVER_VERSION, session: window.account?.session(), device: window.deviceId?.(), ...myOnlineCard() }));
    ws.onmessage = e => { if (net.ws === ws) { let m; try { m = JSON.parse(e.data); } catch { return; } onNet(m); } };
    ws.onclose = () => {
      if (net.ws !== ws) return;
      net.ws = null;
      if (net.view && net.view !== "closed") { net.view = "offline"; showView(); }
    };
  } else {
    net.view = net.match ? "battle" : net.me ? "lobby" : "connecting";
    sendNet({ t: "card", ...myOnlineCard() });
  }
  showView();
}
// Closing the lobby goes offline (a battle you're in ends, and you're no longer listed)
function closeLobby() {
  net.view = "closed";
  const ws = net.ws; net.ws = null; net.match = null; net.me = null;
  try { ws?.close(); } catch {}
}

function onNet(m) {
  switch (m.t) {
    case "welcome": net.me = m.me; net.view = "lobby"; return showView();
    case "lobby": net.players = m.players; net.online = m.online; net.matches = m.matches; return refreshLobby();
    case "friends": net.friends = m; return refreshLobby();
    case "found": net.found = m; return refreshLobby();
    case "queued": net.waiting = { kind: "queue" }; net.view = "waiting"; return showView();
    case "room": net.waiting = { kind: "room", code: m.code }; net.view = "waiting"; return showView();
    case "cancelled": net.waiting = null; if (net.view === "waiting") { net.view = "lobby"; showView(); } return;
    case "challenged":
      if (!net.challenges.some(c => c.name === m.name)) net.challenges.push({ name: m.name, look: m.look });
      sound("click"); return refreshLobby();
    case "info": net.note = infoText(m); return net.view === "lobby" ? refreshLobby() : null;
    case "match": return onMatch(m);
    case "matchEnd": return onMatchEnd(m);
    case "error":
      net.note = m.code === "old" ? t("The game was updated. Reload the page to play online.")
        : m.code === "elsewhere" ? t("You went online on another tab or device, so this one was logged out.")
        : m.code === "blocked" ? t("This account is blocked.") : m.code === "deviceBlocked" ? t("This device is blocked.") : m.code === "signin" ? t("Please sign in again.") : t("Something went wrong. Try again.");
      net.view = "offline"; showView();
      // The server doesn't know this account any more (signed out, a new password, or blocked)
      if (m.code === "signin" || m.code === "blocked") { net.view = "closed"; window.account?.forget(); }
      if (m.code === "deviceBlocked") { net.view = "closed"; window.account?.blockDevice(); }
      return;
  }
}
function infoText(m) {
  const n = { name: m.name };
  return ({
    notFound: t("Nobody is called “{name}”. Check the spelling.", n), offline: t("{name} isn't online right now.", n),
    busy: t("{name} is busy right now. Try again soon.", n), declined: t("{name} said no this time.", n),
    challengeSent: t("Challenge sent to {name}. Waiting for an answer…", n), friendAdded: t("You and {name} are friends now!", n),
    noBugs: t("Catch a bug first: your caught bugs are your battle team."), noRoom: t("No room with that code. Check it and try again."),
  })[m.code] || "";
}
// What someone is doing right now
function statusText(s) {
  return !s ? "" : s.kind === "offline" ? t("Offline") : s.kind === "battle" ? t("Battling {name}", { name: s.vs })
    : s.kind === "watching" ? t("Watching {a} vs {b}", { a: s.a, b: s.b }) : s.kind === "catching" ? t("Catching bugs at {place}", { place: s.where })
    : s.kind === "queue" ? t("Looking for a match") : s.kind === "room" ? t("Waiting in a room") : t("In the lobby");
}

// ---------- the pop-up ----------
let lobbyUI = null;   // the lobby's parts, so updates don't redraw the search box you're typing in
function showView() {
  if (!net.view || net.view === "closed") return;
  lobbyUI = null;
  const title = el("h2", null, `🌐 ${t("Online lobby")}`);
  if (net.view === "connecting") openPopup([title, el("p", "muted", t("Connecting to the game server…"))], [["Close", false]]);
  else if (net.view === "offline") {
    const again = el("button", "btn primary", t("Try again")); again.type = "button"; again.onclick = () => { closeLobby(); openLobby(); };
    openPopup([title, el("p", null, net.note || t("You're offline: the connection to the game server closed.")), again], [["Close", false]]);
  } else if (net.view === "waiting") {
    const w = net.waiting, cancel = el("button", "btn", t("Cancel")); cancel.type = "button";
    cancel.onclick = () => sendNet({ t: "cancel" });
    openPopup([title, ...(w.kind === "room"
      ? [el("p", null, t("Tell your friend this code. They tap Join a room and type it:")), el("p", "room-code", w.code), el("p", "muted", t("Waiting for your friend…"))]
      : [el("p", null, t("Looking for a player…")), el("p", "muted", t("If nobody comes in a few seconds, a bot will battle you."))]), cancel], [["Close", false]]);
  } else if (net.view === "lobby") return showLobby();
  else if (net.view === "battle") return showBattleView();
  popupDone = closeLobby;
}

function showLobby() {
  const ui = lobbyUI = { note: el("p", "lobby-note"), lists: el("div", "lobby-lists") };
  const me = net.me;
  const head = el("p", "lobby-me", `${me.look} ${me.name} `);
  if (window.levelTag) head.append(levelTag(me.level || "player"));
  head.append(` · ${t(me.wins === 1 ? "{n} win" : "{n} wins", { n: me.wins })}`);
  ui.count = el("span", "muted", "");
  head.append(" · ", ui.count);
  const btn = (text, onClick, primary) => { const b = el("button", "btn" + (primary ? " primary" : ""), text); b.type = "button"; b.onclick = onClick; return b; };
  const play = el("div", "actions lobby-play");
  play.append(btn(`⚔️ ${t("Find a match")}`, () => sendNet({ t: "queue" }), true), btn(`🔑 ${t("Make a room")}`, () => sendNet({ t: "room" })));
  // Join a room / find a player: two small forms
  const form = (label, placeholder, maxLength, go) => {
    const box = el("div", "lobby-form"), input = el("input", "lobby-input");
    input.placeholder = placeholder; input.maxLength = maxLength; input.autocomplete = "off"; input.spellcheck = false; input.setAttribute("aria-label", label);
    const b = btn(label, () => { if (input.value.trim()) go(input.value.trim()); });
    input.onkeydown = e => { if (e.key === "Enter") b.click(); };
    box.append(input, b);
    return box;
  };
  const join = form(t("Join a room"), "ABCD", 4, code => sendNet({ t: "join", code }));
  join.querySelector("input").classList.add("code");
  const find = form(t("Find a player"), "BraveBeetle42", 30, name => { net.found = null; sendNet({ t: "find", name }); });
  openPopup([el("h2", null, `🌐 ${t("Online lobby")}`), head, play, join, find, ui.note, ui.lists], [["Leave lobby", false]]);
  popupDone = closeLobby;
  refreshLobby();
}

// One person in a list: avatar, name, what they're doing, and buttons
function personRow(p, extra = []) {
  const row = el("div", "person" + (p.online === false ? " away" : "")), who = el("div", "foe-who"), btns = el("div", "foe-buttons");
  const name = el("strong", null, `${p.look} ${p.name}`);
  if (p.bot) name.append(" ", el("span", "bot-tag", t("bot")));
  if (p.level && window.levelTag) name.append(" ", levelTag(p.level));   // Team and Manager
  who.append(name, el("span", "muted", statusText(p.status)));
  const btn = (text, onClick, primary) => { const b = el("button", "btn small" + (primary ? " primary" : ""), text); b.type = "button"; b.onclick = onClick; btns.append(b); };
  const s = p.status || {}, isFriend = net.friends.list.some(f => f.name === p.name), asked = net.friends.outgoing.some(f => f.name === p.name);
  if (p.online !== false && (s.kind === "lobby" || s.kind === "catching")) btn(t("Challenge"), () => { net.note = ""; sendNet({ t: "challenge", name: p.name }); }, true);
  if (s.kind === "battle" && s.match) btn(`👀 ${t("Watch")}`, () => sendNet({ t: "watch", match: s.match }));
  if (!isFriend && !asked && p.name !== net.me?.name) btn(`➕ ${t("Add friend")}`, () => sendNet({ t: "friend", name: p.name }));
  if (asked) btns.append(el("span", "muted", t("Friend request sent")));
  for (const [text, onClick, primary] of extra) btn(text, onClick, primary);
  row.append(who, btns);
  return row;
}

function refreshLobby() {
  const ui = lobbyUI;
  if (!ui || net.view !== "lobby") return;
  ui.count.textContent = t(net.online === 1 ? "{n} player online" : "{n} players online", { n: net.online });
  ui.note.textContent = net.note; ui.note.hidden = !net.note;
  const L = ui.lists; L.innerHTML = "";
  const section = (title, rows) => { if (!rows.length) return; L.append(el("h3", null, title), ...rows); };
  // Someone wants to battle you
  for (const c of net.challenges) {
    if (c === net.challenges[0]) L.append(el("h3", null, `⚔️ ${t("Challenges")}`));
    const row = el("div", "person challenge"), who = el("div", "foe-who"), b = el("div", "foe-buttons");
    who.append(el("strong", null, `${c.look} ${c.name}`), el("span", "muted", t("wants to battle you!")));
    const yes = el("button", "btn small primary", t("Battle!")), no = el("button", "btn small", t("No thanks"));
    yes.type = no.type = "button";
    yes.onclick = () => { net.challenges = net.challenges.filter(x => x !== c); sendNet({ t: "answer", name: c.name, yes: true }); };
    no.onclick = () => { net.challenges = net.challenges.filter(x => x !== c); sendNet({ t: "answer", name: c.name, yes: false }); refreshLobby(); };
    b.append(yes, no); row.append(who, b); L.append(row);
  }
  // A player you searched for
  if (net.found) section(`🔎 ${t("Search")}`, [net.found.player ? personRow(net.found.player) : el("p", "muted", t("Nobody is called “{name}”. Check the spelling.", { name: net.found.query }))]);
  // Friend requests and friends
  section(`📨 ${t("Friend requests")}`, net.friends.incoming.map(f => personRow({ ...f, status: null }, [
    [t("Accept"), () => sendNet({ t: "friendAnswer", name: f.name, yes: true }), true],
    [t("No thanks"), () => sendNet({ t: "friendAnswer", name: f.name, yes: false })],
  ])));
  const friends = [...net.friends.list].sort((a, b) => b.online - a.online);
  L.append(el("h3", null, `👫 ${t("Friends")} (${friends.length})`));
  if (!friends.length) L.append(el("p", "muted", t("No friends yet. Tap “Add friend” next to someone, or find a friend by their online name.")));
  friends.forEach(f => L.append(personRow(f)));
  // Battles happening right now, and everyone online
  section(`👀 ${t("Battles right now")}`, net.matches.map(m => {
    const row = el("div", "person"), who = el("div", "foe-who"), b = el("div", "foe-buttons");
    who.append(el("strong", null, `${m.a} ⚔️ ${m.b}`));
    const w = el("button", "btn small", `👀 ${t("Watch")}`); w.type = "button"; w.onclick = () => sendNet({ t: "watch", match: m.match });
    b.append(w); row.append(who, b); return row;
  }));
  section(`🟢 ${t("Players online")}`, net.players.filter(p => !net.friends.list.some(f => f.name === p.name)).map(p => personRow(p)));
}

// ---------- battles (as a player, or watching) ----------
// state (from the server) = { players: [{ name, look, bot }], teams: [[fighter]], now: [i, j], turn, seq, event, winner, deadline }
function onMatch(m) {
  const first = !net.match || net.match.id !== m.match;
  if (first) net.match = { id: m.match, you: m.you, how: m.how, ended: null };
  Object.assign(net.match, { state: m.state, got: Date.now() });   // keep the same object: the screen's parts (ui) live on it
  net.waiting = null;
  if (first || net.view !== "battle") { net.view = "battle"; showView(); }
  else drawOnline();
}

function showBattleView() {
  const mt = net.match, s = mt.state, you = mt.you;
  const ui = mt.ui = { field: el("div", "battle-field"), log: el("p", "battle-log"), whose: el("p", "battle-whose"), moves: el("div", "battle-moves") };
  ui.log.setAttribute("aria-live", "polite");
  const vs = `${s.players[0].look} ${s.players[0].name} ⚔️ ${s.players[1].look} ${s.players[1].name}`;
  const head = el("h2", null, you < 0 ? `👀 ${t("Watching")}: ${vs}` : `🌐 ${t("Battle vs {name}", { name: `${s.players[1 - you].look} ${s.players[1 - you].name}` })}`);
  if (you >= 0) {
    const btn = (kind, cls) => { const b = el("button", "btn" + (cls ? " " + cls : ""), ""); b.type = "button"; b.onclick = () => { if (net.match !== mt) return; mt.waiting = true; drawOnline(); sendNet({ t: "move", kind }); }; ui.moves.append(b); return b; };
    ui.tackle = btn("tackle", "primary"); ui.special = btn("special"); ui.swap = btn("switch");
  }
  const back = you < 0 ? [["Stop watching", false]] : [["Give up", false]];
  openPopup([head, ui.whose, ui.field, ui.log, ui.moves], back);
  popupDone = () => {
    if (net.match?.ended) return backToLobby();
    sendNet({ t: you < 0 ? "unwatch" : "forfeit" });
    if (you < 0) backToLobby();
  };
  sound("click");
  drawOnline();
  ui.tackle?.focus();
}
function backToLobby() {
  net.match = null;
  if (!net.ws) return;
  net.view = "lobby"; showView();
}

// The battle's last move, in words (each player's game shows it in their own language)
function eventText(s) {
  const e = s.event, P = s.players;
  if (!e) return "";
  if (e.kind === "start") return t("{a} vs {b}! {first} goes first.", { a: P[0].name, b: P[1].name, first: P[e.first].name });
  const me = P[e.by], foe = P[1 - e.by], mine = s.teams[e.by], theirs = s.teams[1 - e.by];
  if (e.kind === "switch") return t("{name} sends out {bug}!", { name: me.name, bug: commonName(mine[e.to].species) });
  // The attacker is still out (a bug only changes when it faints or switches)
  const a = mine[s.now[e.by]], who = t("{owner}'s {bug}", { owner: me.name, bug: commonName(a.species) });
  const move = t(e.kind === "special" ? specialMove(a) : "Tackle");
  if (!e.hit) return t("{who} used {move}… but missed!", { who, move });
  let text = `${t("{who} used {move}! It did {dmg} damage.", { who, move, dmg: e.dmg })}${e.boost > 1 ? ` ${t("It's super effective!")}` : e.boost < 1 ? ` ${t("It's not very effective…")}` : ""}`;
  if (e.fainted) {
    text += ` ${t("{owner}'s {bug} fainted!", { owner: foe.name, bug: commonName(theirs[e.out ?? s.now[1 - e.by]].species) })}`;
    if (e.next != null) text += ` ${t("{name} sends out {bug}!", { name: foe.name, bug: commonName(theirs[e.next].species) })}`;
  }
  return text;
}

function drawOnline() {
  const mt = net.match, ui = mt?.ui;
  if (!ui || net.view !== "battle") return;
  const s = mt.state, you = mt.you, me = you < 0 ? 1 : you, other = 1 - me;
  if (mt.lastSeq !== s.seq) { mt.waiting = false; mt.lastSeq = s.seq; mt.fresh = true; }
  const side = (i, cls) => {
    const pl = s.players[i], team = s.teams[i], f = team[s.now[i]], box = el("div", `fighter ${cls}${f.hp <= 0 ? " fainted" : ""}`);
    const hp = el("div", "track"), fill = el("div", "fill" + (f.hp / f.max < 0.3 ? " low" : ""));
    fill.style.width = `${f.hp / f.max * 100}%`; hp.append(fill);
    const left = team.filter(x => x.hp > 0).length;
    box.append(el("span", "muted", `${pl.look} ${pl.name}${pl.bot ? ` (${t("bot")})` : ""}`), el("span", "bug-emoji", SPECIES_FACTS[f.species].emoji),
      el("strong", null, `${commonName(f.species)}${f.level > 1 ? ` · ${t("Lv {lv}", { lv: f.level })}` : ""}`),
      el("span", "type-tag", t(TYPES[SPECIES_FACTS[f.species].group])),
      hp, el("span", "hp", `HP ${f.hp}/${f.max} · ${t(team.length === 1 ? "{n} of {total} bug left" : "{n} of {total} bugs left", { n: left, total: team.length })}`));
    return box;
  };
  ui.field.innerHTML = "";
  ui.field.append(side(other, "them"), side(me, "you"));
  const e = s.event;
  if (mt.fresh && e && (e.kind === "tackle" || e.kind === "special")) {   // the attack animation, once per move
    const target = 1 - e.by === me ? "you" : "them", hit = ui.field.querySelector(`.fighter.${target}`);
    ui.field.querySelector(`.fighter.${target === "you" ? "them" : "you"}`).classList.add(target === "you" ? "lunge-down" : "lunge-up");
    if (e.hit) { hit.classList.add("shake"); sound("hit"); }
    hit.append(el("span", "dmg" + (e.hit ? "" : " miss"), e.hit ? `-${e.dmg}` : t("Miss!")));
  }
  mt.fresh = false;
  ui.log.textContent = eventText(s);
  const myTurn = you >= 0 && s.turn === you && s.winner == null && !mt.waiting && !mt.ended;
  const secs = Math.max(0, Math.round((s.deadline - (Date.now() - mt.got)) / 1000));
  ui.whose.textContent = s.winner != null || mt.ended ? "" : you < 0 ? t("{name}'s turn", { name: s.players[s.turn].name })
    : myTurn ? `👉 ${t("Your turn!")} ⏱ ${secs}s` : t("Waiting for {name}…", { name: s.players[other].name });
  if (you >= 0) {
    const mine = s.teams[you], f = mine[s.now[you]];
    ui.special.textContent = t("{move} (strong, can miss)", { move: t(specialMove(f)) });
    ui.tackle.textContent = t("Tackle"); ui.swap.textContent = t("Switch bug");
    ui.tackle.disabled = ui.special.disabled = !myTurn;
    const n = nextAlive(mine, s.now[you]);
    ui.swap.disabled = !myTurn || n < 0 || n === s.now[you];
  }
  clearTimeout(mt.timer);
  if (myTurn) mt.timer = setTimeout(drawOnline, 1000);   // the countdown
}

function onMatchEnd(m) {
  const mt = net.match;
  if (!mt || mt.id !== m.match || mt.ended) return;
  mt.ended = m;
  drawOnline();
  setTimeout(() => {
    if (net.match !== mt) return;
    const P = m.players, won = m.you === m.winner, lines = [];
    let title;
    if (m.you < 0) title = t("{name} won the battle!", { name: P[m.winner].name });
    else if (won) {
      const g = loadGame();
      g.wins++; addPoints(g, ONLINE_WIN_POINTS);
      lines.push(...progress(g, { type: "win", pts: ONLINE_WIN_POINTS }));
      checkUnlocks(g); saveGame(g); renderGame();
      if (net.me) net.me.wins++;
      confetti();
      title = m.why === "left" || m.why === "gave up" ? t("{name} left, so you win! +{pts} points", { name: P[1 - m.you].name, pts: ONLINE_WIN_POINTS })
        : t("You beat {name}! +{pts} points", { name: P[1 - m.you].name, pts: ONLINE_WIN_POINTS });
    } else title = m.why === "gave up" ? t("You gave up this battle.") : m.why === "paused" ? t("The battle stopped.") : t("{name} won this time. Good game!", { name: P[m.winner].name });
    if (m.you >= 0) sound(won ? "win" : "lose");
    openPopup([el("h2", null, title), ...lines.map(l => el("p", "new-badge", l))], [["Back to the lobby", true]]);
    popupDone = backToLobby;
  }, 1200);
}

// game.js drew the Battles page before this file loaded: draw it again with the new rows
renderGame();
