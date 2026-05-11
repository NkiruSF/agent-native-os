---
description: Capture YouTube intel from configured channels, synthesise into a daily brief in the Cairns vault, ping Telegram.
---

Run the youtube-cairns capture pipeline and synthesise today's brief. Writes into the personal Cairns vault under a sub-folder (does not touch the main vault's L1).

## Environment

- Python: `/c/Users/nkiru/AppData/Local/Programs/Python/Python310/python.exe`
- yt-dlp on PATH: prepend `/c/Users/nkiru/AppData/Local/Programs/Python/Python310/Scripts` to `$PATH` for every Bash call that runs the pipeline.
- Pipeline dir: `blueprints/youtube-cairns/` in this repo.
- Channels config: `blueprints/youtube-cairns/pipeline/channels.yaml`.
- Sub-vault for YouTube intel: `C:\Users\nkiru\ClaudeCode\SECONDBRAIN\youtube-vault\` (the blueprint's L1 lives inside this sub-folder — it does NOT overwrite the main `SECONDBRAIN\cairns\L1\`).
- Daily brief output: `C:\Users\nkiru\ClaudeCode\SECONDBRAIN\daily-reviews\<DATE>-intel.md`.

## Steps

1. **Compute today's date** in Europe/London:
   - `TZ=Europe/London date +%Y-%m-%d` → use as `<DATE>` and frontmatter `date`.
   - `TZ=Europe/London date +'%a, %b %-d, %Y'` → use as the brief title.

2. **Run the capture pipeline** from the worktree root, with PATH prepended:
   ```
   export PATH="/c/Users/nkiru/AppData/Local/Programs/Python/Python310/Scripts:$PATH"
   cd "C:/Users/nkiru/GitHub/agent-native-os/.claude/worktrees/xenodochial-saha-f61e05/blueprints/youtube-cairns"
   "/c/Users/nkiru/AppData/Local/Programs/Python/Python310/python.exe" pipeline/build.py \
     --config pipeline/channels.yaml \
     --vault "C:/Users/nkiru/ClaudeCode/SECONDBRAIN/youtube-vault" \
     --since-days 14
   "/c/Users/nkiru/AppData/Local/Programs/Python/Python310/python.exe" pipeline/enrich.py \
     --vault "C:/Users/nkiru/ClaudeCode/SECONDBRAIN/youtube-vault"
   ```
   Capture stdout. If `Sources captured: 0`, skip to step 6 with "no new intel today."

3. **Read the manifest** to know what was captured this run:
   - Read `C:/Users/nkiru/ClaudeCode/SECONDBRAIN/youtube-vault/manifests/sources.json` — this file contains ONLY this run's captures. Each row has `obsidian_path`, `title`, `url`, `channel_slug`, `channel_name`, `video_id`.

4. **Read each L3 transcript** referenced by the manifest:
   - For each row, read `<vault>/<obsidian_path>` (e.g. `<vault>/raw/transcripts/ai-explained/<id> - <slug>.md`).
   - The transcript body follows the `## Transcript` heading.

5. **Synthesise the daily brief.** Group by bucket using `channel_slug`:
   - **AI Visibility / GEO / AEO** — `sejournal`, `neilpatel`, `ahrefs`, `marketing-against-the-grain`
   - **General AI** — `ai-explained`, `matt-wolfe`
   - **Agent of One** — `ai-jason`, `greg-isenberg`, `nick-saraev`, `grace-yeung`, `jeff-su`, `ai-founders`

   **Format — terse. Aim for ~40 words per item.** For each item under each bucket:

   ```
   ### [Title](source_url) — Channel name
   ONE sentence of substance (skip host intro chatter).
   **For you:** ONE sentence of relevance to Found & Trusted, Agent of One, or "general AI awareness."
   ↳ [L2 card](relative_path_from_daily-reviews_to_L2_card)
   ```

   **At the top of the file**, above the buckets, write a single line:

   ```
   **Top of the day:** one sentence picking the single highest-signal item across all buckets and why it matters today.
   ```

   Skip buckets with no items. **Cap total items at 10.** If more than 10 cards were captured, keep the highest-signal items across buckets and append a line: `*+N additional cards in card-catalog — see SECONDBRAIN/youtube-vault/card-catalog/L2/sources/.*`

   **Hard format rules:**
   - URL-encode spaces in L2 card paths as `%20` so Obsidian renders the link.
   - Do NOT pad with extra context, framing, or "notes on this brief" sections. Brief reads tight or it doesn't get read.
   - If a transcript is mostly host chatter / sponsor reads with little substance, the item still gets one terse sentence — don't try to manufacture depth.

6. **Write the brief** to `C:/Users/nkiru/ClaudeCode/SECONDBRAIN/daily-reviews/<DATE>-intel.md` with frontmatter:
   ```
   ---
   date: <DATE>
   source: daily-intel
   card_count: <N>
   channels: [<comma-separated channel_slugs from this run>]
   ---

   # Daily Intel — <TITLE>

   <bucketed body from step 5>
   ```
   If step 2 captured zero sources, write a minimal note: `# Daily Intel — <TITLE>\n\nNo new intel today.`

7. **Send Telegram ping.** Source the main repo-root `.env` (NOT the worktree — gitignored secrets don't get copied into worktrees):
   ```
   set -a
   source "C:/Users/nkiru/GitHub/agent-native-os/.env"
   set +a
   curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
     --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
     --data-urlencode "text=Daily intel ready - <N> new cards. Top: <top item title>. See SECONDBRAIN/daily-reviews/<DATE>-intel.md"
   ```
   Capture `message_id` from the response. Keep the text ASCII — emoji can mangle on this Windows + Bash combo.

8. **Final report**: card count, bucket breakdown, brief path, Telegram message ID.

## Hard rules

- Never print `TELEGRAM_TOKEN` or any other secret to the terminal. Shell variable substitution only.
- Names-only inspection of `.env` files (`grep -oE '^[A-Z_]+=' <file>`). Never `cat` them.
- The blueprint's `enrich.py` writes its own L1 inside `<vault>/cairns/L1/`. That's inside the sub-vault (`SECONDBRAIN/youtube-vault/cairns/L1/`) — it must NOT write to `SECONDBRAIN/cairns/L1/`. The `--vault` flag is the guarantee; do not run `enrich.py` against the main vault root.
- Do not edit `SECONDBRAIN/cairns/L1/` or `SECONDBRAIN/cairns/L1/INDEX.md` from this command. Those are human-curated.
- If `build.py` fails with `yt-dlp` not on PATH, the PATH prepend in step 2 was lost — re-check that it's in the same Bash invocation as the python call.
- If `Sources captured: 0`, do not write garbage — go to step 6 with the "no new intel today" path and still ping Telegram.

## Open issues for v1

- Re-running on the same day re-fetches the same videos (no per-video dedup). Acceptable for v1. Add dedup later if it bites.
- Only one channel (`ai-explained`) is configured in `channels.yaml`. After this command runs end-to-end successfully, expand to the locked 12-channel list.
