// Innvadex battles against other players (live, online) and quick battles against a bot
// (see "Innvadex: live online battles and quick bot battles" in requirements.md).
// It uses the game's own pieces from assets/game.js (fighters, moves, damage, pop-ups, points),
// so the rules are the same as in the trainer battles.
//
// Online battles: one player makes a room and gets a 4-letter code, the other joins with the code.
// The two devices talk straight to each other (WebRTC). PeerJS's free public server only helps them
// find each other; no account is needed. The room maker's device ("host") decides everything:
// the dice rolls and the damage. It sends the whole battle ("state") to the other device after
// every move, so both screens always show the same thing. Only nicknames, avatars, and bugs are
// shared. There's no chat.

const PEERJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js";
const ROOM_PREFIX = "wizkidzai-innvadex-";        // PeerJS ids are shared by everyone, so ours get a prefix
const ROOM_LETTERS = "ABCDEFGHJKMNPQRTUVWXY";     // no I/L/O/S/Z: easy to read out loud
const ONLINE_WIN_POINTS = 15;
const PROTOCOL = 1;                                // both devices must speak the same version

// ---------- quick battles against a bot ----------
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
  row("🌐", t("Battle a friend online"), t("Live, both online at the same time. Make a room and share its code."),
    [[t("Make a room"), hostRoom, true], [t("Join a room"), joinRoom, false]]);
  row("🤖", t("Battle a bot"), t("A quick battle any time. Pick how hard."),
    BOT_LEVELS.map(b => [`${"⭐".repeat(b.level)} ${t(b.name)}`, () => battle(botFoe(loadGame(), b), false), b.level === 2]));
}

// ---------- online: connecting ----------
let online = null;   // the room we're in: { peer, conn, host, code, ... } (one at a time)

function loadPeerJS() {
  if (window.Peer) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = PEERJS_URL; s.onload = ok; s.onerror = () => fail(new Error(t("Couldn't load the online battle tools. Check your internet.")));
    document.head.append(s);
  });
}

// Your side for the other player: nickname, avatar, and team (species and levels only)
function myCard() {
  const g = loadGame();
  return { name: (g.trainer.name || t("Player")).slice(0, 20), look: trainerLook(g) || "🙂",
    cheer: buddyBoost(g), team: myTeam(g).map(f => ({ species: f.species, level: f.level })) };
}

// The other player's card, checked (it comes from another device): only real bugs and levels
function checkCard(c) {
  if (!c || typeof c !== "object" || !Array.isArray(c.team)) return null;
  const team = c.team.slice(0, TEAM_SIZE).filter(f => f && SPECIES_FACTS[f.species] && Number.isInteger(f.level) && f.level >= 1 && f.level <= MAX_LEVEL);
  if (!team.length) return null;
  return { name: String(c.name || t("Player")).slice(0, 20), look: String(c.look || "🙂").slice(0, 8),
    cheer: Math.max(0, Math.min(2, Number(c.cheer) || 0)), team };
}

function leaveRoom() {
  const o = online; online = null;
  if (!o) return;
  o.closing = true;
  try { o.conn?.close(); } catch {}
  try { o.peer?.destroy(); } catch {}
}

// A small "waiting" pop-up while connecting. Closing it leaves the room.
function waitingPopup(title, lines) {
  openPopup([el("h2", null, title), ...lines], [["Cancel", false]]);
  popupDone = leaveRoom;
}

async function hostRoom() {
  leaveRoom();
  const status = el("p", "muted", t("Making a room…"));
  waitingPopup(`🌐 ${t("Your room")}`, [status]);
  const room = online = { host: true };
  try { await loadPeerJS(); } catch (e) { status.textContent = e.message; return; }
  if (online !== room) return;
  const tryCode = () => {
    room.code = Array.from({ length: 4 }, () => ROOM_LETTERS[Math.floor(Math.random() * ROOM_LETTERS.length)]).join("");
    room.peer = new Peer(ROOM_PREFIX + room.code);
    room.peer.on("open", () => {
      if (online !== room) return;
      status.replaceWith(el("p", null, t("Tell your friend this code:")), el("p", "room-code", room.code),
        el("p", "muted", t("Waiting for your friend to join…")));
    });
    room.peer.on("error", e => {
      if (online !== room) return;
      if (e.type === "unavailable-id") { room.peer.destroy(); return tryCode(); }   // someone has that code: pick another
      status.textContent = t("Something went wrong: {err}", { err: e.type || e.message });
    });
    room.peer.on("connection", conn => {
      if (room.conn || online !== room) { conn.on("open", () => conn.close()); return; }   // the room is full
      room.conn = conn;
      listen(room);
    });
  };
  tryCode();
}

