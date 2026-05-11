#!/usr/bin/env python3
"""Build L3 transcript notes from public YouTube captions."""
from __future__ import annotations
import argparse
import html
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
DEMO_ID = "youtube-cairns-blueprint"
def slugify(value: str, limit: int = 80) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return (value or "untitled")[:limit].strip("-")
def yaml_scalar(value: object) -> str:
    return json.dumps("" if value is None else str(value))
def parse_simple_yaml(path: Path) -> list[dict]:
    channels: list[dict] = []
    current: dict | None = None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip() or line.strip() == "channels:":
            continue
        stripped = line.strip()
        if stripped.startswith("- "):
            if current:
                channels.append(current)
            current = {}
            stripped = stripped[2:].strip()
        if ":" in stripped and current is not None:
            key, value = stripped.split(":", 1)
            current[key.strip()] = value.strip().strip("\"'")
    if current:
        channels.append(current)
    return channels
def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=False, capture_output=True, text=True)
def list_videos(channel: dict, default_limit: int) -> list[dict]:
    limit = int(channel.get("max_videos") or default_limit)
    cmd = [
        "yt-dlp",
        "--flat-playlist",
        "--dump-json",
        "--playlist-end",
        str(limit),
        channel["url"],
    ]
    result = run(cmd)
    if result.returncode != 0:
        print(f"Could not list {channel['slug']}: {result.stderr.strip()}", file=sys.stderr)
        return []
    rows = []
    for line in result.stdout.splitlines():
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            continue
        video_id = data.get("id")
        if not video_id:
            continue
        url = data.get("url") or data.get("webpage_url") or f"https://www.youtube.com/watch?v={video_id}"
        if not str(url).startswith("http"):
            url = f"https://www.youtube.com/watch?v={video_id}"
        rows.append({"video_id": video_id, "title": data.get("title") or video_id, "url": url})
    return rows
def vtt_to_text(path: Path) -> str:
    lines: list[str] = []
    previous = ""
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line == "WEBVTT" or "-->" in line or line.startswith(("NOTE", "Kind:", "Language:")):
            continue
        line = re.sub(r"<[^>]+>", "", line)
        line = re.sub(r"\s+", " ", html.unescape(line)).strip()
        if line and line != previous:
            lines.append(line)
            previous = line
    return "\n".join(lines).strip()
def fetch_caption(video: dict, channel: dict, work_dir: Path) -> tuple[dict, str] | None:
    caption_dir = work_dir / "captions"
    caption_dir.mkdir(parents=True, exist_ok=True)
    output = caption_dir / "%(id)s.%(ext)s"
    cmd = [
        "yt-dlp",
        "--skip-download",
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        "en.*",
        "--sub-format",
        "vtt",
        "--dump-json",
        "--no-simulate",
        "-o",
        str(output),
        video["url"],
    ]
    result = run(cmd)
    if result.returncode != 0:
        print(f"Could not fetch captions for {video['video_id']}: {result.stderr.strip()}", file=sys.stderr)
        return None
    meta = {}
    for line in result.stdout.splitlines():
        try:
            meta = json.loads(line)
        except json.JSONDecodeError:
            pass
    vtt_files = sorted(caption_dir.glob(f"{video['video_id']}*.vtt"))
    if not vtt_files:
        print(f"No English captions found for {video['video_id']}", file=sys.stderr)
        return None
    text = vtt_to_text(vtt_files[0])
    if not text:
        print(f"Empty caption text for {video['video_id']}", file=sys.stderr)
        return None
    meta.setdefault("id", video["video_id"])
    meta.setdefault("title", video["title"])
    meta.setdefault("webpage_url", video["url"])
    meta.setdefault("channel", channel.get("name") or channel["slug"])
    return meta, text
def transcript_note(row: dict, body: str) -> str:
    frontmatter = {
        "demo_id": row["demo_id"],
        "layer": "L3",
        "source_type": "youtube_transcript",
        "source_id": row["source_id"],
        "video_id": row["video_id"],
        "channel_slug": row["channel_slug"],
        "channel_name": row["channel_name"],
        "url": row["url"],
        "captured_at": row["captured_at"],
    }
    fm = "\n".join(f"{key}: {yaml_scalar(value)}" for key, value in frontmatter.items())
    return f"""---
{fm}
---
# {row["title"]}
**Channel:** {row["channel_name"]}
**URL:** {row["url"]}
**Video ID:** `{row["video_id"]}`
## Transcript
{body}
"""
def write_source(vault: Path, channel: dict, meta: dict, body: str) -> dict:
    video_id = meta.get("id")
    title = meta.get("title") or video_id
    channel_slug = channel["slug"]
    note_name = f"{video_id} - {slugify(title)}.md"
    rel_path = Path("raw") / "transcripts" / channel_slug / note_name
    captured_at = datetime.now(timezone.utc).isoformat()
    row = {
        "demo_id": DEMO_ID,
        "source_id": f"{channel_slug}-{video_id}",
        "video_id": video_id,
        "title": title,
        "channel_name": channel.get("name") or meta.get("channel") or channel_slug,
        "channel_slug": channel_slug,
        "url": meta.get("webpage_url") or f"https://www.youtube.com/watch?v={video_id}",
        "duration_seconds": int(meta.get("duration") or 0),
        "upload_date": meta.get("upload_date") or "",
        "word_count": len(body.split()),
        "obsidian_path": rel_path.as_posix(),
        "captured_at": captured_at,
    }
    target = vault / rel_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(transcript_note(row, body), encoding="utf-8")
    return row
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=Path("pipeline/channels.yaml"))
    parser.add_argument("--vault", type=Path, default=Path("vault"))
    parser.add_argument("--max-videos", type=int, default=3)
    parser.add_argument("--work-dir", type=Path, default=Path(".cairns-work"))
    parser.add_argument("--since-days", type=int, default=None, help="Skip videos uploaded more than N days ago. Default: no filter.")
    args = parser.parse_args()
    cutoff_yyyymmdd = None
    if args.since_days is not None:
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=args.since_days)
        cutoff_yyyymmdd = cutoff.strftime("%Y%m%d")
    if not shutil.which("yt-dlp"):
        raise SystemExit("yt-dlp is required. Install it with: brew install yt-dlp")
    if not args.config.exists():
        raise SystemExit(f"Missing channel config: {args.config}")
    args.vault.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []
    for channel in parse_simple_yaml(args.config):
        if channel.get("status", "active") != "active":
            continue
        if not channel.get("slug") or not channel.get("url"):
            print(f"Skipping incomplete channel config: {channel}", file=sys.stderr)
            continue
        print(f"Scanning {channel['slug']}")
        for video in list_videos(channel, args.max_videos):
            fetched = fetch_caption(video, channel, args.work_dir)
            if not fetched:
                continue
            meta, body = fetched
            if cutoff_yyyymmdd and (meta.get("upload_date") or "") < cutoff_yyyymmdd:
                print(f"Skipped (older than --since-days): {video['video_id']} uploaded {meta.get('upload_date')}", file=sys.stderr)
                continue
            row = write_source(args.vault, channel, meta, body)
            rows.append(row)
            print(f"Wrote L3 {row['obsidian_path']}")
    manifest_dir = args.vault / "manifests"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    (manifest_dir / "sources.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    (manifest_dir / "sources.jsonl").write_text("\n".join(json.dumps(row) for row in rows), encoding="utf-8")
    print(f"Sources captured: {len(rows)}")
    print(f"Manifest: {manifest_dir / 'sources.json'}")
if __name__ == "__main__":
    main()
