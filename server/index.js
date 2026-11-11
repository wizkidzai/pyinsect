// Innvadex game server (Cloudflare Worker + one Durable Object, free plan).
// The online lobby for the Innvadex game (assets/game-online.js): who's online, matchmaking,
// challenges by name, room codes, friends, live battles, and watching battles. About 20 bots live
// here too, so there's always someone to battle (they say yes to every challenge and friend request).
//
// The server rolls the dice in every online battle, so both players always see the same thing and
// nobody can change the result. Battle rules are the same as in assets/game.js (trainer battles).
// Players get a made-up name (like "BraveBeetle42"). There's no chat. Only names, avatars, and bugs
// are shared. Nothing about the real person is stored.
//
// Deploy: see server/README.md (it needs Wrangler, because Durable Objects can't be made in the
// Cloudflare dashboard). Free plan limits: 100,000 requests a day; past that it stops until tomorrow.

import { DurableObject } from "cloudflare:workers";

const VERSION = 1;
// Websites allowed to connect (the game's site, and your own computer for testing)
const SITE_ORIGINS = ["https://wizkidzai.github.io", "https://edafawd.github.io"];
const LOCAL_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

// ---------- the battle rules (the same as assets/game.js) ----------
// Every bug in the game: [rarity, group]. Must match SPECIES_FACTS in assets/game.js.
const SPECIES = {
  agrilus_planipennis: ["legendary", "beetle"], anoplophora_glabripennis: ["legendary", "beetle"],
  lycorma_delicatula: ["legendary", "bug"], vespa_mandarinia: ["legendary", "wasp"],
  adelges_piceae: ["rare", "bug"], coptotermes_formosanus: ["rare", "termite"], lymantria_dispar: ["rare", "moth"],
  popillia_japonica: ["rare", "beetle"], solenopsis_invicta: ["rare", "ant"], xyleborus_monographus: ["rare", "beetle"],
  anisandrus_dispar: ["common", "beetle"], exomala_orientalis: ["common", "beetle"], halyomorpha_halys: ["common", "bug"],
  harmonia_axyridis: ["common", "beetle"], linepithema_humile: ["common", "ant"], macrodactylus_subspinosus: ["common", "beetle"],
  pieris_rapae: ["common", "moth"], ips_typographus: ["rare", "beetle"], lymantria_monacha: ["rare", "moth"],
  cydalima_perspectalis: ["rare", "moth"], operophtera_brumata: ["common", "moth"], scolytus_multistriatus: ["common", "beetle"],
  drosophila_melanogaster_suzukii: ["common", "fly"], polistes_dominula: ["common", "wasp"],
};
const STATS = { common: { hp: 30, atk: 8 }, rare: { hp: 38, atk: 10 }, legendary: { hp: 46, atk: 12 } };
const LEVEL_BONUS = { hp: 6, atk: 2 }, MAX_LEVEL = 3, TEAM_SIZE = 6, SPECIAL_HIT_CHANCE = 0.7;
const STRONG_AGAINST = {
  wasp: ["moth", "bug", "fly"], ant: ["termite", "moth"], beetle: ["ant", "wasp"],
  bug: ["beetle"], termite: ["bug"], moth: ["termite"], fly: ["beetle"],
};
const typeBoost = (a, d) => {
  const ga = SPECIES[a][1], gd = SPECIES[d][1];
  return STRONG_AGAINST[ga]?.includes(gd) ? 1.5 : STRONG_AGAINST[gd]?.includes(ga) ? 0.67 : 1;
};
const fighter = (species, level, cheer = 0) => {
  const base = STATS[SPECIES[species][0]], hp = base.hp + (level - 1) * LEVEL_BONUS.hp;
  return { species, level, hp, max: hp, atk: base.atk + (level - 1) * LEVEL_BONUS.atk + cheer };
};
const nextAlive = (team, from) => { for (let i = 1; i <= team.length; i++) { const j = (from + i) % team.length; if (team[j].hp > 0) return j; } return -1; };
const nextHealthiest = (team, now) => team.reduce((best, f, i) => i !== now && f.hp > 0 && (best < 0 || f.hp > team[best].hp) ? i : best, -1);

