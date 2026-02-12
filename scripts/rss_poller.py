#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass(frozen=True)
class FetchResult:
  status: int
  headers: Dict[str, str]
  body: bytes


def _utc_now() -> datetime:
  return datetime.now(timezone.utc)


def _isoformat(dt: datetime) -> str:
  if dt.tzinfo is None:
    dt = dt.replace(tzinfo=timezone.utc)
  return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_date(value: Optional[str]) -> Optional[datetime]:
  if not value:
    return None
  value = value.strip()
  if not value:
    return None

  # RFC 822 / RFC 1123 (RSS <pubDate>)
  try:
    dt = parsedate_to_datetime(value)
    if dt.tzinfo is None:
      dt = dt.replace(tzinfo=timezone.utc)
    return dt
  except Exception:
    pass

  # ISO 8601 (Atom <updated>/<published>)
  try:
    # Handle trailing "Z"
    if value.endswith("Z"):
      value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
      dt = dt.replace(tzinfo=timezone.utc)
    return dt
  except Exception:
    return None


def _get_text(el: Optional[ET.Element]) -> Optional[str]:
  if el is None or el.text is None:
    return None
  text = el.text.strip()
  return text or None


def _strip_ns(tag: str) -> str:
  # "{namespace}tag" -> "tag"
  if tag.startswith("{") and "}" in tag:
    return tag.split("}", 1)[1]
  return tag


def _child(el: ET.Element, name: str) -> Optional[ET.Element]:
  for c in list(el):
    if _strip_ns(c.tag) == name:
      return c
  return None


def _children(el: ET.Element, name: str) -> List[ET.Element]:
  return [c for c in list(el) if _strip_ns(c.tag) == name]


