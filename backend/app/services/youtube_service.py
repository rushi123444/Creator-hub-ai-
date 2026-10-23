"""YouTube Data API v3 client (public endpoints only).

Uses search.list, videos.list, channels.list and videoCategories.list with an API key. This reads
PUBLIC data only. OAuth-based YouTube Analytics (private channel metrics) is NOT implemented.

Every failure (network, timeout, quota, bad response, missing key) raises `YouTubeError`; callers
convert it to the sample fallback. The key and provider error text are never logged or returned.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

from app.config.settings import get_settings

logger = logging.getLogger("creatorhub.youtube")
BASE_URL = "https://www.googleapis.com/youtube/v3"
TIMEOUT = httpx.Timeout(8.0, connect=4.0)
_DURATION_RE = re.compile(r"^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$")


class YouTubeError(Exception):
    """Internal only. Never shown to users."""


def is_enabled() -> bool:
    return get_settings().youtube_enabled


def parse_duration(value: Optional[str]) -> int:
    """ISO-8601 duration (PT1H2M3S) -> seconds. Invalid => 0."""
    match = _DURATION_RE.match(value or "")
    if not match:
        return 0
    d, h, m, s = (int(x or 0) for x in match.groups())
    return d * 86400 + h * 3600 + m * 60 + s


def _get(path: str, params: dict[str, Any]) -> dict:
    key = get_settings().youtube_api_key
    if not key:
        raise YouTubeError("not configured")
    try:
        resp = httpx.get(f"{BASE_URL}/{path}", params={**params, "key": key}, timeout=TIMEOUT)
    except httpx.HTTPError as exc:  # timeouts, connection errors (message may contain the URL -> not logged)
        logger.warning("YouTube request %s failed: %s", path, type(exc).__name__)
        raise YouTubeError("network") from None
    if resp.status_code != 200:
        logger.warning("YouTube request %s returned HTTP %s", path, resp.status_code)  # 403 usually = quota
        raise YouTubeError(f"http {resp.status_code}")
    try:
        data = resp.json()
    except ValueError:
        raise YouTubeError("invalid json") from None
    if not isinstance(data, dict):
        raise YouTubeError("unexpected payload")
    return data


def _video_row(item: dict) -> dict:
    stats, snippet = item.get("statistics", {}), item.get("snippet", {})
    return {
        "id": item.get("id"),
        "title": snippet.get("title", ""),
        "channel_title": snippet.get("channelTitle", ""),
        "published_at": snippet.get("publishedAt"),
        "tags": list(snippet.get("tags") or [])[:12],
        "duration_seconds": parse_duration(item.get("contentDetails", {}).get("duration")),
        "views": int(stats.get("viewCount", 0) or 0),
        "likes": int(stats.get("likeCount", 0) or 0),
        "comments": int(stats.get("commentCount", 0) or 0),
    }


def videos_by_ids(ids: list[str]) -> list[dict]:
    if not ids:
        return []
    data = _get("videos", {"part": "snippet,statistics,contentDetails", "id": ",".join(ids[:50])})
    return [_video_row(i) for i in data.get("items", [])]


def search_videos(query: str, *, language: Optional[str] = None, days: int = 14, max_results: int = 15,
                  order: str = "viewCount", channel_id: Optional[str] = None) -> list[dict]:
    """Search public videos, then fetch statistics for them. Returns normalised rows."""
    params: dict[str, Any] = {"part": "snippet", "type": "video", "maxResults": min(max_results, 25), "order": order}
    if query:
        params["q"] = query
    if language:
        params["relevanceLanguage"] = language
    if days:
        after = datetime.now(timezone.utc) - timedelta(days=days)
        params["publishedAfter"] = after.strftime("%Y-%m-%dT%H:%M:%SZ")
    if channel_id:
        params["channelId"] = channel_id
    data = _get("search", params)
    ids = [i.get("id", {}).get("videoId") for i in data.get("items", [])]
    return videos_by_ids([i for i in ids if i])


def video_categories(region: str = "IN") -> list[dict]:
    data = _get("videoCategories", {"part": "snippet", "regionCode": region})
    return [{"id": i.get("id"), "title": i.get("snippet", {}).get("title")} for i in data.get("items", [])]


def resolve_channel(handle_or_url: str) -> dict:
    """Resolve @handle, channel URL, channel id, or plain name to channel info."""
    text = (handle_or_url or "").strip()
    if not text:
        raise YouTubeError("empty")
    handle = channel_id = None
    m = re.search(r"youtube\.com/(?:channel/(UC[\w-]{20,}))", text)
    if m:
        channel_id = m.group(1)
    else:
        m = re.search(r"youtube\.com/@([\w.\-]+)", text)
        if m:
            handle = m.group(1)
        elif text.startswith("@"):
            handle = text[1:]
        elif re.fullmatch(r"UC[\w-]{20,}", text):
            channel_id = text
    parts = "snippet,statistics,contentDetails"
    if channel_id:
        data = _get("channels", {"part": parts, "id": channel_id})
    elif handle:
        data = _get("channels", {"part": parts, "forHandle": handle})
    else:
        found = _get("search", {"part": "snippet", "type": "channel", "q": re.sub(r"https?://\S*/", "", text), "maxResults": 1})
        items = found.get("items") or []
        if not items:
            raise YouTubeError("channel not found")
        data = _get("channels", {"part": parts, "id": items[0].get("id", {}).get("channelId")})
    items = data.get("items") or []
    if not items:
        raise YouTubeError("channel not found")
    ch = items[0]
    stats = ch.get("statistics", {})
    return {
        "id": ch.get("id"),
        "title": ch.get("snippet", {}).get("title", ""),
        "description": (ch.get("snippet", {}).get("description") or "")[:300],
        "subscribers": int(stats.get("subscriberCount", 0) or 0),
        "video_count": int(stats.get("videoCount", 0) or 0),
        "uploads_playlist": ch.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads"),
    }


def channel_recent_videos(channel: dict, max_results: int = 20) -> list[dict]:
    playlist = channel.get("uploads_playlist")
    if not playlist:
        return search_videos("", days=0, max_results=max_results, order="date", channel_id=channel.get("id"))
    data = _get("playlistItems", {"part": "contentDetails", "playlistId": playlist, "maxResults": min(max_results, 50)})
    ids = [i.get("contentDetails", {}).get("videoId") for i in data.get("items", [])]
    return videos_by_ids([i for i in ids if i])
