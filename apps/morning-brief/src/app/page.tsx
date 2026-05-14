import { supabaseAdmin } from "@/lib/supabase";
import { marked } from "marked";

export const dynamic = "force-dynamic";

// The routine writes sections as a structured object, not the flat array in the contract.
// These types reflect what's actually stored.
type TimeSensitiveItem = { action?: string; subject?: string; sender?: string; source?: string; title?: string; detail?: string };
type FyiItem = { note?: string; subject?: string; sender?: string; source?: string; title?: string; detail?: string };
type CalendarItem = { time?: string; summary?: string };
type SkippedInfo = { count?: number; senders?: string[] };
type WhatToWatch = { summary_md?: string; card_count?: number; top_item_title?: string; brief_date?: string };

type RichSections = {
  time_sensitive?: TimeSensitiveItem[];
  fyi?: FyiItem[];
  calendar?: CalendarItem[];
  skipped?: SkippedInfo;
  what_to_watch?: WhatToWatch;
};

type RichBrief = {
  id: string;
  date: string;
  title: string;
  summary?: string | null;
  top_priority?: string | null;
  sections?: RichSections | null;
  source_status?: Record<string, { ok: boolean; threads?: number; events?: number }> | null;
  created_at: string;
};

type DeliveryLog = { id: string; channel: string; ok: boolean; created_at: string; error: string | null };

type PageData = {
  latest: RichBrief | null;
  recent: RichBrief[];
  deliveries: DeliveryLog[];
};

async function loadData(): Promise<PageData> {
  try {
    const sb = supabaseAdmin();
    const [briefsRes, deliveryRes] = await Promise.all([
      sb.from("briefs").select("*").order("date", { ascending: false }).limit(8),
      sb.from("delivery_logs").select("id, channel, ok, created_at, error").order("created_at", { ascending: false }).limit(10),
    ]);
    const briefs = (briefsRes.data ?? []) as RichBrief[];
    return { latest: briefs[0] ?? null, recent: briefs.slice(1), deliveries: deliveryRes.data ?? [] };
  } catch {
    return { latest: null, recent: [], deliveries: [] };
  }
}

export default async function Page() {
  const { latest, recent, deliveries } = await loadData();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
      <section>
        <div className="section-label">brief of the day</div>
        <h1 className="section-title">
          Today&apos;s <span className="highlight">morning brief</span>.
        </h1>
        <p className="section-sub">
          Sources collapse into one short ping plus one full write-up. Fires automatically at 7am London time.
        </p>
        {latest ? <BriefCard brief={latest} /> : <EmptyBriefCard />}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "1.4rem" }}>
        <SourceRegistry brief={latest} />
        <DeliveryLogPanel deliveries={deliveries} />
      </section>

      <section>
        <div className="section-label">run timeline</div>
        <h2 className="section-title">Recent briefs</h2>
        <p className="section-sub">The last eight runs.</p>
        <RunTimeline briefs={latest ? [latest, ...recent] : recent} />
      </section>
    </div>
  );
}