function joinRoom() {
  leaveRoom();
  const input = el("input", "room-input");
  input.maxLength = 4; input.autocomplete = "off"; input.autocapitalize = "characters"; input.spellcheck = false;
  input.placeholder = "ABCD"; input.setAttribute("aria-label", t("Room code"));
  const status = el("p", "muted", "");
  const go = el("button", "btn primary", t("Join"));
  go.type = "button";
  const join = async () => {
    const code = input.value.toUpperCase().replace(/[^A-Z]/g, "");
    if (code.length !== 4) { status.textContent = t("Type the 4-letter code."); return; }
    leaveRoom();
    const room = online = { host: false, code };
    go.disabled = true; status.textContent = t("Joining…");
    try { await loadPeerJS(); } catch (e) { status.textContent = e.message; go.disabled = false; return; }
    if (online !== room) return;
    room.peer = new Peer();
    room.peer.on("open", () => {
      if (online !== room) return;
      room.conn = room.peer.connect(ROOM_PREFIX + code, { reliable: true });
      listen(room);
    });
    room.peer.on("error", e => {
      if (online !== room) return;
      go.disabled = false;
      status.textContent = e.type === "peer-unavailable" ? t("No room with that code. Check it and try again.") : t("Something went wrong: {err}", { err: e.type || e.message });
    });
  };
  go.onclick = join;
  input.onkeydown = e => { if (e.key === "Enter") join(); };
  const box = el("div", "room-join"); box.append(input, go);
  openPopup([el("h2", null, `🌐 ${t("Join a room")}`), el("p", null, t("Type the code your friend sees:")), box, status], [["Cancel", false]]);
  popupDone = leaveRoom;
  input.focus();
}

// Messages between the two devices:
//   guest → host: { t: "hello", v, card }   then { t: "move", kind }
//   host → guest: { t: "state", state }      (after every change)
//   either way:   { t: "full" } (the room already has 2 players), { t: "old" } (different versions)
function listen(room) {
  const conn = room.conn;
  conn.on("open", () => { if (!room.host) conn.send({ t: "hello", v: PROTOCOL, card: myCard() }); });
  conn.on("data", msg => {
    if (online !== room || !msg || typeof msg !== "object") return;
    if (room.host && msg.t === "hello") {
      if (msg.v !== PROTOCOL) { conn.send({ t: "old" }); return; }
      const them = checkCard(msg.card);
      if (!them || room.state) return;
      room.state = startState(myCard(), them);
      sendState(room);
      showBattle(room);
    } else if (room.host && msg.t === "move") {
      if (!room.state) return;
      play(room, 1, msg.kind);
    } else if (!room.host && msg.t === "state") {
      const first = !room.state;
      room.state = msg.state;
      if (first) showBattle(room); else drawBattle(room);
    } else if (msg.t === "old") {
      endWith(room, t("Your friend has a different version of the game. Both reload the page and try again."));
    }
  });
  conn.on("close", () => {
    if (online !== room || room.closing) return;
    if (room.state && room.state.winner == null) endWith(room, t("{name} left the battle.", { name: otherName(room) }));
    else if (!room.state) endWith(room, t("The connection closed. Try again."));
  });
  conn.on("error", () => { if (online === room && !room.state) endWith(room, t("Couldn't connect. Try again.")); });
}