// How a bot picks its move (like foeMove in game.js): 1 = random, 2 = smart, 3 = smart and switches when hurt
function botMove(level, team, now, target) {
  const f = team[now];
  if (level <= 1) return Math.random() < 0.5 ? "special" : "tackle";
  if (target.hp <= f.atk - 2) return "tackle";
  if (level >= 3 && f.hp / f.max < 0.25) {
    const other = nextHealthiest(team, now);
    if (other >= 0 && team[other].hp / team[other].max > 0.5 && Math.random() < 0.7) return "switch";
  }
  return "special";
}

// ---------- names ----------
const ADJECTIVES = ["Brave", "Swift", "Sunny", "Clever", "Mighty", "Happy", "Speedy", "Jolly", "Lucky", "Bold",
  "Cosmic", "Shiny", "Turbo", "Gentle", "Fuzzy", "Zippy", "Quiet", "Daring", "Bright", "Super"];
const NOUNS = ["Beetle", "Hornet", "Firefly", "Cricket", "Ladybug", "Mantis", "Moth", "Ant", "Bee", "Dragonfly",
  "Weevil", "Katydid", "Cicada", "Butterfly", "Grasshopper"];
const AVATARS = ["🦊", "🐸", "🐼", "🐯", "🦉", "🐢", "🐙", "🦄", "🐨", "🐵", "🦁", "🐰"];
const pick = list => list[Math.floor(Math.random() * list.length)];
const randomName = () => `${pick(ADJECTIVES)}${pick(NOUNS)}${1 + Math.floor(Math.random() * 99)}`;
const NAME_RE = /^[A-Z][a-z]+[A-Z][a-z]+\d{1,2}$/;

// ---------- bots ----------
const BOT_COUNT = 20;
const FORESTS = ["Mt. Hood", "Tillamook", "the Columbia Gorge", "Crater Lake", "the Wallowas", "Malheur", "Silver Falls", "the Siskiyous"];
const MAX_BOT_BATTLES = 3;          // battles between bots at the same time (for watching)
const BOT_THINK_MS = [1200, 2600];  // how long a bot "thinks" before a move
const MOVE_TIME_MS = 45000;         // a player who doesn't move in time does a Tackle
const BOT_MATCH_WAIT_MS = 8000;     // "Find a match": a bot steps in if no player turns up
const ROOM_LETTERS = "ABCDEFGHJKMNPQRTUVWXY";
const TICK_MS = 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url), origin = request.headers.get("Origin") || "";
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
      if (!SITE_ORIGINS.includes(origin) && !LOCAL_ORIGIN.test(origin)) return new Response("Not allowed", { status: 403 });
      return env.LOBBY.get(env.LOBBY.idFromName("main")).fetch(request);
    }
    return Response.json({ ok: true, service: "innvadex-server", version: VERSION }, { headers: { "Access-Control-Allow-Origin": "*" } });
  },
};

