# Morning Brief

Your agent-native morning brief, deployable in one afternoon.

This is the Sunday capstone scaffold. Fork the repo, paste secrets into Vercel + Supabase + Telegram, deploy, see your brief at a live URL. The visual baseline is the AI Build Lab field-manual aesthetic. The default delivery channel is Telegram.

For the full visual spec, read `STYLE.md` in this folder. For the canonical product spec, read `blueprints/morning-brief/` at the repo root.

---

## What ships out of the box (4D)

- A Next.js 15 app at `apps/morning-brief/` deployable to Vercel.
- Supabase tables: `briefs`, `sources`, `delivery_logs`.
- One delivery adapter: Telegram bot (free, phone-native, no domain or workspace setup needed).
- A JSON contract that any Claude Code session can write to via `POST /api/briefs`.
- A homepage that renders the latest brief, source registry, delivery log, and run timeline in the field-manual aesthetic.

The Slack version, the iMessage version, and scheduled cron runs are all 8D extensions. See `blueprints/morning-brief/EXTENSIONS-8D.md`.

---

## Five-step deploy

> Workshop pace: roughly 35 minutes if Vercel and Supabase accounts already exist.

1. **Fork and clone**
   - Fork this repo, then `cd apps/morning-brief`.
   - `cp .env.example .env.local` and leave it open. You will fill it in steps 2 and 3.

2. **Create the Supabase project**
   - Sign up at supabase.com, create a project, wait for the database to provision.
   - In the SQL Editor, paste the contents of `supabase/migrations/0001_morning_brief.sql` and run.
   - Optional: paste `supabase/seed.sql` to load two demo briefs so the page isn't empty on first deploy.
   - Settings -> API. Copy the Project URL, the anon key, and the service_role key into `.env.local`.

3. **Create the Telegram bot**
   - Open Telegram, search `@BotFather`, send `/newbot`, follow the prompts. Save the bot token.
   - **Important gotcha:** before the bot can message you, you must message it first. Open a chat with your new bot and send any message.
   - To get your chat id: open `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` in a browser. Find `"chat":{"id":...}`. That number is your `TELEGRAM_CHAT_ID`.
   - Paste both into `.env.local`.

4. **Deploy to Vercel**
   - Push your fork to GitHub, then import it at vercel.com/new.
   - Set the project root to `apps/morning-brief` (Vercel asks during import).
   - Paste every variable from `.env.local` into the Vercel project's Environment Variables. Apply to Production, Preview, and Development.
   - Click Deploy.

5. **Smoke test**
   - Open your Vercel URL. You should see the homepage with the demo brief from `seed.sql` (or an empty-state card if you skipped seeding).
   - Trigger a Telegram ping with curl, replacing `<YOUR_URL>` with your Vercel domain:
     ```bash
     curl -X POST https://<YOUR_URL>/api/deliver/telegram \
       -H "Content-Type: application/json" \
       -d '{"date":"2026-05-04","title":"hello from my morning brief","top_priority":"ship it"}'
     ```
   - Check Telegram. You should see the ping. Check the Supabase `delivery_logs` table. You should see the row.

If all of that worked, you've deployed your capstone. From here, generate a real brief in Claude Code by running `/build-morning-brief` and POSTing the output JSON to `/api/briefs`.

---

## Running locally (after first-time setup)

`.env.local` contains `op://Workshop-Keys/...` references, not real secrets. The 1Password CLI resolves them at runtime, so always launch the dev server through `op run`:

```bash
cd apps/morning-brief
op run --env-file=.env.local -- npm run dev
```

Prerequisites: 1Password desktop running and unlocked, CLI integration enabled (Settings -> Developer -> "Integrate with 1Password CLI"). Verify with `op vault list` -- if it returns your vaults, you're good.

If you ever overwrite `.env.local` with `cp .env.example .env.local`, you'll need to restore the references (or rerun the migration). The references are checked into the file in this repo, so `git checkout apps/morning-brief/.env.local` is the fastest fix.

---

## Generating a real brief

The slash command `/build-morning-brief` lives at `configs/commands/build-morning-brief.md` (on a separate worker branch awaiting review). When merged, it walks Claude Code through compiling sources into the canonical JSON contract, posting to `POST /api/briefs`, then triggering `POST /api/deliver/telegram`.

Until then, you can hand-craft a brief by following the shape in `blueprints/morning-brief/brief-contract.json` and POSTing it directly.

---

## Top 5 troubleshooting

1. **The page loads but says "No briefs yet."**
   You skipped the seed. Either run `supabase/seed.sql` in the Supabase SQL Editor, or POST a brief to `/api/briefs`.

2. **Vercel build fails with "Missing SUPABASE_URL."**
   Env vars not pasted into Vercel. Project Settings -> Environment Variables. Apply to all three environments (Production, Preview, Development) and redeploy.

3. **Telegram ping returns 502 with "telegram: Bad Request: chat not found."**
   You haven't messaged the bot yet. Open the bot in Telegram, send any message, then retry.

4. **Telegram chat id looks wrong (something like -1001234567890).**
   That's a group chat id. They are valid but start with a minus. If you wanted a personal DM, use a number without the minus. If you wanted a group, the minus is correct.

5. **POST /api/briefs returns 422.**
   Your JSON is missing a required field. The contract is in `src/lib/brief-contract.ts` and `blueprints/morning-brief/brief-contract.json`. Required fields: `date`, `title`, `summary`, `top_priority`, `sections`, `source_status`, `delivery_status`.

---

## Secrets posture

Local secrets live in 1Password under the **Workshop-Keys** vault, in two items:

- **Morning-Brief-Supabase** -- fields: `url`, `anon_key`, `service_role_key`
- **Morning-Brief-Telegram** -- fields: `bot_token`, `chat_id`

`.env.local` contains only `op://Workshop-Keys/...` references. `op run` resolves them at process start (see "Running locally" above). Production env vars live in Vercel separately and are unaffected by local 1Password state.

If you accidentally commit a real secret, rotate the Telegram bot token and the Supabase service-role key immediately, then re-store the new values in 1Password.

Never paste secrets into Claude chat, Slack, or GitHub issues. Use the Vercel dashboard, Supabase dashboard, or 1Password.

---

## What's intentionally not here

- No source connectors. Wire your own in 8D (`EXTENSIONS-8D.md`).
- No scheduled runs. Add a Vercel Cron or a GitHub Action in 8D.
- No auth. The demo briefs are public-readable. Add Supabase Auth before you ship to real users.
- No Slack or iMessage adapter. Telegram only for Sunday.

---

## File map

```
apps/morning-brief/
  package.json              Next.js 15 + Supabase JS + Tailwind
  next.config.ts
  tsconfig.json
  tailwind.config.ts        design tokens loaded from STYLE.md
  postcss.config.mjs
  vercel.json               zero-config, env var passthrough
  .env.example              placeholders only, never real keys
  STYLE.md                  field-manual aesthetic spec (copy of playbook source)
  supabase/
    migrations/0001_morning_brief.sql
    seed.sql
  src/
    app/
      layout.tsx            paper bg + 46px grid + brand logo header
      page.tsx              latest brief, sources, delivery log, run timeline
      globals.css           field-manual styles (highlight, file-tab card, terminal block)
      api/briefs/route.ts   POST a brief, GET latest N
      api/deliver/telegram/route.ts   send a ping, log it
    lib/
      brief-contract.ts     TS types + validate()
      supabase.ts           server-side client
      telegram.ts           Bot API helper + ping formatter
    styles/tokens.css       design tokens as CSS vars
  public/assets/            AI Build Lab logo (svg + png)
```