// ---------- online: the battle (same rules as the trainer battles in game.js) ----------
// state = { players: [host, guest], now: [i, j] (whose bug is out), turn: 0 | 1, log, fx, winner: null | 0 | 1 }
function startState(hostCard, guestCard) {
  const side = c => ({ name: c.name, look: c.look,
    team: c.team.map(f => { const x = fighter(f.species, f.level); x.atk += c.cheer; return x; }) });
  const players = [side(hostCard), side(guestCard)], turn = Math.random() < 0.5 ? 0 : 1;
  return { players, now: [0, 0], turn, fx: null, winner: null,
    log: t("{a} vs {b}! {first} goes first.", { a: players[0].name, b: players[1].name, first: players[turn].name }) };
}

// Player p (0 = host, 1 = guest) picks a move. Only the host runs this.
function play(room, p, kind) {
  const s = room.state;
  if (!s || s.winner != null || s.turn !== p || !["tackle", "special", "switch"].includes(kind)) return;
  const me = s.players[p], foe = s.players[1 - p];
  if (kind === "switch") {
    const n = nextAlive(me.team, s.now[p]);
    if (n < 0 || n === s.now[p]) return;
    s.now[p] = n; s.fx = null;
    s.log = t("{name} sends out {bug}!", { name: me.name, bug: commonName(me.team[n].species) });
  } else {
    const a = me.team[s.now[p]], d = foe.team[s.now[1 - p]], special = kind === "special";
    const move = t(special ? specialMove(a) : "Tackle"), who = t("{owner}'s {bug}", { owner: me.name, bug: commonName(a.species) });
    if (special && Math.random() > SPECIAL_HIT_CHANCE) {
      s.fx = { target: 1 - p, text: t("Miss!"), hit: false };
      s.log = t("{who} used {move}… but missed!", { who, move });
    } else {
      const boost = typeBoost(a.species, d.species);
      const dmg = Math.max(1, Math.round((special ? a.atk * 1.8 + (Math.random() * 6 - 3) : a.atk + (Math.random() * 4 - 2)) * boost * weatherBoost(a.species)));
      d.hp = Math.max(0, d.hp - dmg);
      s.fx = { target: 1 - p, text: `-${dmg}`, hit: true };
      s.log = `${t("{who} used {move}! It did {dmg} damage.", { who, move, dmg })}${boost > 1 ? ` ${t("It's super effective!")}` : boost < 1 ? ` ${t("It's not very effective…")}` : ""}`;
      if (d.hp <= 0) {
        s.log += ` ${t("{owner}'s {bug} fainted!", { owner: foe.name, bug: commonName(d.species) })}`;
        const n = nextAlive(foe.team, s.now[1 - p]);
        if (n < 0) s.winner = p;
        else { s.now[1 - p] = n; s.log += ` ${t("{name} sends out {bug}!", { name: foe.name, bug: commonName(foe.team[n].species) })}`; }
      }
    }
  }
  if (s.winner == null) s.turn = 1 - p;
  s.seq = (s.seq || 0) + 1;
  sendState(room);
  drawBattle(room);
}

function sendState(room) { try { room.conn.send({ t: "state", state: room.state }); } catch {} }
const myIndex = room => room.host ? 0 : 1;
const otherName = room => room.state?.players[1 - myIndex(room)].name || t("Your friend");

function showBattle(room) {
  const ui = room.ui = { field: el("div", "battle-field"), log: el("p", "battle-log"), whose: el("p", "battle-whose"), moves: el("div", "battle-moves") };
  ui.log.setAttribute("aria-live", "polite");
  const btn = (kind, cls) => { const b = el("button", "btn" + (cls ? " " + cls : ""), ""); b.type = "button"; b.onclick = () => choose(room, kind); ui.moves.append(b); return b; };
  ui.tackle = btn("tackle", "primary"); ui.special = btn("special"); ui.swap = btn("switch");
  const s = room.state, other = s.players[1 - myIndex(room)];
  openPopup([el("h2", null, `🌐 ${t("Battle vs {name}", { name: `${other.look} ${other.name}` })}`), ui.whose, ui.field, ui.log, ui.moves], [["Leave battle", false]]);
  popupDone = leaveRoom;
  sound("click");
  drawBattle(room);
  ui.tackle.focus();
}

function choose(room, kind) {
  const s = room.state;
  if (!s || s.winner != null || s.turn !== myIndex(room) || room.waiting) return;
  if (room.host) play(room, 0, kind);
  else { room.waiting = true; drawBattle(room); try { room.conn.send({ t: "move", kind }); } catch {} }
}

