// Innvadex game server (Cloudflare Worker + one Durable Object, free plan).
// The online lobby for the Innvadex game (assets/game-online.js): who's online, matchmaking,
// challenges by name, room codes, friends, live battles, and watching battles. About 20 bots live
// here too, so there's always someone to battle (they say yes to every challenge and friend request).
//
// The server rolls the dice in every online battle, so both players always see the same thing and
// nobody can change the result. Battle rules are the same as in assets/game.js (trainer battles).
// Players get a made-up name (like "BraveBeetle42"). There's no chat. Only names, avatars, and bugs
// are shared. Nothing about the real person is stored (no emails).
//
// Accounts and levels live here too (see "Accounts and levels" in requirements.md). You sign in with
// your made-up name and a password. Levels:
//   team    = our team: can do anything (delete and fix reports, manage accounts)
//   manager = can look at all the reports, but can't change them
//   player  = can report and play the game
// Visitors who don't sign in can only report (that's on the site). Only the hash of a password is
// saved, never the password itself. The reports page (relay/worker.js) trusts a "review pass": a
// note that says your name and level, signed with this server's secret key. The relay checks it with
// the public key from GET /key, so the two workers never share a secret.
//
// Blocking: our team can block an account for an hour, a day, a week, or forever, or block it AND
// the devices it used. A device is a random number the site keeps in the browser (no IP addresses,
// so a whole school or home network is never blocked). Clearing the browser's data makes a new one.
//
// Owners: whoever types the owner code (a secret a grown-up sets with "wrangler secret put OWNER_CODE")
// becomes an owner. The first one is the MAIN owner. Owners can make other accounts owners too (Manage
// accounts → 👑 Make owner), and take it away again, but nobody can take it away from the main owner.
// Owners are always Team, and nobody can block, rename, change the level of, or give a new password to an
// owner. Owners can sign in even on a blocked device.
//
// Sign in with Google (if GOOGLE_CLIENT_ID is set in wrangler.toml): Google says who you are with a signed
// note (an "ID token"). We check Google's signature and keep only a hash of Google's number for you.
// No email, no real name, no photo. You still pick a made-up name.
//
// Deploy: see server/README.md (it needs Wrangler, because Durable Objects can't be made in the
// Cloudflare dashboard). Free plan limits: 100,000 requests a day; past that it stops until tomorrow.

import { DurableObject } from "cloudflare:workers";

const VERSION = 2;          // the game's message rules (assets/game-online.js must match)
const RELEASE = 5;          // which code is live (GET / shows it)
// Websites allowed to connect (the game's site, and your own computer for testing)
const SITE_ORIGINS = ["https://wizkidzai.github.io", "https://edafawd.github.io"];
const LOCAL_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
// The reports page (relay/worker.js) signs in here too
const RELAY_ORIGIN = "https://pyinsect-relay.pandadifferent246.workers.dev";

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
// A name must be one of ours: adjective + bug + a number from 1 to 99
function goodName(name) {
  const m = /^([A-Z][a-z]+)([A-Z][a-z]+)([1-9]\d?)$/.exec(name || "");
  return !!m && ADJECTIVES.includes(m[1]) && NOUNS.includes(m[2]);
}

// Team members can pick their own name (and rename anyone): 3-20 letters, numbers, or _, and nothing rude
const OWN_NAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const RUDE = ["fuck", "shit", "bitch", "dick", "cock", "pussy", "cunt", "porn", "nazi", "hitler", "nigg", "fag", "slut", "whore", "rape", "penis", "vagina", "boob", "poop", "damn", "crap", "stupid", "idiot"];
const okOwnName = name => OWN_NAME_RE.test(name) && !RUDE.some(w => name.toLowerCase().replace(/_/g, "").includes(w));

