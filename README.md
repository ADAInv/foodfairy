# The Food Fairy

Order-first website for The Food Fairy, which serves Nigerian food in Kitchener / Waterloo.

- **Stack:** a TypeScript Node server on SQLite, with a React + Tailwind client.
- **Hosting:** fully self-hosted. There are no cloud services, and fonts are self-hosted too.
- **Payments:** Square is the only outside dependency. It's called with plain `fetch`, with no SDK.
- **Runtime dependencies:** `nodemailer` and `sharp`.

## Requirements

- **Node ≥ 22.13.** The server uses the built-in `node:sqlite`.
- **A Linux VPS** with nginx and certbot for production.
- **Development works on Windows, macOS and Linux.** All npm scripts run under cmd.exe, PowerShell and bash.

## Local development

```sh
npm install
cp .env.example .env          # set NODE_ENV=development, COOKIE_SECURE=false, CHECKOUT_MODE=square_link
npm run build:server
npm run admin:create -- you@example.com
npm run seed:demo              # optional: 3 demo items + an open order window
npm run dev                    # API on :3000, Vite on :5173 (proxied)
```

- With `SMTP_HOST` empty, emails are printed to the console.
- The admin lives at `/admin`. Open the site at http://localhost:5173 in dev.
- **Windows:** run `admin:create` from PowerShell or Windows Terminal so the password prompt is hidden. Git Bash (mintty) isn't a real terminal to Node, so the password would echo on screen.

### Troubleshooting

- **`spawnSync ...tsc.exe UNKNOWN`** means you have TypeScript 7 installed, which is a native binary that Windows blocked. This project pins TypeScript 6.0, the last pure-JavaScript release. It produces byte-identical output to TS 7 for this codebase. Delete `node_modules` and run `npm install` again. To use TS 7 instead, develop inside WSL with Linux Node (see below), then run `npm i -D typescript@^7`.

### Developing on Windows: WSL is recommended

Production runs on Linux, so developing in WSL2 matches it: the same `sharp` binaries, file paths, and TypeScript 7 support. Install Node *inside* WSL (e.g. via nvm), and keep the project on the Linux filesystem (`~/ff`), not `/mnt/d/...`. Check with `which node`. If it prints a `/mnt/c/...` path, you're running Windows Node from WSL, and native binaries will fail.
- **`unable to open database file`**, or `Invalid configuration in .env`, means a setting in `.env` is malformed. Put comments on their own line, not after a value. Quote any value that contains ` #`, e.g. `SMTP_PASS="abc #123"`. The server now lists each bad setting at startup.
- **`Cannot find module dist/server/...`** means the server build hasn't run yet or failed. Run `npm run build:server` first and fix any error it shows.

## Build and run

```sh
npm run build                  # dist/server + dist/client
npm start
```

`npm run typecheck` checks both the server and the client.

## How ordering works

1. Customers can only order inside an **order window** (a "drop"). Each drop has an open and close time, a pickup date, and a pickup window. She sets these up under Admin → Order windows. Everything runs on Toronto time.
2. At checkout, the server **re-prices the whole basket from the database**, so client prices are ignored. It also enforces the per-item max, sold-out flags, the drop being open, and an optional `max_orders` cap. A pending order holds its slot for 30 minutes.
3. **`square_api` mode:**
   - The server creates a one-off Square payment link with the real line items and redirects to it.
   - Square sends the customer back to `/order/<token>`.
   - The webhook marks the order paid. The order page also polls Square as a fallback.
4. **`square_link` mode:**
   - The customer gets their order number and her static Square link.
   - She checks Square, then presses **Mark paid** in Admin → Orders.
5. Marking an order paid, by either route, sends the "It's official ✦" email once. It also reveals the **private pickup instructions** on the order page. Those instructions are never shown before payment and never appear in page source, JSON-LD, or the sitemap.
6. Admin → Order windows → **What to cook** shows aggregated quantities per drop.

## Square setup (sandbox first)

1. **Create the app.** Go to developer.squareup.com, create an application, and switch to **Sandbox**.
2. **Copy the credentials into `.env`:**
   - Sandbox **Access token** → `SQUARE_ACCESS_TOKEN`
   - **Location ID** → `SQUARE_LOCATION_ID`
   - `SQUARE_ENV=sandbox`
   - `CHECKOUT_MODE=square_api`
3. **Add the webhook.** Under Webhooks → Subscriptions, add a subscription:
   - URL: `https://<domain>/api/webhooks/square`
   - Events: `payment.created` and `payment.updated`
   - Copy its **Signature key** → `SQUARE_WEBHOOK_SIGNATURE_KEY`
   - Set `SQUARE_WEBHOOK_URL` to the **exact same URL**. The signature is computed over URL + body, so a trailing slash or `www` mismatch will fail every event with a 401.