function drawBattle(room) {
  const s = room.state, ui = room.ui;
  if (!s || !ui) return;
  const me = myIndex(room), mine = s.players[me], theirs = s.players[1 - me];
  if (!room.host && room.lastSeq !== s.seq) room.waiting = false;   // the host answered our move
  room.lastSeq = s.seq;
  const side = (pl, i, cls) => {
    const f = pl.team[i], box = el("div", `fighter ${cls}${f.hp <= 0 ? " fainted" : ""}`);
    const hp = el("div", "track"), fill = el("div", "fill" + (f.hp / f.max < 0.3 ? " low" : ""));
    fill.style.width = `${f.hp / f.max * 100}%`; hp.append(fill);
    const left = pl.team.filter(x => x.hp > 0).length;
    box.append(el("span", "muted", `${pl.look} ${pl.name}`), el("span", "bug-emoji", SPECIES_FACTS[f.species].emoji),
      el("strong", null, `${commonName(f.species)}${f.level > 1 ? ` · ${t("Lv {lv}", { lv: f.level })}` : ""}`),
      el("span", "type-tag", t(TYPES[SPECIES_FACTS[f.species].group])),
      hp, el("span", "hp", `HP ${f.hp}/${f.max} · ${t(pl.team.length === 1 ? "{n} of {total} bug left" : "{n} of {total} bugs left", { n: left, total: pl.team.length })}`));
    return box;
  };
  ui.field.innerHTML = "";
  ui.field.append(side(theirs, s.now[1 - me], "them"), side(mine, s.now[me], "you"));
  if (s.fx && room.shownFx !== s.seq) {   // the attack animation, once per move
    room.shownFx = s.seq;
    const target = s.fx.target === me ? "you" : "them", hit = ui.field.querySelector(`.fighter.${target}`);
    ui.field.querySelector(`.fighter.${target === "you" ? "them" : "you"}`).classList.add(target === "you" ? "lunge-down" : "lunge-up");
    if (s.fx.hit) { hit.classList.add("shake"); sound("hit"); }
    hit.append(el("span", "dmg" + (s.fx.hit ? "" : " miss"), s.fx.text));
  }
  ui.log.textContent = s.log;
  const myTurn = s.turn === me && s.winner == null && !room.waiting;
  ui.whose.textContent = s.winner != null ? "" : myTurn ? `👉 ${t("Your turn!")}` : t("Waiting for {name}…", { name: theirs.name });
  ui.special.textContent = t("{move} (strong, can miss)", { move: t(specialMove(mine.team[s.now[me]])) });
  ui.tackle.textContent = t("Tackle"); ui.swap.textContent = t("Switch bug");
  ui.tackle.disabled = ui.special.disabled = !myTurn;
  const n = nextAlive(mine.team, s.now[me]);
  ui.swap.disabled = !myTurn || n < 0 || n === s.now[me];
  if (s.winner != null && !room.finished) finishOnline(room, s.winner === me);
}

// The end: the winner gets points (once), and the room closes
function finishOnline(room, won) {
  room.finished = true;
  setTimeout(() => {
    if (online !== room) return;
    const lines = [];
    if (won) {
      const g = loadGame();
      g.wins++; addPoints(g, ONLINE_WIN_POINTS);
      lines.push(...progress(g, { type: "win", pts: ONLINE_WIN_POINTS }));
      checkUnlocks(g); saveGame(g); renderGame();
      confetti();
    }
    sound(won ? "win" : "lose");
    leaveRoom();
    openPopup([el("h2", null, won ? t("You beat {name}! +{pts} points", { name: otherName(room), pts: ONLINE_WIN_POINTS }) : t("{name} won this time. Good game!", { name: otherName(room) })),
      ...lines.map(l => el("p", "new-badge", l))], [["OK", true]]);
  }, 1200);
}

// The battle or the connection ended early
function endWith(room, text) {
  if (online !== room) return;
  leaveRoom();
  openPopup([el("h2", null, `🌐 ${t("Online battle")}`), el("p", null, text)], [["OK", true]]);
}

// game.js drew the Battles page before this file loaded: draw it again with the new rows
renderGame();
