---
description: Compile today's morning brief from Gmail + Calendar, persist to Supabase, deliver to Telegram.
---

Run the manual morning brief flow end-to-end. Same pattern we proved twice - read sources via MCP, insert to Supabase via MCP execute_sql, deliver to Telegram via the bot API.

## Steps

1. Compute today's date in Europe/London timezone (Bash):
   - `TZ=Europe/London date +%Y-%m-%d` for the date field.
   - `TZ=Europe/London date +'%a, %b %-d, %Y'` for the title.

2. Fetch today's calendar events via the Google Calendar MCP `list_events` tool:
   - startTime: `<DATE>T00:00:00`
   - endTime: `<DATE>T23:59:59`
   - timeZone: `Europe/London`
   - orderBy: `startTime`

3. Fetch recent Gmail via the Gmail MCP `search_threads` tool:
   - query: `in:inbox newer_than:2d -subject:"Telegram bot"`
   - pageSize: `15`

3b. **Fetch the latest daily intel** from Supabase via `execute_sql` (project `cxxquxhgcbddxjxbqgcc`):
   ```sql
   SELECT brief_date, summary_md, card_count, top_item_title
   FROM public.intel_sections
   ORDER BY brief_date DESC
   LIMIT 1;
   ```
   Store the result as `intel`. If no row, `intel = null`. Note: the daily-intel pipeline runs at 8am London — after this brief fires at 7am — so `intel` will normally be the previous day's run. That is expected and fine: one-day lag is by design.

4. Compile a brief object filtered through Nkiru's priorities (per CLAUDE.md):
   - **Skip:** newsletters, marketing, automated security alerts, OAuth notices.
   - **Time-Sensitive section:** items needing response today, hard deadlines, final-call language.
   - **FYI section:** items relevant to Found & Trusted, Barnardo's, or Nkiru's stated priorities.
   - **top_priority:** the single most important decision or action for today.
   - **Skipped section:** count + senders.
   - **what_to_watch section:** if `intel` is non-null, include:
     ```
     what_to_watch: {
       summary_md: <intel.summary_md>,
       card_count: <intel.card_count>,
       top_item_title: <intel.top_item_title>,
       brief_date: <intel.brief_date>
     }
     ```
     If `intel` is null, omit `what_to_watch` entirely.

5. **Critical security rule:** never include raw API tokens, JWT strings, or bot tokens from email snippets. If you see anything that looks like a credential, write "filtered N self-sent items containing credentials" without quoting.

6. Insert into Supabase via the Supabase MCP `execute_sql` tool. Project ID: `cxxquxhgcbddxjxbqgcc`. Table: `public.briefs`. Use dollar-quoting (`$brief$...$brief$`) so apostrophes in body text don't need escaping. RETURNING id so the brief ID is captured.

7. Send Telegram delivery via Bash. Source the repo-root `.env` first to load `TELEGRAM_TOKEN` and `TELEGRAM_CHAT_ID`. Then:
   ```
   curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
     --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
     --data-urlencode "text=<short summary with title, top priority, brief ID>"
   ```
   Capture the `message_id` from the response.

8. Update the brief's `delivery_status` and insert a row into `public.delivery_logs` (channel=telegram, ok=true, brief_id, payload with message_id) via Supabase MCP execute_sql.

9. Report a final summary: brief ID, Telegram message ID, and the top priority for today.

## Hard rules
- Never print secret values (TELEGRAM_TOKEN, service_role keys, etc) to the terminal. Use shell variable substitution.
- Never use `cat`, `cat -A`, `head`, or `tail` on `.env` or `apps/morning-brief/.env.local`. Names-only inspection only: `grep -oE '^[A-Z_]+=' <file>`.
- Use the Supabase MCP for database writes. Do NOT curl the Vercel `/api/briefs` endpoint - the Supabase MCP path is faster and avoids unnecessary network hops.