// ---------- accounts ----------
const LEVELS = ["team", "manager", "player"];
const MIN_PASSWORD = 6;
const SESSION_DAYS = 90;              // you stay signed in on a device for 90 days
const PASS_MS = 60 * 60 * 1000;       // a review pass for the reports page lasts an hour
const PBKDF2_ROUNDS = 100000;         // how hard password hashes are to guess (the most Cloudflare allows)
const MINUTE = 60 * 1000, HOUR = 60 * MINUTE;
// How long a block lasts. "blocked" in the database: 0 = not blocked, 1 = forever, more = blocked until then.
const BLOCK_FOR = { hour: HOUR, day: 24 * HOUR, week: 7 * 24 * HOUR, forever: 0 };
const MAX_DEVICES = 20;     // devices remembered for each account
const isBlocked = p => p.blocked === 1 || p.blocked > Date.now();
const blockedUntil = p => p.blocked > 1 && p.blocked > Date.now() ? p.blocked : null;
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const randomHex = bytes => hex(crypto.getRandomValues(new Uint8Array(bytes)));
const sha256 = async text => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: PBKDF2_ROUNDS }, key, 256);
  return `${salt}:${hex(bits)}`;
}
const checkPassword = async (password, saved) => !!saved && await hashPassword(password, saved.split(":")[0]) === saved;
const NO_PASSWORD = "google";   // saved as the "password" of a Google-only account: no password ever matches it
const fromB64url = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
// Google's public keys (they change every few days), kept for an hour
const GOOGLE_CERTS = "https://www.googleapis.com/oauth2/v3/certs";
let googleKeys = null;
// A Google ID token → Google's number for that person, or null if it isn't real, is old, or is for another site
async function googleSub(token, env) {
  try {
    if (!env.GOOGLE_CLIENT_ID || typeof token !== "string" || token.length > 3000) return null;
    const [h, p, s] = token.split(".");
    const head = JSON.parse(new TextDecoder().decode(fromB64url(h))), body = JSON.parse(new TextDecoder().decode(fromB64url(p)));
    if (head.alg !== "RS256") return null;
    if (!googleKeys || Date.now() - googleKeys.at > HOUR || !googleKeys.keys.some(k => k.kid === head.kid))
      googleKeys = { at: Date.now(), keys: (await (await fetch(env.GOOGLE_CERTS || GOOGLE_CERTS)).json()).keys };
    const jwk = googleKeys.keys.find(k => k.kid === head.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromB64url(s), new TextEncoder().encode(`${h}.${p}`))) return null;
    if (!["accounts.google.com", "https://accounts.google.com"].includes(body.iss) || body.aud !== env.GOOGLE_CLIENT_ID) return null;
    if (!(body.exp * 1000 > Date.now()) || typeof body.sub !== "string" || !body.sub) return null;
    return body.sub;
  } catch { return null; }
}

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
    // Accounts: sign up, sign in, and (for our team) managing accounts. Only our websites may use it.
    if (url.pathname === "/account") {
      const allowed = SITE_ORIGINS.includes(origin) || origin === RELAY_ORIGIN || LOCAL_ORIGIN.test(origin);
      const cors = allowed ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST", Vary: "Origin" } : {};
      if (request.method === "OPTIONS") return new Response(null, { status: allowed ? 204 : 403, headers: cors });
      if (!allowed || request.method !== "POST" || Number(request.headers.get("Content-Length") || 0) > 4000) return new Response("Not allowed", { status: 403 });
      const res = await env.LOBBY.get(env.LOBBY.idFromName("main")).fetch(request);
      return new Response(res.body, { status: res.status, headers: { ...cors, "Content-Type": "application/json" } });
    }
    // The public key that checks review passes (relay/worker.js has a copy). Not a secret.
    if (url.pathname === "/key") {
      const res = await env.LOBBY.get(env.LOBBY.idFromName("main")).fetch(request);
      return new Response(res.body, { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
    }
    // google = the Google sign-in client ID (not a secret), or null when Google sign-in is off
    return Response.json({ ok: true, service: "innvadex-server", version: VERSION, release: RELEASE, google: env.GOOGLE_CLIENT_ID || null },
      { headers: { "Access-Control-Allow-Origin": "*" } });
  },
};

