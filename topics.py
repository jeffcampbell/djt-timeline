#!/usr/bin/env python3
"""Split data/posts.json into per-topic files: data/topics/<name>.json.

Run after download.py. Add a topic by adding an entry to TOPICS.

Usage: python3 topics.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
POSTS_PATH = ROOT / "data" / "posts.json"
TOPICS_DIR = ROOT / "data" / "topics"

TOPICS = {
    # Iran, Iranian(s), IRAN... Not word-bounded because reposts often glue
    # words together ("realDonaldTrumpIran") and URLs use slugs ("_iran_").
    # Excludes Miranda / Miran. Also catches indirect references by
    # Tehran, Khamenei, or Ayatollah.
    "iran": re.compile(r"(?<!m)iran(?!da)|tehran|khamenei|ayatollah", re.I),
}


def main():
    posts = json.loads(POSTS_PATH.read_text())
    TOPICS_DIR.mkdir(parents=True, exist_ok=True)
    for name, pattern in TOPICS.items():
        matched = [p for p in posts if pattern.search(p["text"])]
        out = TOPICS_DIR / f"{name}.json"
        out.write_text(json.dumps(matched, ensure_ascii=False, indent=1))
        reposts = sum(p["is_repost"] for p in matched)
        print(f"{name}: {len(matched)} posts ({reposts} reposts) -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
