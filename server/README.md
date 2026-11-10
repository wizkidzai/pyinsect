# Innvadex game server

The online lobby for the Innvadex game: who's online, "Find a match", challenges by name, room
codes, friends, live battles, watching battles, and about 20 bots. It also keeps the accounts and
levels (Team, Manager, Player), see `assets/account.js`. The code is `index.js`; the
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

## Accounts: the team setup code (a grown-up, once)

The server also keeps accounts (made-up name + password, no emails). The first **Team** account
needs a secret **team setup code**. Only a grown-up sets it, and it never goes in any file.

1. In this `server` folder, run `npx wrangler@4.151.1 secret put SETUP_CODE`.
2. Type a long code nobody can guess (like four random words), and press Enter.
3. On the site: sign in, tap your name at the top, open **Are you on our team?**, and type the code.
   Your account is now Team. Make other people Team or Manager in **Manage accounts**.

To change the code later, run step 1 again.

## The owner code (the owner, once)

The **owner** can do anything, and nobody can block or change the owner's account.

1. In this `server` folder, run `npx wrangler@4.151.1 secret put OWNER_CODE`.
2. Type a long code only you know (not the same as the setup code), and press Enter.
3. On the site: sign in, tap your name at the top, open **👑 Are you the owner?**, and type the code.
   Your account now shows **👑 Owner**. Using the code on another account moves the owner there.

## Sign in with Google (a grown-up, once)

Google sign-in is free and needs no card. The server keeps no email or real name, only a scrambled
copy of Google's number for each person.

1. Go to https://console.cloud.google.com and sign in. At the top, pick **Select a project → New project**,
   name it `Pyinsect`, and tap **Create**.
2. In the search box, type **Google Auth Platform** and open it. Tap **Get started**:
   app name `Pyinsect`, your email, Audience **External**, your email again, agree, **Create**.
3. In the left menu, tap **Clients → Create client**. Application type: **Web application**.
   Under **Authorized JavaScript origins**, tap **Add URI** and type `https://wizkidzai.github.io`.
   Tap **Create**.
4. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`). It's not a secret.
5. In the left menu, tap **Audience → Publish app → Confirm**, so everyone can use it (not just test users).
6. Put the Client ID in `wrangler.toml` (`GOOGLE_CLIENT_ID = "..."`), then deploy again
   (`npx wrangler@4.151.1 deploy`). The **Continue with Google** button shows up on the site by itself.

To turn Google sign-in off, make `GOOGLE_CLIENT_ID` empty again and deploy.

## Try it on your own computer

`npx wrangler@4.151.1 dev --var SETUP_CODE:any-test-code` runs the server at http://127.0.0.1:8787
(with its own empty lobby and accounts). Set `window.INNVADEX_SERVER = "ws://127.0.0.1:8787/ws"` and
`window.INNVADEX_HTTP = "http://127.0.0.1:8787"` in a test page before the scripts load.