4. **Test.** Pay with Square's sandbox test card, then confirm the order flips to paid in admin and the email arrives.
5. **Go live.** Swap in production credentials, a production webhook subscription, and `SQUARE_ENV=production`. The admin shows a "TEST mode" banner until you do.

If she charges HST, set the tax % and label under Admin → Content. The tax is added as its own line on the Square order.

## Deploying (VPS)

```sh
sudo adduser --system --group --home /srv/food-fairy foodfairy
# copy the project to /srv/food-fairy, then as foodfairy:
npm ci && npm run build && npm prune --omit=dev
cp .env.example .env && chmod 600 .env     # fill it in
npm run admin:create -- owner@herdomain.ca

sudo cp deploy/food-fairy.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now food-fairy
sudo cp deploy/nginx.conf /etc/nginx/sites-available/food-fairy
sudo ln -s /etc/nginx/sites-available/food-fairy /etc/nginx/sites-enabled/
sudo certbot --nginx -d thefoodfairy.ca -d www.thefoodfairy.ca
```

- **Secure cookies.** These are on whenever `NODE_ENV=production` or `SITE_URL` starts with `https://`. Only set `COOKIE_SECURE=false` for local http testing.
- **Proxy settings.** Keep `TRUST_PROXY=true` behind nginx. The app uses the last `X-Forwarded-For` hop (the one nginx appends), so clients can't spoof their IP past the rate limits.
- **Backups.** `deploy/backup.sh` writes a consistent SQLite snapshot plus the photos every night and keeps 30 days. Copy that folder off the server as well.
- **Updates.** Pull the new code, run `npm ci && npm run build`, then `sudo systemctl restart food-fairy`. Migrations run automatically and are append-only.

## Before launch

- [ ] Replace the demo items: Admin → Overview → **Delete demo items**.
- [ ] Add her real menu: items, prices, sizes and photos. Don't invent descriptions or reviews (per the brief).
- [ ] Upload the hero and founder photos. The hero doubles as the Instagram/iMessage link preview.
- [ ] Fill in the pickup area (public) and pickup instructions (private).
- [ ] Decide on tax: HST yes or no.
- [ ] Set up SMTP with SPF/DKIM on the sending domain, and send a test order to a Gmail and an Outlook address.
- [ ] Run the full journey on a real phone **inside Instagram's in-app browser**: Instagram → Jollof → Chicken → basket → checkout → Square → back to "It's official ✦".
- [ ] Do a security pass.

## Brand and design

The palette is the logo's own two colours, plus white and a pale wash of the orange. The tokens live in `client/src/styles.css`:

| Token | Hex | Use |
|---|---|---|
| `fairy` | `#DF913E` | Logo orange: header, hero, catering band, buttons on black |
| `ink` | `#000000` | Logo black: all text, primary buttons, order panel, footer |
| `paper` | `#FFFFFF` | Reading surfaces |
| `wash` / `wash-2` | `#FAEEE2` / `#F4DCC0` | Quiet panels and photo placeholders |
| `ink-2` | `#4D4D4D` | Muted text (8.5:1 on white) |

- **Type:** Newsreader for headlines (an editorial serif, per the brief) and Jost for body and UI. Jost's capitals echo the logo's "FAIRY". Both are self-hosted via Fontsource.
- **Logo:** the logo was traced from the client's artwork into `client/public/brand/logo-ink.svg` and `logo-orange.svg`. To swap in an official vector, replace those two files, keeping each at a single colour. The fairy alone (`components/brandPaths.ts`) powers the favicon. On the homepage, the hero shows the logo with a wand trail that draws once on load. The header logo appears once the hero scrolls away.
- **Restraint:** per the brief there are no cartoon fairies or wings everywhere. The fairy appears only inside the logo. Whimsy otherwise lives in small ✦ marks on success and empty states, the arched photo frames, and the outline lettering on "What are you craving?", which is borrowed from the logo's "FOOD".
- **Orange text:** don't put orange text on white. It's 2.4:1 and fails contrast. Orange works as a background behind black text, or as text on black (8:1).

## Project layout

```
server/src/
  index.ts          HTTP server, static files, SSR head injection
  seo.ts            per-route meta/OG tags, JSON-LD (no address), sitemap, robots
  db.ts             SQLite schema + migrations
  routes/           public API, admin API, Square webhook
  lib/              auth (scrypt, sessions, CSRF), drops, orders, square, mail, images (sharp)
  cli/              create-admin, seed-demo
client/src/
  pages/            public site
  components/       menu, sheets, basket, drop ticket, doodles
  admin/            owner dashboard (lazy-loaded)
deploy/             nginx, systemd, backup script
```