def fetch_url(
  url: str,
  *,
  user_agent: str,
  timeout_seconds: int,
  etag: Optional[str] = None,
  last_modified: Optional[str] = None,
) -> FetchResult:
  headers: Dict[str, str] = {
    "User-Agent": user_agent,
    "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  }
  if etag:
    headers["If-None-Match"] = etag
  if last_modified:
    headers["If-Modified-Since"] = last_modified

  req = urllib.request.Request(url, headers=headers, method="GET")
  try:
    with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
      body = resp.read()
      resp_headers = {k.lower(): v for (k, v) in resp.headers.items()}
      return FetchResult(status=int(resp.status), headers=resp_headers, body=body)
  except urllib.error.HTTPError as e:
    resp_headers = {k.lower(): v for (k, v) in e.headers.items()} if e.headers else {}
    body = e.read() if hasattr(e, "read") else b""
    return FetchResult(status=int(e.code), headers=resp_headers, body=body)


def _guess_source_site(feed_url: str) -> str:
  host = urllib.parse.urlparse(feed_url).hostname or "unknown"
  host = host.lower()
  # "vnexpress.net" -> "vnexpress"
  parts = host.split(".")
  if len(parts) >= 2:
    return parts[-2]
  return host


def parse_feed(xml_bytes: bytes, *, feed_url: str) -> Tuple[str, List[Dict[str, Any]]]:
  root = ET.fromstring(xml_bytes)
  root_name = _strip_ns(root.tag).lower()

  if root_name == "rss":
    channel = _child(root, "channel")
    if channel is None:
      return ("rss", [])
    items = []
    for item in _children(channel, "item"):
      title = _get_text(_child(item, "title"))
      link = _get_text(_child(item, "link"))
      guid = _get_text(_child(item, "guid"))
      pub_date = _get_text(_child(item, "pubDate"))
      categories = [_get_text(c) for c in _children(item, "category")]
      categories = [c for c in categories if c]

      published_at = _parse_date(pub_date) or _utc_now()
      if not link or not title:
        continue

      items.append(
        {
          "sourceSite": _guess_source_site(feed_url),
          "sourceCategory": categories[0] if categories else None,
          "guid": guid,
          "url": link,
          "title": title,
          "publishedAt": _isoformat(published_at),
          "categories": categories,
        }
      )
    return ("rss", items)

  if root_name == "feed":  # Atom
    items = []
    for entry in _children(root, "entry"):
      title = _get_text(_child(entry, "title"))
      entry_id = _get_text(_child(entry, "id"))

      published = _get_text(_child(entry, "published"))
      updated = _get_text(_child(entry, "updated"))
      published_at = _parse_date(published) or _parse_date(updated) or _utc_now()

      # Atom: link can be in <link href="..."> with rel="alternate"
      link_url = None
      for link in _children(entry, "link"):
        rel = (link.attrib.get("rel") or "alternate").lower()
        href = link.attrib.get("href")
        if rel == "alternate" and href:
          link_url = href
          break
      if not link_url:
        # Fallback to any href
        for link in _children(entry, "link"):
          href = link.attrib.get("href")
          if href:
            link_url = href
            break

      categories = []
      for cat in _children(entry, "category"):
        term = cat.attrib.get("term")
        if term:
          categories.append(term)

      if not link_url or not title:
        continue

      items.append(
        {
          "sourceSite": _guess_source_site(feed_url),
          "sourceCategory": categories[0] if categories else None,
          "guid": entry_id,
          "url": link_url,
          "title": title,
          "publishedAt": _isoformat(published_at),
          "categories": categories,
        }
      )
    return ("atom", items)

  return (root_name, [])


def post_ingest(
  *,
  ingest_url: str,
  internal_api_key: str,
  timeout_seconds: int,
  items: List[Dict[str, Any]],
  source_site_override: Optional[str],
) -> Dict[str, Any]:
  payload_items = []
  for it in items:
    payload_items.append(
      {
        "sourceSite": source_site_override or it["sourceSite"],
        "sourceCategory": it.get("sourceCategory"),
        "guid": it.get("guid"),
        "url": it["url"],
        "title": it["title"],
        "publishedAt": it["publishedAt"],
      }
    )

  body = json.dumps({"articles": payload_items}).encode("utf-8")
  req = urllib.request.Request(
    ingest_url,
    data=body,
    headers={
      "Content-Type": "application/json",
      "X-Internal-Api-Key": internal_api_key,
      "User-Agent": "vn-buyer-guide-rss-poller/1.0",
    },
    method="POST",
  )
  with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
    return json.loads(resp.read().decode("utf-8"))


def load_state(path: Path) -> Dict[str, Any]:
  if not path.exists():
    return {}
  try:
    return json.loads(path.read_text("utf-8"))
  except Exception:
    return {}


def save_state(path: Path, state: Dict[str, Any]) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(json.dumps(state, ensure_ascii=False, indent=2), "utf-8")


def main() -> int:
  parser = argparse.ArgumentParser(description="Poll an RSS/Atom feed and print/ingest entries.")
  parser.add_argument("--feed", help="RSS/Atom feed URL (https://...)")
  parser.add_argument("--file", help="Parse from a local XML file instead of fetching")
  parser.add_argument("--limit", type=int, default=10, help="Max items to show/ingest")
  parser.add_argument("--user-agent", default="Mozilla/5.0 (vn-buyer-guide-rss-poller)", help="HTTP User-Agent")
  parser.add_argument("--timeout", type=int, default=15, help="HTTP timeout (seconds)")
  parser.add_argument("--state-file", default=".cache/rss_state.json", help="Stores ETag/Last-Modified per feed URL")

  parser.add_argument("--push", action="store_true", help="POST parsed items to backend ingest API")
  parser.add_argument("--ingest-url", default="http://localhost:3000/api/v1/internal/news/articles/ingest")
  parser.add_argument("--internal-api-key", default=None, help="X-Internal-Api-Key (or env INTERNAL_API_KEY)")
  parser.add_argument("--source-site", default=None, help="Override sourceSite sent to backend")

  args = parser.parse_args()

  if bool(args.feed) == bool(args.file):
    print("Provide exactly one of --feed or --file", file=sys.stderr)
    return 2

  xml_bytes: bytes
  feed_url = args.feed or "file://local"
  state_path = Path(args.state_file)
  state = load_state(state_path)

  if args.file:
    xml_bytes = Path(args.file).read_bytes()
    fetch_status = 200
    fetch_headers: Dict[str, str] = {}
  else:
    key = feed_url
    etag = state.get(key, {}).get("etag")
    last_modified = state.get(key, {}).get("last_modified")

    fetched = fetch_url(
      feed_url,
      user_agent=args.user_agent,
      timeout_seconds=args.timeout,
      etag=etag,
      last_modified=last_modified,
    )
    fetch_status = fetched.status
    fetch_headers = fetched.headers

    if fetch_status == 304:
      print(json.dumps({"ok": True, "status": 304, "message": "Not modified"}, ensure_ascii=False))
      return 0

    if fetch_status < 200 or fetch_status >= 300:
      print(
        json.dumps(
          {"ok": False, "status": fetch_status, "headers": fetch_headers, "bodyPreview": fetched.body[:200].decode("utf-8", "ignore")},
          ensure_ascii=False,
        ),
        file=sys.stderr,
      )
      return 1

    xml_bytes = fetched.body

    state[key] = {
      "etag": fetch_headers.get("etag"),
      "last_modified": fetch_headers.get("last-modified"),
      "last_fetched_at": _isoformat(_utc_now()),
    }
    save_state(state_path, state)

  feed_type, items = parse_feed(xml_bytes, feed_url=feed_url)
  items = items[: max(0, args.limit)]

  output: Dict[str, Any] = {
    "ok": True,
    "feedType": feed_type,
    "feed": args.feed,
    "count": len(items),
    "items": items,
  }

  internal_api_key = args.internal_api_key
  if args.push:
    # Read from env if not provided
    if not internal_api_key:
      import os

      internal_api_key = os.environ.get("INTERNAL_API_KEY")
    if not internal_api_key:
      print("Missing --internal-api-key (or env INTERNAL_API_KEY) for --push", file=sys.stderr)
      return 2

    ingest_result = post_ingest(
      ingest_url=args.ingest_url,
      internal_api_key=internal_api_key,
      timeout_seconds=args.timeout,
      items=items,
      source_site_override=args.source_site,
    )
    output["ingest"] = ingest_result

  print(json.dumps(output, ensure_ascii=False, indent=2))
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