function BriefCard({ brief }: { brief: RichBrief }) {
  const sections = brief.sections ?? {};
  const timeSensitive = sections.time_sensitive ?? [];
  const fyi = sections.fyi ?? [];
  const calendar = sections.calendar ?? [];
  const skipped = sections.skipped;
  const whatToWatch = sections.what_to_watch;

  return (
    <div className="file-tab-card tilt-left" style={{ marginTop: "1.6rem" }}>
      <div className="file-tab">BRIEF / {brief.date}</div>
      <h2 className="font-display" style={{ fontSize: "1.85rem", marginBottom: "0.6rem" }}>{brief.title}</h2>

      {brief.summary && (
        <p style={{ color: "var(--ink-2)", marginBottom: "1rem" }}>{brief.summary}</p>
      )}

      {brief.top_priority && (
        <div style={{ background: "var(--paper-2)", border: "2px solid var(--border)", padding: "0.75rem 0.9rem", marginBottom: "1.4rem" }}>
          <div className="font-mono" style={{ fontSize: "0.62rem", color: "var(--caution)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>
            Top priority
          </div>
          <div style={{ fontWeight: 600 }}>{brief.top_priority}</div>
        </div>
      )}

      {timeSensitive.length > 0 && (
        <div style={{ marginBottom: "1.2rem" }}>
          <h3 className="font-display" style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>⚡ Time-sensitive</h3>
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {timeSensitive.map((item, i) => (
              <li key={i} style={{ borderLeft: "3px solid var(--caution)", paddingLeft: "0.75rem" }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{item.title ?? item.subject}</div>
                {item.action && <div style={{ color: "var(--ink-2)", fontSize: "0.85rem" }}>{item.action}</div>}
                {item.detail && <div style={{ color: "var(--ink-2)", fontSize: "0.85rem" }}>{item.detail}</div>}
                {item.sender && <div className="font-mono" style={{ fontSize: "0.7rem", color: "var(--ink-3)" }}>{item.sender}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {calendar.length > 0 && (
        <div style={{ marginBottom: "1.2rem" }}>
          <h3 className="font-display" style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>📅 Calendar</h3>
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {calendar.map((ev, i) => (
              <li key={i} style={{ display: "flex", gap: "0.75rem", fontSize: "0.9rem" }}>
                {ev.time && <span className="font-mono" style={{ color: "var(--caution)", minWidth: "3.5rem" }}>{ev.time}</span>}
                <span>{ev.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {fyi.length > 0 && (
        <div style={{ marginBottom: "1.2rem" }}>
          <h3 className="font-display" style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>FYI</h3>
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {fyi.map((item, i) => (
              <li key={i} style={{ borderLeft: "3px solid var(--border)", paddingLeft: "0.75rem" }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{item.title ?? item.subject}</div>
                {(item.note ?? item.detail) && <div style={{ color: "var(--ink-2)", fontSize: "0.85rem" }}>{item.note ?? item.detail}</div>}
                {item.sender && <div className="font-mono" style={{ fontSize: "0.7rem", color: "var(--ink-3)" }}>{item.sender}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {whatToWatch?.summary_md && (
        <div style={{ marginTop: "1.4rem", paddingTop: "1.2rem", borderTop: "2px solid var(--border)" }}>
          <h3 className="font-display" style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>📺 What I should watch</h3>
          {whatToWatch.brief_date && (
            <div className="font-mono" style={{ fontSize: "0.7rem", color: "var(--ink-3)", marginBottom: "0.6rem" }}>
              From daily-intel run on {whatToWatch.brief_date} · {whatToWatch.card_count ?? 0} cards captured
            </div>
          )}
          <div
            className="intel-markdown"
            style={{ color: "var(--ink-2)", fontSize: "0.9rem", lineHeight: 1.55 }}
            dangerouslySetInnerHTML={{ __html: marked.parse(whatToWatch.summary_md, { async: false }) as string }}
          />
        </div>
      )}

      {skipped && (skipped.count ?? 0) > 0 && (
        <div className="font-mono" style={{ fontSize: "0.72rem", color: "var(--ink-3)", borderTop: "1px dashed var(--ink-3)", paddingTop: "0.6rem", marginTop: "1rem" }}>
          {skipped.count} items skipped ({(skipped.senders ?? []).slice(0, 4).join(", ")}{(skipped.senders?.length ?? 0) > 4 ? ` +${(skipped.senders?.length ?? 0) - 4} more` : ""})
        </div>
      )}
    </div>
  );
}

function EmptyBriefCard() {
  return (
    <div className="file-tab-card tilt-right" style={{ marginTop: "1.6rem" }}>
      <div className="file-tab">BRIEF / waiting</div>
      <h2 className="font-display" style={{ fontSize: "1.6rem", marginBottom: "0.5rem" }}>No briefs yet.</h2>
      <p style={{ color: "var(--ink-2)" }}>The brief fires automatically at 7am London time. Check back then.</p>
    </div>
  );
}

function SourceRegistry({ brief }: { brief: RichBrief | null }) {
  const sourceObj = brief?.source_status ?? {};
  const sources = Object.entries(sourceObj).map(([name, info]) => ({
    name,
    ok: info?.ok ?? false,
    count: info?.threads ?? info?.events ?? 0,
  }));

  if (sources.length === 0) {
    sources.push(
      { name: "gmail", ok: false, count: 0 },
      { name: "calendar", ok: false, count: 0 },
    );
  }

  return (
    <div className="file-tab-card tilt-right">
      <div className="file-tab">SOURCES / registry</div>
      <h3 className="font-display" style={{ fontSize: "1.2rem", marginBottom: "0.7rem" }}>Source registry</h3>
      <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        {sources.map((s) => (
          <li key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed var(--ink-3)", paddingBottom: "0.35rem" }}>
            <span className="font-mono" style={{ fontSize: "0.78rem" }}>{s.name}</span>
            <span className={`status-pill ${s.ok ? "ok" : "muted"}`}>
              {s.ok ? `${s.count} items` : "off"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeliveryLogPanel({ deliveries }: { deliveries: DeliveryLog[] }) {
  return (
    <div className="file-tab-card tilt-left">
      <div className="file-tab">DELIVERY / log</div>
      <h3 className="font-display" style={{ fontSize: "1.2rem", marginBottom: "0.7rem" }}>Delivery log</h3>
      {deliveries.length === 0 ? (
        <p className="font-mono" style={{ fontSize: "0.75rem", color: "var(--ink-3)" }}>No pings sent yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          {deliveries.map((d) => (
            <li key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed var(--ink-3)", paddingBottom: "0.35rem" }}>
              <span className="font-mono" style={{ fontSize: "0.72rem" }}>
                {new Date(d.created_at).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {d.channel}
              </span>
              <span className={`status-pill ${d.ok ? "ok" : "warn"}`}>{d.ok ? "sent" : "failed"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RunTimeline({ briefs }: { briefs: RichBrief[] }) {
  if (briefs.length === 0) {
    return (
      <div className="terminal">
        <h3>$ briefs --recent</h3>
        <p>No briefs yet.</p>
      </div>
    );
  }
  return (
    <div className="terminal">
      <h3>$ briefs --recent</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {briefs.map((b, i) => (
          <li key={b.id + i} style={{ padding: "0.25rem 0", borderBottom: "1px dashed #2a2a2a" }}>
            <span style={{ color: "var(--lime)" }}>{b.date}</span>
            <span style={{ color: "#aaa" }}> · </span>
            <span>{b.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
