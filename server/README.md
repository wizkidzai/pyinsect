# Innvadex game server

The online lobby for the Innvadex game: who's online, "Find a match", challenges by name, room
codes, friends, live battles, watching battles, and about 20 bots. The code is `index.js`; the
page side is `assets/game-online.js`.

It's a Cloudflare Worker with one Durable Object, on Cloudflare's **free plan** (no card). Free
limits: 100,000 requests a day. If it ever goes over, it just stops until the next day; it never
costs money.

## Deploy (a grown-up)

Durable Objects can't be made in the Cloudflare dashboard, so this one uses Wrangler (Cloudflare's
free tool). It needs Node.js (https://nodejs.org, the LTS version).

1. Open a terminal in this `server` folder.
2. `npx wrangler@4.151.1 login`: a browser window opens. Sign in to Cloudflare and click **Allow**.
3. `npx wrangler@4.151.1 deploy`: it prints the server's address, like
   `https://innvadex-server.<account>.workers.dev`.
4. That address goes in `SERVER_URL` at the top of `assets/game-online.js` (with `wss://` instead of `https://`).

Check it: open the address in a browser. It shows `{"ok":true,"service":"innvadex-server",...}`.

## Try it on your own computer

`npx wrangler@4.151.1 dev` runs the server at http://127.0.0.1:8787 (with its own empty lobby).
