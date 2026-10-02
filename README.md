# djt-timeline

Text of Donald Trump's Truth Social posts, for analysis.

## Data source

[CNN's Truth Social archive](https://ix.cnn.io/data/truth-social/truth_archive.json):
every post since Feb 2022, refreshed roughly every 5 minutes. Truth Social's own
API blocks unauthenticated requests (403), so we use this mirror instead.

## Update the data

```sh
python3 download.py
```

No dependencies beyond the Python standard library. Re-run any time to refresh.
It also compares the archive's newest post against the
[trumpstruth.org](https://www.trumpstruth.org/feed) RSS feed and warns if CNN is
lagging (`--no-check` skips this).

## Files

- `data/raw/truth_archive.json`: untouched copy of CNN's archive
- `data/posts.json`: text posts only, oldest first

Each post in `posts.json`:

| field | notes |
|---|---|
| `id` | Truth Social post ID (string) |
| `created_at` | ISO 8601, UTC |
| `text` | post text, HTML entities decoded |
| `is_repost` | `true` if the text starts with `RT ` or `RT:` (a repost of someone else) |
| `url` | link to the post |
| `replies_count`, `reblogs_count`, `favourites_count` | engagement at time of download |

Posts with no text (image/video-only, or bare reposts) are dropped. Media is not kept.

## The game: "When Did He Say It: Iran Edition"

A static site in `docs/` (plain HTML/CSS/JS, no build step). Each round deals 5
random Iran posts at least 14 days apart; the player sorts them oldest to
newest and is scored on how many of the 10 pairs are in the right order.

To rebuild the data and play locally:

```sh
python3 download.py && python3 topics.py && python3 build_game_data.py
cd docs && python3 -m http.server 8765   # then open http://localhost:8765
```

`build_game_data.py` drops reposts, posts containing links (URLs can reveal
the date), very short posts, and duplicate texts. `docs/` is the folder GitHub Pages serves (Settings → Pages →
branch, `/docs`).
