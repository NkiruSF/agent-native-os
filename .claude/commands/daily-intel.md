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

2. **Run the capture pipeline** from the main repo root, with PATH prepended. Print a progress marker before and after:
   ```
   echo "[daily-intel] Step 2: capture starting"
   export PATH="/c/Users/nkiru/AppData/Local/Programs/Python/Python310/Scripts:$PATH"
   cd "C:/Users/nkiru/GitHub/agent-native-os/blueprints/youtube-cairns"
   "/c/Users/nkiru/AppData/Local/Programs/Python/Python310/python.exe" pipeline/build.py \
     --config pipeline/channels.yaml \
     --vault "C:/Users/nkiru/ClaudeCode/SECONDBRAIN/youtube-vault" \
     --since-days 14
   "/c/Users/nkiru/AppData/Local/Programs/Python/Python310/python.exe" pipeline/enrich.py \
     --vault "C:/Users/nkiru/ClaudeCode/SECONDBRAIN/youtube-vault"
   echo "[daily-intel] Step 2: capture complete"
   ```
   Capture stdout. If `Sources captured: 0`, skip to step 6 with "no new intel today."

3. **Read the manifest** to know what was captured this run:
   - `echo "[daily-intel] Step 3: reading manifest"`
   - Read `C:/Users/nkiru/ClaudeCode/SECONDBRAIN/youtube-vault/manifests/sources.json` — this file contains ONLY this run's captures. Each row has `obsidian_path`, `title`, `url`, `channel_slug`, `channel_name`, `video_id`.
   - If the manifest has more than 12 rows, pre-rank by signal density (title + channel relevance to AI Visibility / Agent of One first, then General AI) and pick the **top 12 candidates** before step 4. This keeps context bounded.

4. **Read the top candidate L3 transcripts** (max 12) referenced from step 3:
   - `echo "[daily-intel] Step 4: reading <N> transcripts"`
   - For each candidate row, read `<vault>/<obsidian_path>` using `Read` with `limit: 800`. That caps each file at ~800 lines of captions (≈10–15 min of video — well past the substantive content for most channels).
   - The transcript body follows the `## Transcript` heading.

5. **Synthesise the daily brief.** `echo "[daily-intel] Step 5: synthesising"`. Group by bucket using `channel_slug`:
   - **AI Visibility / GEO / AEO** — `sejournal`, `neilpatel`, `ahrefs`, `marketing-against-the-grain`
   - **General AI** — `ai-explained`, `matt-wolfe`
   - **Agent of One** — `ai-jason`, `greg-isenberg`, `nick-saraev`, `grace-leung`, `jeff-su`, `ai-founders`

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

6. **Write the brief** (`echo "[daily-intel] Step 6: writing brief"`) to `C:/Users/nkiru/ClaudeCode/SECONDBRAIN/daily-reviews/<DATE>-intel.md` with frontmatter:
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

7. **Insert into Supabase `intel_sections`** so the morning-brief routine can pick it up tomorrow. Project: `cxxquxhgcbddxjxbqgcc`. Use the Supabase MCP `execute_sql` tool with `ON CONFLICT (brief_date) DO UPDATE` so same-day reruns overwrite cleanly. Use dollar-quoting (`$intel$...$intel$`) for the `summary_md` text so markdown apostrophes don't break the SQL.

   The `summary_md` value is the markdown body of the brief WITHOUT the YAML frontmatter — start at the `# Daily Intel —` heading and include everything below it.

   ```sql
   INSERT INTO public.intel_sections (brief_date, summary_md, card_count, channels, top_item_title)
   VALUES ('<DATE>', $intel$<MARKDOWN BODY>$intel$, <N>, ARRAY[<channel_slugs>], '<TOP ITEM TITLE>')
   ON CONFLICT (brief_date) DO UPDATE
   SET summary_md = EXCLUDED.summary_md,
       card_count = EXCLUDED.card_count,
       channels = EXCLUDED.channels,
       top_item_title = EXCLUDED.top_item_title,
       updated_at = now()
   RETURNING brief_date;
   ```

   If step 2 captured zero sources, still insert a row with `summary_md` = "No new intel today." and `card_count` = 0 — the morning-brief routine needs a deterministic row to read.

8. **Final report**: card count (captured + read), bucket breakdown, brief path, Supabase row written. **No Telegram ping** — morning-brief now delivers the intel as a section of its daily brief (~1-day lag).

## Hard rules

- Never print secrets to the terminal. Use Supabase MCP `execute_sql` for the database write — do not curl Supabase REST endpoints with the service key.
- The blueprint's `enrich.py` writes its own L1 inside `<vault>/cairns/L1/`. That's inside the sub-vault (`SECONDBRAIN/youtube-vault/cairns/L1/`) — it must NOT write to `SECONDBRAIN/cairns/L1/`. The `--vault` flag is the guarantee; do not run `enrich.py` against the main vault root.
- Do not edit `SECONDBRAIN/cairns/L1/` or `SECONDBRAIN/cairns/L1/INDEX.md` from this command. Those are human-curated.
- If `build.py` fails with `yt-dlp` not on PATH, the PATH prepend in step 2 was lost — re-check that it's in the same Bash invocation as the python call.
- If `Sources captured: 0`, still write the vault file AND insert the Supabase row with "No new intel today." — the morning-brief routine needs a deterministic row.

## Open issues

- Re-running on the same day re-fetches the same videos (no per-video dedup). `ON CONFLICT` on the Supabase write handles same-day reruns cleanly. Add per-video dedup later if it bites.
- Some channels surface old videos in "latest" listing; the `--since-days 14` filter mitigates but doesn't fully fix. Watch for this in capture issues.