export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, name TEXT UNIQUE, look TEXT, bot INTEGER DEFAULT 0,
      level INTEGER DEFAULT 2, team TEXT, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, created INTEGER, seen INTEGER)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS friends (a TEXT, b TEXT, state TEXT, PRIMARY KEY (a, b))`);   // a→b: "asked" or "friends"
    // Accounts (version 2): a password hash, a level, and blocked or not
    // (and "google": the hash of Google's number for that person, for Sign in with Google)
    for (const col of ["pass TEXT", "role TEXT DEFAULT 'player'", "blocked INTEGER DEFAULT 0", "google TEXT"]) {
      try { this.sql.exec(`ALTER TABLE players ADD COLUMN ${col}`); } catch {}   // already there
    }
    this.sql.exec(`CREATE UNIQUE INDEX IF NOT EXISTS players_google ON players (google)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, id TEXT, created INTEGER)`);
    // Devices each account used, and blocked devices (only a hash of the device's number is kept)
    this.sql.exec(`CREATE TABLE IF NOT EXISTS devices (hash TEXT, id TEXT, seen INTEGER, PRIMARY KEY (hash, id))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS blocked_devices (hash TEXT PRIMARY KEY, id TEXT, at INTEGER)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT)`);
    // Every owner (the main owner is also in settings, k = 'owner'). "by" = who made them an owner.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS owners (id TEXT PRIMARY KEY, by TEXT, at INTEGER)`);
    this.sql.exec(`INSERT OR IGNORE INTO owners (id, by, at) SELECT v, 'code', ? FROM settings WHERE k = 'owner'`, Date.now());
    // Version 1 players had no password, so they can't sign in. They're removed, so their names are free again.
    this.sql.exec(`DELETE FROM friends WHERE a IN (SELECT id FROM players WHERE bot = 0 AND pass IS NULL)
      OR b IN (SELECT id FROM players WHERE bot = 0 AND pass IS NULL)`);
    this.sql.exec("DELETE FROM players WHERE bot = 0 AND pass IS NULL");
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
    this.sessions = new Map();   // session hash → player id (a copy of the sessions table)
    this.hits = new Map();       // "what:who" → times, for "too many tries, wait a bit"
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
  pub(p) {
    const level = p.role === "team" || p.role === "manager" ? p.role : undefined;   // shown as a tag next to the name
    return { name: p.name, look: p.look, bot: !!p.bot, level, online: this.isOnline(p), wins: p.wins, status: this.statusOf(p) };
  }
  teamOf(id) {
    const p = this.player(id);
    if (p?.bot) return JSON.parse(p.team).map(([s, lv]) => fighter(s, lv));
    const card = this.conns.get(id)?.card;
    return card ? card.team.map(([s, lv]) => fighter(s, lv, card.cheer)) : [];
  }

  // ---------- connections ----------
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/account") {
      const [status, body] = await this.onAccount(request).catch(() => [500, { error: "oops" }]);
      return Response.json(body, { status });
    }
    if (path === "/key") return Response.json((await this.signKey()).pub);
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
    if (conn.said || m.v !== VERSION) return this.reply(conn, { t: "error", code: m.v !== VERSION ? "old" : "bad" });
    conn.said = true;
    const p = await this.bySession(m.session), device = await this.deviceHash(m.device);
    if (this.deviceBlocked(device) && !this.isOwner(p)) { conn.said = false; return this.reply(conn, { t: "error", code: "deviceBlocked" }); }
    if (!p || (isBlocked(p) && !this.isOwner(p))) { conn.said = false; return this.reply(conn, { t: "error", code: p ? "blocked" : "signin" }); }
    this.sawDevice(device, p.id);
    const id = p.id, old = this.conns.get(id);
    if (old && old !== conn) { this.reply(old, { t: "error", code: "elsewhere" }); try { old.ws.close(4000, "elsewhere"); } catch {} this.leave(id); }
    conn.id = id; conn.card = checkCard(m) || { look: "🙂", team: [], cheer: 0 };
    this.conns.set(id, conn);
    this.sql.exec("UPDATE players SET seen = ?, look = ? WHERE id = ?", Date.now(), conn.card.look, id);
    this.changed(id);
    this.welcome(id);
  }
  // Four free names to pick from when you make an account
  freeNames() {
    const names = new Set();
    while (names.size < 4) { const n = randomName(); if (!this.byName(n)) names.add(n); }
    return [...names];
  }
  welcome(id) {
    const p = this.player(id);
    this.status.set(id, { kind: "lobby" });
    this.send(id, { t: "welcome", me: this.meInfo(p) });
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

  // ---------- accounts ----------
  // "Too many tries": at most `most` tries per `ms` for each key (like "signin:bravebeetle42")
  tooMany(key, most, ms) { const now = Date.now(), list = (this.hits.get(key) || []).filter(x => now - x < ms); this.hits.set(key, list); return list.length >= most; }
  tried(key) { const list = this.hits.get(key) || []; list.push(Date.now()); this.hits.set(key, list); }
  async bySession(session) {
    if (typeof session !== "string" || !/^[0-9a-f]{48}$/.test(session)) return null;
    const hash = await sha256(session);
    if (!this.sessions.has(hash)) {
      const row = this.sql.exec("SELECT id, created FROM sessions WHERE hash = ?", hash).toArray()[0];
      if (!row || Date.now() - row.created > SESSION_DAYS * 24 * HOUR) return null;
      this.sessions.set(hash, row.id);
    }
    return this.player(this.sessions.get(hash));
  }
  async newSession(id) {
    const session = randomHex(24);
    this.sql.exec("INSERT INTO sessions (hash, id, created) VALUES (?, ?, ?)", await sha256(session), id, Date.now());
    return { session, me: this.meInfo(this.player(id)) };
  }
  // Signs someone out everywhere (blocked, or their password was changed)
  endSessions(id) {
    this.sql.exec("DELETE FROM sessions WHERE id = ?", id);
    for (const [hash, x] of this.sessions) if (x === id) this.sessions.delete(hash);
    const c = this.conns.get(id);
    if (c) { this.reply(c, { t: "error", code: "signin" }); try { c.ws.close(4001, "signed out"); } catch {} this.onClose(c); }
  }
  // A device's number (made by the site) → its hash, or null
  async deviceHash(device) { return typeof device === "string" && /^[0-9a-f]{32}$/.test(device) ? sha256(`device:${device}`) : null; }
  deviceBlocked(hash) { return !!hash && this.sql.exec("SELECT 1 FROM blocked_devices WHERE hash = ?", hash).toArray().length > 0; }
  sawDevice(hash, id) {
    if (!hash) return;
    this.sql.exec("INSERT OR REPLACE INTO devices (hash, id, seen) VALUES (?, ?, ?)", hash, id, Date.now());
    this.sql.exec(`DELETE FROM devices WHERE id = ? AND hash NOT IN (SELECT hash FROM devices WHERE id = ? ORDER BY seen DESC LIMIT ${MAX_DEVICES})`, id, id);
  }
  meInfo(p) { return { name: p.name, look: p.look, level: p.role || "player", owner: this.isOwner(p) || undefined, mainOwner: this.isMainOwner(p) || undefined, google: !!p.google || undefined, wins: p.wins, losses: p.losses }; }
  // The main owner's id (the first one to use the owner code), or null
  ownerId() {
    if (this.owner === undefined) this.owner = this.sql.exec("SELECT v FROM settings WHERE k = 'owner'").toArray()[0]?.v || null;
    return this.owner;
  }
  // Every owner's id (kept in memory, because it's checked a lot)
  ownerIds() { return this.owners || (this.owners = new Set(this.sql.exec("SELECT id FROM owners").toArray().map(r => r.id))); }
  // Makes someone an owner: Team, not blocked. `by` = the owner who did it, or "code".
  makeOwner(id, by) {
    if (!this.ownerId()) { this.owner = id; this.sql.exec("INSERT OR REPLACE INTO settings (k, v) VALUES ('owner', ?)", id); }
    this.sql.exec("INSERT OR IGNORE INTO owners (id, by, at) VALUES (?, ?, ?)", id, by, Date.now());
    this.ownerIds().add(id);
    this.sql.exec("UPDATE players SET role = 'team', blocked = 0 WHERE id = ?", id);
    this.sql.exec("DELETE FROM blocked_devices WHERE id = ?", id);
    this.changed(id);
  }
  // Takes owner away (they stay Team). Never from the main owner.
  unOwner(id) {
    this.sql.exec("DELETE FROM owners WHERE id = ?", id);
    this.ownerIds().delete(id);
    this.changed(id);
  }
  isOwner(p) { return !!p && this.ownerIds().has(p.id); }
  isMainOwner(p) { return !!p && p.id === this.ownerId(); }
  // The key that signs review passes. Made once, then kept in this server's storage.
  signKey() {
    return this.keyPromise || (this.keyPromise = (async () => {
      let saved = await this.ctx.storage.get("signKey");
      if (!saved) {
        const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
        const { kty, crv, x, y } = await crypto.subtle.exportKey("jwk", pair.publicKey);
        saved = { priv: await crypto.subtle.exportKey("jwk", pair.privateKey), pub: { kty, crv, x, y } };
        await this.ctx.storage.put("signKey", saved);
      }
      return { priv: await crypto.subtle.importKey("jwk", saved.priv, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]), pub: saved.pub };
    })());
  }
  // A review pass: "<name and level>.<signature>", good for an hour
  async reviewPass(p) {
    const body = b64url(new TextEncoder().encode(JSON.stringify({ name: p.name, level: p.role, exp: Date.now() + PASS_MS })));
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, (await this.signKey()).priv, new TextEncoder().encode(body));
    return `${body}.${b64url(sig)}`;
  }

  // POST /account with { do: "...", ... }. Answers [status, body].
  async onAccount(request) {
    const ip = request.headers.get("CF-Connecting-IP") || "here";
    let b; try { b = await request.json(); } catch {}
    if (!b || typeof b !== "object" || typeof b.do !== "string") return [400, { error: "bad" }];
    const text = (v, max) => typeof v === "string" && v.length <= max ? v : "";
    const name = text(b.name, 40).trim(), password = text(b.password, 200);
    const device = await this.deviceHash(b.device);

    // A blocked device can't do anything here (and the site stops sending its reports)
    // (except for the owner, who can sign in anywhere)
    const ownerHere = async () => this.isOwner(await this.bySession(b.session));
    if (b.do === "device") return [200, { blocked: this.deviceBlocked(device) && !await ownerHere() }];
    if (b.do !== "signin" && b.do !== "google" && this.deviceBlocked(device) && !await ownerHere()) return [403, { error: "deviceBlocked" }];
    if (b.do === "names") return [200, { names: this.freeNames() }];
    if (b.do === "signup") {
      if (this.tooMany(`signup:${ip}`, 5, HOUR)) return [429, { error: "slow" }];
      if (!goodName(name)) return [400, { error: "name" }];
      if (password.length < MIN_PASSWORD) return [400, { error: "short" }];
      if (this.byName(name)) return [409, { error: "taken", names: this.freeNames() }];
      this.tried(`signup:${ip}`);
      const id = `u:${randomHex(16)}`, now = Date.now();
      this.sql.exec("INSERT INTO players (id, name, look, pass, role, created, seen) VALUES (?, ?, '🙂', ?, 'player', ?, ?)",
        id, name, await hashPassword(password, randomHex(16)), now, now);
      this.sawDevice(device, id);
      return [200, await this.newSession(id)];
    }
    if (b.do === "signin") {
      const key = `signin:${name.toLowerCase()}`;
      if (this.tooMany(key, 10, 15 * MINUTE) || this.tooMany(`ip:${ip}`, 30, 15 * MINUTE)) return [429, { error: "slow" }];
      const p = this.byName(name);
      if (!p || p.bot || !await checkPassword(password, p.pass)) { this.tried(key); this.tried(`ip:${ip}`); return [401, { error: "wrong" }]; }
      if (this.isOwner(p)) return [200, await this.newSession(p.id)];
      if (this.deviceBlocked(device)) return [403, { error: "deviceBlocked" }];
      if (isBlocked(p)) return [403, { error: "blocked", until: blockedUntil(p) }];
      this.sawDevice(device, p.id);
      return [200, await this.newSession(p.id)];
    }
    // Sign in with Google. A new Google account picks a made-up name first: the first try answers
    // "newGoogle" with names, then the site sends the same token again with the name.
    if (b.do === "google") {
      if (this.tooMany(`ip:${ip}`, 30, 15 * MINUTE)) return [429, { error: "slow" }];
      const sub = await googleSub(b.credential, this.env);
      if (!sub) { this.tried(`ip:${ip}`); return [401, { error: "google" }]; }
      const g = await sha256(`google:${sub}`);
      const p = this.sql.exec("SELECT id FROM players WHERE google = ?", g).toArray()[0];
      if (p) {
        const who = this.player(p.id);
        if (this.isOwner(who)) return [200, await this.newSession(who.id)];
        if (this.deviceBlocked(device)) return [403, { error: "deviceBlocked" }];
        if (isBlocked(who)) return [403, { error: "blocked", until: blockedUntil(who) }];
        this.sawDevice(device, who.id);
        return [200, await this.newSession(who.id)];
      }
      if (this.deviceBlocked(device)) return [403, { error: "deviceBlocked" }];
      if (!name) return [200, { error: "newGoogle", names: this.freeNames() }];
      if (this.tooMany(`signup:${ip}`, 5, HOUR)) return [429, { error: "slow" }];
      if (!goodName(name)) return [400, { error: "name" }];
      if (this.byName(name)) return [409, { error: "taken", names: this.freeNames() }];
      this.tried(`signup:${ip}`);
      const id = `u:${randomHex(16)}`, now = Date.now();
      this.sql.exec("INSERT INTO players (id, name, look, pass, role, google, created, seen) VALUES (?, ?, '🙂', ?, 'player', ?, ?, ?)",
        id, name, NO_PASSWORD, g, now, now);
      this.sawDevice(device, id);
      return [200, await this.newSession(id)];
    }

    // Everything else needs you to be signed in
    const me = await this.bySession(b.session);
    if (!me) return [401, { error: "signin" }];
    if (isBlocked(me) && !this.isOwner(me)) return [403, { error: "blocked", until: blockedUntil(me) }];
    if (b.do === "me") { this.sawDevice(device, me.id); return [200, { me: this.meInfo(me) }]; }
    if (b.do === "signout") { const hash = await sha256(b.session); this.sql.exec("DELETE FROM sessions WHERE hash = ?", hash); this.sessions.delete(hash); return [200, {}]; }
    // Add Google to an account you already have (so you can sign in either way), or take it off
    if (b.do === "linkGoogle") {
      const sub = await googleSub(b.credential, this.env);
      if (!sub) return [401, { error: "google" }];
      const g = await sha256(`google:${sub}`), other = this.sql.exec("SELECT id FROM players WHERE google = ?", g).toArray()[0];
      if (other && other.id !== me.id) return [409, { error: "googleTaken" }];
      this.sql.exec("UPDATE players SET google = ? WHERE id = ?", g, me.id); this.changed(me.id);
      return [200, { me: this.meInfo(this.player(me.id)) }];
    }
    if (b.do === "unlinkGoogle") {
      if (me.pass === NO_PASSWORD) return [400, { error: "needPassword" }];   // they'd have no way to sign in
      this.sql.exec("UPDATE players SET google = NULL WHERE id = ?", me.id); this.changed(me.id);
      return [200, { me: this.meInfo(this.player(me.id)) }];
    }
    if (b.do === "pass") return me.role === "team" || me.role === "manager" ? [200, { pass: await this.reviewPass(me) }] : [403, { error: "level" }];
    // The team setup code (a secret a grown-up sets with "wrangler secret put SETUP_CODE") makes you team level
    if (b.do === "claim") {
      if (this.tooMany(`claim:${me.id}`, 5, 15 * MINUTE)) return [429, { error: "slow" }];
      this.tried(`claim:${me.id}`);
      if (!this.env.SETUP_CODE || text(b.code, 200) !== this.env.SETUP_CODE) return [403, { error: "code" }];
      this.sql.exec("UPDATE players SET role = 'team' WHERE id = ?", me.id); this.changed(me.id);
      return [200, { me: this.meInfo(this.player(me.id)) }];
    }
    // The owner code makes you the owner
    if (b.do === "claimOwner") {
      if (this.tooMany(`claim:${me.id}`, 5, 15 * MINUTE)) return [429, { error: "slow" }];
      this.tried(`claim:${me.id}`);
      if (!this.env.OWNER_CODE || text(b.code, 200) !== this.env.OWNER_CODE) return [403, { error: "code" }];
      this.makeOwner(me.id, "code");
      return [200, { me: this.meInfo(this.player(me.id)) }];
    }

    // Managing accounts: team level only
    if (me.role !== "team") return [403, { error: "level" }];
    if (b.do === "accounts") {
      const find = text(b.find, 40).replace(/[^A-Za-z0-9]/g, "");
      const rows = this.sql.exec(`SELECT id, name, role, blocked, created, seen FROM players WHERE bot = 0 AND pass IS NOT NULL AND name LIKE ?
        ORDER BY seen DESC LIMIT 50`, `${find}%`).toArray();
      const devBlocked = new Set(this.sql.exec("SELECT DISTINCT id FROM blocked_devices").toArray().map(r => r.id));
      return [200, { accounts: rows.map(r => ({ name: r.name, level: r.role || "player", blocked: isBlocked(r), until: blockedUntil(r),
        device: devBlocked.has(r.id), owner: this.ownerIds().has(r.id) || undefined, mainOwner: r.id === this.ownerId() || undefined, created: r.created, seen: r.seen })) }];
    }
    const who = this.byName(name);
    if (!who || who.bot || !who.pass) return [404, { error: "notFound" }];
    // A new name (for yourself or anyone else)
    if (b.do === "rename") {
      const newName = text(b.newName, 40).trim(), same = newName.toLowerCase() === who.name.toLowerCase();
      if (!okOwnName(newName)) return [400, { error: "badName" }];
      if (this.isOwner(who) && who.id !== me.id) return [403, { error: "owner" }];
      if (!same && this.byName(newName)) return [409, { error: "nameTaken" }];
      this.sql.exec("UPDATE players SET name = ? WHERE id = ?", newName, who.id);
      this.changed(who.id); this.lobbyChanged(); this.friendsChanged(who.id);
      return [200, { me: who.id === me.id ? this.meInfo(this.player(me.id)) : undefined }];
    }
    if (who.id === me.id) return [400, { error: "self" }];   // so the team can't lock itself out by mistake
    // Owners can make someone an owner, or take it away (but never from the main owner)
    if (b.do === "owner") {
      if (!this.isOwner(me)) return [403, { error: "level" }];
      if (b.yes) this.makeOwner(who.id, me.id);
      else if (this.isMainOwner(who)) return [403, { error: "mainOwner" }];
      else this.unOwner(who.id);
      return [200, {}];
    }
    if (this.isOwner(who)) return [403, { error: "owner" }];  // nobody can block or change the owner
    if (b.do === "level") {
      if (!LEVELS.includes(b.level)) return [400, { error: "bad" }];
      this.sql.exec("UPDATE players SET role = ? WHERE id = ?", b.level, who.id);
    } else if (b.do === "block") {
      // { yes, for: "hour" | "day" | "week" | "forever", withDevices: true = their devices too (forever) }
      if (b.yes) {
        const ms = b.withDevices === true ? 0 : BLOCK_FOR[b.for ?? "forever"];
        if (ms === undefined) return [400, { error: "bad" }];
        this.sql.exec("UPDATE players SET blocked = ? WHERE id = ?", ms ? Date.now() + ms : 1, who.id);
        // Their devices, but never one our team uses (a shared school computer, say)
        if (b.withDevices === true) this.sql.exec(`INSERT OR IGNORE INTO blocked_devices (hash, id, at) SELECT hash, id, ? FROM devices WHERE id = ?
          AND hash NOT IN (SELECT d.hash FROM devices d JOIN players p ON p.id = d.id WHERE p.role = 'team')`, Date.now(), who.id);
        this.endSessions(who.id);
        if (b.withDevices === true) { this.changed(who.id); return [200, { devices: this.sql.exec("SELECT COUNT(*) AS n FROM blocked_devices WHERE id = ?", who.id).one().n }]; }
      } else {
        this.sql.exec("UPDATE players SET blocked = 0 WHERE id = ?", who.id);
        this.sql.exec("DELETE FROM blocked_devices WHERE id = ?", who.id);
      }
    } else if (b.do === "reset") {
      if (password.length < MIN_PASSWORD) return [400, { error: "short" }];
      this.sql.exec("UPDATE players SET pass = ? WHERE id = ?", await hashPassword(password, randomHex(16)), who.id);
      this.endSessions(who.id);
    } else return [400, { error: "bad" }];
    this.changed(who.id);
    return [200, {}];
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