export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, name TEXT UNIQUE, look TEXT, bot INTEGER DEFAULT 0,
      level INTEGER DEFAULT 2, team TEXT, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, created INTEGER, seen INTEGER)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS friends (a TEXT, b TEXT, state TEXT, PRIMARY KEY (a, b))`);   // a→b: "asked" or "friends"
    this.conns = new Map();      // player id → { ws, card, offers }
    this.status = new Map();     // player id → { kind: "lobby" | "queue" | "battle" | "catching" | "room", ... }
    this.queue = [];             // [{ id, since }] waiting for "Find a match"
    this.rooms = new Map();      // code → host id
    this.matches = new Map();    // match id → match
    this.challenges = new Map(); // target id → Set of challenger ids
    this.botUntil = new Map();   // bot id → when it does something else
    this.ticker = null;
    // Players and bots are kept in memory too: the free plan allows 5 million database reads a day,
    // and the clock looks at the bots every second
    this.cache = new Map(); this.botList = null;
    this.makeBots();
  }

  // ---------- players ----------
  player(id) {
    if (!this.cache.has(id)) { const p = this.sql.exec("SELECT * FROM players WHERE id = ?", id).toArray()[0]; if (!p) return null; this.cache.set(id, p); }
    return this.cache.get(id);
  }
  changed(id) { this.cache.delete(id); if (id.startsWith("bot:")) this.botList = null; }
  byName(name) { return typeof name === "string" ? this.sql.exec("SELECT * FROM players WHERE name = ? COLLATE NOCASE", name.trim()).toArray()[0] || null : null; }
  makeBots() {
    const have = this.sql.exec("SELECT COUNT(*) AS n FROM players WHERE bot = 1").one().n;
    const all = Object.keys(SPECIES);
    for (let i = have; i < BOT_COUNT; i++) {
      let name; do name = randomName(); while (this.byName(name));
      const size = 2 + Math.floor(Math.random() * 5), level = 1 + (i % 3), bugLv = 1 + Math.floor(Math.random() * MAX_LEVEL);
      const team = [...all].sort(() => Math.random() - 0.5).slice(0, size).map(s => [s, bugLv]);
      this.sql.exec("INSERT INTO players (id, name, look, bot, level, team, created, seen) VALUES (?, ?, ?, 1, ?, ?, ?, ?)",
        `bot:${i}`, name, pick(AVATARS), level, JSON.stringify(team), Date.now(), Date.now());
    }
  }
  bots() { return this.botList || (this.botList = this.sql.exec("SELECT * FROM players WHERE bot = 1").toArray()); }
  isOnline(p) { return p.bot ? true : this.conns.has(p.id); }
  statusOf(p) {
    if (!this.isOnline(p)) return { kind: "offline" };
    const s = this.status.get(p.id) || { kind: "lobby" };
    if (s.kind !== "battle") return s;
    const m = this.matches.get(s.match), other = m && m.ids[1 - m.ids.indexOf(p.id)];
    return { kind: "battle", match: s.match, vs: other ? this.player(other)?.name : "?" };
  }
  pub(p) { return { name: p.name, look: p.look, bot: !!p.bot, online: this.isOnline(p), wins: p.wins, status: this.statusOf(p) }; }
  teamOf(id) {
    const p = this.player(id);
    if (p?.bot) return JSON.parse(p.team).map(([s, lv]) => fighter(s, lv));
    const card = this.conns.get(id)?.card;
    return card ? card.team.map(([s, lv]) => fighter(s, lv, card.cheer)) : [];
  }

  // ---------- connections ----------
  async fetch(request) {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const conn = { ws: server, id: null, budget: 30, last: Date.now() };
    server.addEventListener("message", e => this.onMessage(conn, e.data));
    server.addEventListener("close", () => this.onClose(conn));
    server.addEventListener("error", () => this.onClose(conn));
    this.startTicker();
    return new Response(null, { status: 101, webSocket: client });
  }
  send(id, msg) { const c = this.conns.get(id); if (c) try { c.ws.send(JSON.stringify(msg)); } catch {} }
  reply(conn, msg) { try { conn.ws.send(JSON.stringify(msg)); } catch {} }

  async onMessage(conn, data) {
    // A little rate limit: about 10 messages a second, with short bursts allowed
    const now = Date.now();
    conn.budget = Math.min(30, conn.budget + (now - conn.last) / 100); conn.last = now;
    if (conn.budget < 1 || typeof data !== "string" || data.length > 4000) return;
    conn.budget--;
    let m; try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== "object") return;
    if (m.t === "hello") return this.hello(conn, m);
    if (!conn.id || this.conns.get(conn.id) !== conn) return;
    const id = conn.id;
    if (m.t === "name") return this.chooseName(conn, m.name);
    const me = this.player(id);
    if (!me?.name) return;
    switch (m.t) {
      case "card": conn.card = checkCard(m) || conn.card; return;
      case "find": { const p = this.byName(m.name); return this.reply(conn, { t: "found", query: String(m.name || "").slice(0, 40), player: p && p.id !== id ? this.pub(p) : null }); }
      case "queue": return this.joinQueue(id);
      case "cancel": return this.cancel(id);
      case "room": return this.makeRoom(id);
      case "join": return this.joinRoom(id, m.code);
      case "challenge": return this.challenge(id, m.name);
      case "answer": return this.answer(id, m.name, !!m.yes);
      case "move": return this.move(id, m.kind);
      case "forfeit": return this.forfeit(id, "gave up");
      case "watch": return this.watch(id, m.match);
      case "unwatch": return this.unwatch(id);
      case "friend": return this.friend(id, m.name);
      case "friendAnswer": return this.friendAnswer(id, m.name, !!m.yes);
      case "unfriend": return this.unfriend(id, m.name);
      case "lobby": return this.sendLobby(id);
    }
  }

  async hello(conn, m) {
    if (conn.id || typeof m.secret !== "string" || !/^[0-9a-f]{32}$/.test(m.secret) || m.v !== VERSION) {
      return this.reply(conn, { t: "error", code: m.v !== VERSION ? "old" : "bad" });
    }
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(m.secret));
    const id = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    const old = this.conns.get(id);
    if (old && old !== conn) { this.reply(old, { t: "error", code: "elsewhere" }); try { old.ws.close(4000, "elsewhere"); } catch {} this.leave(id); }
    conn.id = id; conn.card = checkCard(m) || { look: "🙂", team: [], cheer: 0 };
    this.conns.set(id, conn);
    let p = this.player(id);
    if (!p) { this.sql.exec("INSERT INTO players (id, look, created, seen) VALUES (?, ?, ?, ?)", id, conn.card.look, Date.now(), Date.now()); p = this.player(id); }
    this.sql.exec("UPDATE players SET seen = ?, look = ? WHERE id = ?", Date.now(), conn.card.look, id);
    this.changed(id); p = this.player(id);
    if (!p.name) return this.offerNames(conn);
    this.welcome(id);
  }
  offerNames(conn) {
    const names = new Set();
    while (names.size < 4) { const n = randomName(); if (!this.byName(n)) names.add(n); }
    conn.offers = [...names];
    this.reply(conn, { t: "pickName", options: conn.offers });
  }
  chooseName(conn, name) {
    if (name === "more") return this.offerNames(conn);
    const p = this.player(conn.id);
    if (!p || p.name || !conn.offers?.includes(name) || !NAME_RE.test(name)) return;
    if (this.byName(name)) return this.offerNames(conn);
    this.sql.exec("UPDATE players SET name = ? WHERE id = ?", name, conn.id);
    this.changed(conn.id);
    this.welcome(conn.id);
  }
  welcome(id) {
    const p = this.player(id);
    this.status.set(id, { kind: "lobby" });
    this.send(id, { t: "welcome", me: { name: p.name, look: p.look, wins: p.wins, losses: p.losses } });
    this.sendFriends(id); this.sendLobby(id); this.friendsChanged(id);
  }
  onClose(conn) {
    if (!conn.id || this.conns.get(conn.id) !== conn) return;
    this.conns.delete(conn.id);
    this.leave(conn.id);
  }
  // A player went offline: end their battle, leave queues, rooms, and challenges
  leave(id) {
    const s = this.status.get(id);
    if (s?.kind === "battle") this.forfeit(id, "left");
    this.unwatch(id);
    this.cancel(id);
    this.challenges.delete(id);
    for (const set of this.challenges.values()) set.delete(id);
    this.status.delete(id);
    this.friendsChanged(id);
    this.lobbyChanged();
  }

  // ---------- the lobby list ----------
  sendLobby(id) {
    const humans = [...this.conns.keys()].filter(x => x !== id).map(x => this.player(x)).filter(p => p?.name);
    const list = [...humans.slice(0, 30), ...this.bots()].slice(0, 40).map(p => this.pub(p));
    const watching = [...this.matches.values()].filter(m => !m.over).map(m => ({ match: m.id, a: this.player(m.ids[0])?.name, b: this.player(m.ids[1])?.name }));
    this.send(id, { t: "lobby", players: list, online: humans.length + 1, matches: watching.slice(0, 10) });
  }
  lobbyChanged() { this.lobbyDirty = true; }   // sent on the next tick (at most once a second)

  // ---------- friends ----------
  friendRows(id) { return this.sql.exec("SELECT * FROM friends WHERE a = ? OR b = ?", id, id).toArray(); }
  sendFriends(id) {
    const rows = this.friendRows(id), list = [], incoming = [], outgoing = [];
    for (const r of rows) {
      const other = this.player(r.a === id ? r.b : r.a);
      if (!other) continue;
      if (r.state === "friends" && r.a === id) list.push(this.pub(other));
      else if (r.state === "asked") (r.b === id ? incoming : outgoing).push({ name: other.name, look: other.look });
    }
    this.send(id, { t: "friends", list, incoming, outgoing });
  }
  friendsChanged(id) { for (const r of this.friendRows(id)) { const o = r.a === id ? r.b : r.a; if (this.conns.has(o)) this.dirtyFriends.add(o); } }
  get dirtyFriends() { return this._df || (this._df = new Set()); }
  friend(id, name) {
    const p = this.byName(name);
    if (!p || p.id === id || !p.name) return this.send(id, { t: "info", code: "notFound", name: String(name || "").slice(0, 40) });
    const back = this.sql.exec("SELECT state FROM friends WHERE a = ? AND b = ?", p.id, id).toArray()[0];
    if (p.bot || back?.state === "asked") return this.makeFriends(id, p.id);   // bots always say yes
    if (this.sql.exec("SELECT state FROM friends WHERE a = ? AND b = ?", id, p.id).toArray()[0]) return this.sendFriends(id);
    this.sql.exec("INSERT INTO friends (a, b, state) VALUES (?, ?, 'asked')", id, p.id);
    this.sendFriends(id); this.sendFriends(p.id);
  }
  makeFriends(a, b) {
    this.sql.exec("INSERT OR REPLACE INTO friends (a, b, state) VALUES (?, ?, 'friends')", a, b);
    this.sql.exec("INSERT OR REPLACE INTO friends (a, b, state) VALUES (?, ?, 'friends')", b, a);
    this.sendFriends(a); this.sendFriends(b);
    const other = this.player(b);
    this.send(a, { t: "info", code: "friendAdded", name: other?.name });
  }
  friendAnswer(id, name, yes) {
    const p = this.byName(name);
    if (!p) return;
    const asked = this.sql.exec("SELECT state FROM friends WHERE a = ? AND b = ? AND state = 'asked'", p.id, id).toArray()[0];
    if (!asked) return;
    if (yes) return this.makeFriends(id, p.id);
    this.sql.exec("DELETE FROM friends WHERE a = ? AND b = ?", p.id, id);
    this.sendFriends(id); this.sendFriends(p.id);
  }
  unfriend(id, name) {
    const p = this.byName(name);
    if (!p) return;
    this.sql.exec("DELETE FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)", id, p.id, p.id, id);
    this.sendFriends(id); this.sendFriends(p.id);
  }

  // ---------- finding someone to battle ----------
  busy(id) { const s = this.status.get(id); return s && s.kind !== "lobby"; }
  canBattle(id) { return this.teamOf(id).length > 0; }
  joinQueue(id) {
    if (this.busy(id)) return;
    if (!this.canBattle(id)) return this.send(id, { t: "info", code: "noBugs" });
    const other = this.queue.find(q => q.id !== id);
    if (other) { this.queue = this.queue.filter(q => q !== other); return this.startMatch(other.id, id, "match"); }
    this.queue.push({ id, since: Date.now() });
    this.status.set(id, { kind: "queue" });
    this.send(id, { t: "queued" });
    this.friendsChanged(id);
  }
  cancel(id) {
    const s = this.status.get(id);
    this.queue = this.queue.filter(q => q.id !== id);
    for (const [code, host] of this.rooms) if (host === id) this.rooms.delete(code);
    if (s && (s.kind === "queue" || s.kind === "room")) { this.status.set(id, { kind: "lobby" }); this.send(id, { t: "cancelled" }); this.friendsChanged(id); }
  }
  makeRoom(id) {
    if (this.busy(id)) return;
    if (!this.canBattle(id)) return this.send(id, { t: "info", code: "noBugs" });
    let code; do code = Array.from({ length: 4 }, () => pick([...ROOM_LETTERS])).join(""); while (this.rooms.has(code));
    this.rooms.set(code, id);
    this.status.set(id, { kind: "room" });
    this.send(id, { t: "room", code });
  }
  joinRoom(id, code) {
    code = String(code || "").toUpperCase().replace(/[^A-Z]/g, "");
    const host = this.rooms.get(code);
    if (!host || host === id || !this.conns.has(host)) return this.send(id, { t: "info", code: "noRoom" });
    if (this.busy(id)) return;
    if (!this.canBattle(id)) return this.send(id, { t: "info", code: "noBugs" });
    this.rooms.delete(code);
    this.startMatch(host, id, "room");
  }
  challenge(id, name) {
    const p = this.byName(name);
    if (!p || p.id === id) return this.send(id, { t: "info", code: "notFound", name: String(name || "").slice(0, 40) });
    if (this.busy(id)) return;
    if (!this.canBattle(id)) return this.send(id, { t: "info", code: "noBugs" });
    if (p.bot) {
      if (this.statusOf(p).kind === "battle") return this.send(id, { t: "info", code: "busy", name: p.name });
      return this.startMatch(p.id, id, "challenge");   // bots always say yes
    }
    if (!this.conns.has(p.id)) return this.send(id, { t: "info", code: "offline", name: p.name });
    if (this.busy(p.id)) return this.send(id, { t: "info", code: "busy", name: p.name });
    if (!this.challenges.has(p.id)) this.challenges.set(p.id, new Set());
    this.challenges.get(p.id).add(id);
    const me = this.player(id);
    this.send(p.id, { t: "challenged", name: me.name, look: me.look });
    this.send(id, { t: "info", code: "challengeSent", name: p.name });
  }
  answer(id, name, yes) {
    const p = this.byName(name);
    if (!p || !this.challenges.get(id)?.has(p.id)) return;
    this.challenges.get(id).delete(p.id);
    if (!yes) return this.send(p.id, { t: "info", code: "declined", name: this.player(id).name });
    if (!this.conns.has(p.id) || this.busy(p.id)) return this.send(id, { t: "info", code: "busy", name: p.name });
    if (this.busy(id)) return;
    this.startMatch(p.id, id, "challenge");
  }

  // ---------- battles ----------
  startMatch(a, b, how) {
    this.queue = this.queue.filter(q => q.id !== a && q.id !== b);
    for (const [code, host] of this.rooms) if (host === a || host === b) this.rooms.delete(code);
    const id = crypto.randomUUID().slice(0, 8), ids = [a, b];
    const teams = ids.map(x => this.teamOf(x).slice(0, TEAM_SIZE));
    if (!teams[0].length || !teams[1].length) return;
    const players = ids.map(x => { const p = this.player(x); return { name: p.name, look: p.look, bot: !!p.bot }; });
    const turn = Math.random() < 0.5 ? 0 : 1;
    const m = { id, ids, how, watchers: new Set(), over: false,
      state: { players, teams, now: [0, 0], turn, seq: 1, event: { kind: "start", first: turn }, winner: null, deadline: Date.now() + MOVE_TIME_MS } };
    this.matches.set(id, m);
    for (const x of ids) this.status.set(x, { kind: "battle", match: id });
    for (const x of ids) { this.unwatch(x); this.friendsChanged(x); }
    this.broadcast(m);
    this.planBot(m);
    this.lobbyChanged();
  }
  broadcast(m) {
    const st = { ...m.state, deadline: m.state.deadline - Date.now() };   // time left, not a clock time (clocks differ)
    m.ids.forEach((x, i) => this.send(x, { t: "match", match: m.id, you: i, how: m.how, state: st }));
    for (const w of m.watchers) this.send(w, { t: "match", match: m.id, you: -1, state: st });
  }
  move(id, kind) {
    const s = this.status.get(id), m = s?.kind === "battle" && this.matches.get(s.match);
    if (!m || m.over) return;
    this.play(m, m.ids.indexOf(id), kind);
  }
  // Player p (0 or 1) makes a move. The same steps as turn() and attack() in game.js.
  play(m, p, kind) {
    const s = m.state;
    if (s.winner != null || s.turn !== p || !["tackle", "special", "switch"].includes(kind)) return;
    const mine = s.teams[p], theirs = s.teams[1 - p];
    let ev;
    if (kind === "switch") {
      const n = nextAlive(mine, s.now[p]);
      if (n < 0 || n === s.now[p]) return;
      s.now[p] = n;
      ev = { kind: "switch", by: p, to: n };
    } else {
      const a = mine[s.now[p]], d = theirs[s.now[1 - p]], special = kind === "special";
      ev = { kind, by: p, hit: true };
      if (special && Math.random() > SPECIAL_HIT_CHANCE) ev.hit = false;
      else {
        const boost = typeBoost(a.species, d.species);
        const dmg = Math.max(1, Math.round((special ? a.atk * 1.8 + (Math.random() * 6 - 3) : a.atk + (Math.random() * 4 - 2)) * boost));
        d.hp = Math.max(0, d.hp - dmg);
        Object.assign(ev, { dmg, boost });
        if (d.hp <= 0) {
          ev.fainted = true; ev.out = s.now[1 - p];   // which bug fainted
          const n = nextAlive(theirs, s.now[1 - p]);
          if (n < 0) s.winner = p; else { s.now[1 - p] = n; ev.next = n; }
        }
      }
    }
    s.event = ev; s.seq++;
    if (s.winner == null) { s.turn = 1 - p; s.deadline = Date.now() + MOVE_TIME_MS; }
    this.broadcast(m);
    if (s.winner != null) this.endMatch(m, s.winner, "won");
    else this.planBot(m);
  }
  // If it's a bot's turn, it moves after "thinking" for a moment (see tick)
  planBot(m) {
    const who = m.state.turn, p = this.player(m.ids[who]);
    m.botAt = p?.bot ? Date.now() + BOT_THINK_MS[0] + Math.random() * (BOT_THINK_MS[1] - BOT_THINK_MS[0]) : null;
  }
  forfeit(id, why) {
    const s = this.status.get(id), m = s?.kind === "battle" && this.matches.get(s.match);
    if (!m || m.over) return;
    this.endMatch(m, 1 - m.ids.indexOf(id), why);
  }
  endMatch(m, winner, why) {
    if (m.over) return;
    m.over = true;
    m.state.winner = winner;
    const [w, l] = [m.ids[winner], m.ids[1 - winner]];
    this.sql.exec("UPDATE players SET wins = wins + 1 WHERE id = ?", w);
    this.sql.exec("UPDATE players SET losses = losses + 1 WHERE id = ?", l);
    this.changed(w); this.changed(l);
    const msg = { t: "matchEnd", match: m.id, winner, why, players: m.state.players };
    m.ids.forEach((x, i) => this.send(x, { ...msg, you: i }));
    for (const x of m.watchers) this.send(x, { ...msg, you: -1 });
    for (const x of [...m.ids, ...m.watchers]) {
      const st = this.status.get(x);
      if (st && (st.match === m.id)) this.status.set(x, { kind: "lobby" });
      this.friendsChanged(x);
    }
    for (const x of m.ids) if (this.player(x)?.bot) this.botUntil.set(x, Date.now() + 5000 + Math.random() * 10000);
    setTimeout(() => this.matches.delete(m.id), 60000);   // finished battles stay for a minute (late watchers see the end)
    this.lobbyChanged();
  }
  watch(id, matchId) {
    const m = this.matches.get(matchId);
    if (!m || m.ids.includes(id) || this.busy(id)) return;
    this.unwatch(id);
    m.watchers.add(id);
    this.status.set(id, { kind: "watching", match: m.id, a: m.state.players[0].name, b: m.state.players[1].name });
    this.send(id, { t: "match", match: m.id, you: -1, state: { ...m.state, deadline: m.state.deadline - Date.now() } });
    if (m.over) this.send(id, { t: "matchEnd", match: m.id, winner: m.state.winner, why: "won", players: m.state.players, you: -1 });
    this.friendsChanged(id);
  }
  unwatch(id) {
    const s = this.status.get(id);
    for (const m of this.matches.values()) m.watchers.delete(id);
    if (s?.kind === "watching") { this.status.set(id, { kind: "lobby" }); this.friendsChanged(id); }
  }

  // ---------- the clock: bots, time limits, matchmaking, and sending lists ----------
  startTicker() {
    if (this.ticker) return;
    this.ticker = setInterval(() => this.tick(), TICK_MS);
  }
  tick() {
    const now = Date.now();
    // Nobody here: stop, so the server can rest (it's free while it rests)
    if (!this.conns.size) {
      clearInterval(this.ticker); this.ticker = null;
      for (const m of this.matches.values()) if (!m.over) this.endMatch(m, 0, "paused");
      return;
    }
    for (const m of this.matches.values()) {
      if (m.over) continue;
      const s = m.state, who = m.ids[s.turn];
      if (m.botAt && now >= m.botAt) {
        m.botAt = null;
        const bot = this.player(who);
        this.play(m, s.turn, botMove(bot.level, s.teams[s.turn], s.now[s.turn], s.teams[1 - s.turn][s.now[1 - s.turn]]));
      } else if (!m.botAt && now > s.deadline) {
        this.play(m, s.turn, "tackle");   // too slow: an automatic Tackle
      }
    }
    // "Find a match": nobody else came, so a free bot steps in
    for (const q of [...this.queue]) {
      if (now - q.since < BOT_MATCH_WAIT_MS) continue;
      const free = this.bots().filter(b => this.statusOf(b).kind !== "battle");
      if (free.length) this.startMatch(pick(free).id, q.id, "match");
    }
    this.botLife(now);
    if (this.lobbyDirty) { this.lobbyDirty = false; for (const id of this.conns.keys()) this.sendLobby(id); }
    for (const id of this.dirtyFriends) this.sendFriends(id);
    this.dirtyFriends.clear();
  }
  // Bots wander around: hang out in the lobby, catch bugs in a forest, or battle each other
  botLife(now) {
    const bots = this.bots();
    const battling = [...this.matches.values()].filter(m => !m.over && m.ids.every(x => x.startsWith("bot:"))).length;
    for (const b of bots) {
      if (this.statusOf(b).kind === "battle" || (this.botUntil.get(b.id) || 0) > now) continue;
      const r = Math.random();
      const idle = bots.filter(o => o.id !== b.id && this.statusOf(o).kind !== "battle" && (this.botUntil.get(o.id) || 0) <= now);
      if (r < 0.25 && battling < MAX_BOT_BATTLES && idle.length) {
        this.startMatch(b.id, pick(idle).id, "bots");
        continue;
      }
      if (r < 0.6) this.status.set(b.id, { kind: "catching", where: pick(FORESTS) });
      else this.status.set(b.id, { kind: "lobby" });
      this.botUntil.set(b.id, now + 15000 + Math.random() * 45000);
      this.friendsChanged(b.id);
      this.lobbyChanged();
    }
  }
}

// A player's side, checked (it comes from their device): an avatar, up to 6 real bugs, levels 1-3
function checkCard(m) {
  if (!m || !Array.isArray(m.team)) return null;
  const team = m.team.slice(0, TEAM_SIZE)
    .filter(f => Array.isArray(f) && SPECIES[f[0]] && Number.isInteger(f[1]) && f[1] >= 1 && f[1] <= MAX_LEVEL);
  return { look: typeof m.look === "string" && [...m.look].length <= 4 ? m.look : "🙂", team, cheer: Math.max(0, Math.min(2, Number(m.cheer) || 0)) };
}
