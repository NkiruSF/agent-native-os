import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Morning Brief",
  description: "Your agent-native morning brief. Built at AI Build Lab.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header
          style={{
            borderBottom: "2px solid var(--border)",
            background: "rgba(245,242,235,.93)",
            padding: "0.72rem 0",
          }}
        >
          <div
            style={{
              maxWidth: 1220,
              margin: "0 auto",
              padding: "0 1.35rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <a className="brand-logo" href="/" aria-label="AI Build Lab home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/aibuildlab-logo.svg"
                alt="AI Build Lab"
              />
            </a>
            <span className="kicker">
              <span className="live-dot" />
              MORNING BRIEF / capstone build
            </span>
          </div>
        </header>
        <main style={{ maxWidth: 1220, margin: "0 auto", padding: "2.4rem 1.35rem 4rem" }}>{children}</main>
        <footer
          style={{
            background: "#000",
            color: "#E8EAED",
            borderTop: "3px solid var(--border)",
            padding: "2rem 1.35rem",
            textAlign: "center",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: ".72rem",
            lineHeight: 1.45,
          }}
        >
          Built at AI Build Lab. Field-manual aesthetic. Field-tested code.
        </footer>
      </body>
    </html>
  );
}
