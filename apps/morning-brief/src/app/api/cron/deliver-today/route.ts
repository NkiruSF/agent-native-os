import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegramMessage, formatBriefPing } from "@/lib/telegram";

// GET /api/cron/deliver-today
// Triggered by Vercel cron (see vercel.json). Reads today's most-recent brief
// from Supabase, sends it to Telegram, logs the delivery.
//
// Architecture context: the Anthropic morning-brief routine writes the brief to
// Supabase via the Supabase MCP (no outbound HTTP, sandbox-safe). This endpoint
// runs inside Vercel and handles the Telegram leg, since Vercel-internal traffic
// has the env vars and bypasses the cloud-IP / sandbox issues that block the
// remote routine from making outbound HTTPS calls.
export async function GET() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

  try {
    const sb = supabaseAdmin();
    const { data: brief, error } = await sb
      .from("briefs")
      .select("*")
      .eq("date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !brief) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? `no brief found for ${today}` },
        { status: 404 }
      );
    }

    const text = formatBriefPing({
      date: brief.date,
      title: brief.title,
      top_priority: brief.top_priority,
    });
    const result = await sendTelegramMessage(text);

    try {
      await sb.from("delivery_logs").insert({
        channel: "telegram",
        brief_id: brief.id,
        ok: result.ok,
        error: result.error ?? null,
        payload: { text, message_id: result.message_id, source: "vercel_cron" },
      });
    } catch {
      /* swallow log errors */
    }

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }
    return NextResponse.json({ ok: true, brief_id: brief.id, message_id: result.message_id });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "delivery failed" },
      { status: 500 }
    );
  }
}
