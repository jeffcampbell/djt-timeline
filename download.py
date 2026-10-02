#!/usr/bin/env python3
"""Download Trump's Truth Social posts from CNN's archive and keep only text posts.

Writes:
  data/raw/truth_archive.json  - untouched copy of CNN's archive
  data/posts.json              - text-only posts, oldest first

Usage: python3 download.py [--no-check]
"""
import argparse
import html
import json
import re
import sys
import urllib.request
from email.utils import parsedate_to_datetime
from datetime import datetime
from pathlib import Path

ARCHIVE_URL = "https://ix.cnn.io/data/truth-social/truth_archive.json"
RSS_URL = "https://www.trumpstruth.org/feed"
USER_AGENT = "Mozilla/5.0 (djt-timeline)"

ROOT = Path(__file__).resolve().parent
RAW_PATH = ROOT / "data" / "raw" / "truth_archive.json"
POSTS_PATH = ROOT / "data" / "posts.json"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def parse_time(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


MOJIBAKE_RUN = re.compile(r"[Â-ô][\u0080-¿]+")


def fix_mojibake(text):
    """Repair UTF-8 that was decoded as Latin-1 ("Itâ\\x80\\x99s" -> "It’s")."""
    def repair(m):
        try:
            return m.group(0).encode("latin-1").decode("utf-8")
        except UnicodeError:  # truncated sequence, e.g. a clipped trailing emoji
            return m.group(0).encode("latin-1").decode("utf-8", errors="ignore")
    return MOJIBAKE_RUN.sub(repair, text)


def to_text_post(item):
    text = fix_mojibake(html.unescape(item["content"])).strip()
    if not text:
        return None
    return {
        "id": item["id"],
        "created_at": item["created_at"],
        "text": text,
        "is_repost": text.startswith(("RT ", "RT:")),
        "url": item["url"],
        "replies_count": item.get("replies_count"),
        "reblogs_count": item.get("reblogs_count"),
        "favourites_count": item.get("favourites_count"),
    }


def check_freshness(newest):
    """Warn if trumpstruth.org's RSS has a newer post than CNN's archive."""
    import xml.etree.ElementTree as ET

    try:
        root = ET.fromstring(fetch(RSS_URL))
        dates = [parsedate_to_datetime(e.text) for e in root.iter("pubDate")]
    except Exception as e:
        print(f"freshness check skipped: {e}", file=sys.stderr)
        return
    if not dates:
        print("freshness check skipped: no dates in RSS feed", file=sys.stderr)
        return
    rss_newest = max(dates)
    lag = rss_newest - newest
    if lag.total_seconds() > 0:
        print(f"WARNING: CNN archive is {lag} behind trumpstruth.org RSS "
              f"(RSS newest {rss_newest.isoformat()})", file=sys.stderr)
    else:
        print("freshness check: CNN archive is up to date with RSS")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--no-check", action="store_true",
                    help="skip comparing against the trumpstruth.org RSS feed")
    args = ap.parse_args()

    print(f"downloading {ARCHIVE_URL} ...")
    raw = fetch(ARCHIVE_URL)
    archive = json.loads(raw)

    RAW_PATH.parent.mkdir(parents=True, exist_ok=True)
    RAW_PATH.write_bytes(raw)

    posts = [p for p in map(to_text_post, archive) if p]
    posts.sort(key=lambda p: parse_time(p["created_at"]))
    POSTS_PATH.write_text(json.dumps(posts, ensure_ascii=False, indent=1))

    reposts = sum(p["is_repost"] for p in posts)
    print(f"archive: {len(archive)} posts")
    print(f"kept:    {len(posts)} text posts ({reposts} reposts), "
          f"dropped {len(archive) - len(posts)} with no text")
    print(f"range:   {posts[0]['created_at']} -> {posts[-1]['created_at']}")
    print(f"wrote    {POSTS_PATH.relative_to(ROOT)}")

    if not args.no_check:
        check_freshness(parse_time(posts[-1]["created_at"]))


if __name__ == "__main__":
    main()
