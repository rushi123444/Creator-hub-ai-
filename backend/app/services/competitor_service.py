"""Competitor / public-profile analysis. Uses PUBLIC information only, never private analytics.

Live: YouTube Data API public endpoints (needs YOUTUBE_API_KEY, a YouTube platform and a resolvable
handle/URL). Otherwise a deterministic sample public-style analysis labelled is_sample.
"""
from __future__ import annotations

import logging
import random
import re
import uuid
import zlib
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.insights import AnalyticsEntry, Competitor
from app.models.user import User
from app.schemas.common import iso
from app.services import lookup
from app.services import youtube_service as yt

logger = logging.getLogger("creatorhub.competitors")
PUBLIC_NOTE = "This analysis uses public information only. No private analytics are accessed."
SAMPLE_NOTE = "Showing available sample insights. " + PUBLIC_NOTE
STOP = set("the and for with that this from your you are how what why why's best top new 2024 2025 2026 into about "
           "video videos shorts episode part full more most only will can get has have was were but not all out".split())
CATEGORY_HINTS = {
    "Technology": ("ai", "tech", "code", "coding", "python", "app", "phone", "software", "cyber", "web", "gadget"),
    "Education": ("study", "exam", "learn", "school", "class", "tips", "tutorial", "course", "notes"),
    "Gaming": ("game", "gaming", "minecraft", "bgmi", "pubg", "stream", "esports", "pc"),
    "Business": ("business", "money", "startup", "invest", "stock", "income", "freelance", "marketing"),
    "Entertainment": ("funny", "comedy", "movie", "skit", "music", "vlog", "reaction", "meme"),
    "Fitness": ("workout", "fitness", "diet", "gym", "yoga", "health", "protein", "exercise"),
}
SAMPLE_NICHES = {
    "Technology": ["5 AI tools that save hours every week", "Phone settings you should change today", "Learn Python basics in 10 minutes",
                   "How phishing scams really work", "Build a portfolio website step by step", "Free apps every student needs",
                   "Cybersecurity myths explained", "Laptop buying guide on a budget", "Coding mistakes beginners make",
                   "Automate boring tasks with simple scripts", "Smartphone camera tricks in 30 seconds", "Safe password habits"],
    "Education": ["Study routine that works for exams", "Memory tricks for last-minute revision", "How to make notes faster",
                  "Time table for board exam preparation", "Pomodoro study session tutorial", "Scholarship tips for students",
                  "Career options after 12th explained", "English speaking practice for beginners", "Exam stress tips",
                  "How toppers plan their day", "Diploma exam strategy", "Free learning resources list"],
    "Gaming": ["Mobile gaming sensitivity settings", "Budget PC gaming setup tour", "Minecraft survival tips for beginners",
               "BGMI rank push tricks", "Funny gaming clips compilation", "Best free games this month", "Esports highlights explained",
               "Headshot practice routine", "Gaming mouse review", "Low end PC games list", "Stream setup guide", "Indie games worth playing"],
    "Business": ["Side hustles for students", "Small business branding basics", "Stock market basics explained", "SIP vs savings account",
                 "Freelancing roadmap for beginners", "Instagram marketing for local shops", "Low budget business ideas",
                 "How to price your services", "Startup mistakes to avoid", "Customer service tips", "Online selling guide", "Budgeting made simple"],
    "Entertainment": ["Relatable college life skit", "Movie review in 60 seconds", "Funny exam time moments", "Trending audio reel idea",
                      "Behind the scenes vlog", "Hostel life comedy", "Web series picks this week", "Reaction to viral clips",
                      "Family comedy sketch", "Music cover session", "Day in my life vlog", "Meme explained"],
    "Fitness": ["Home workout without equipment", "High protein vegetarian meals", "Morning stretching routine", "15 minute full body workout",
                "Beginner yoga flow", "Diet mistakes to avoid", "Water intake habits", "Healthy snacks under 5 minutes",
                "Back pain exercises", "Meal prep for the week", "Gym basics for beginners", "Walking routine benefits"],
}


def _classify(text: str) -> Optional[str]:
    words = set(re.findall(r"[a-z0-9]+", text.lower()))
    scores = {c: len(words & set(h)) for c, h in CATEGORY_HINTS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] else None


def _tokens(title: str) -> list[str]:
    return [w for w in re.findall(r"[^\W\d_]{4,}", title.lower()) if w not in STOP]


def _sample_videos(handle: str) -> tuple[str, list[dict]]:
    seed = zlib.crc32(handle.lower().encode("utf-8"))
    rng = random.Random(seed)
    guess = _classify(handle) or list(SAMPLE_NICHES)[seed % len(SAMPLE_NICHES)]
    titles = SAMPLE_NICHES[guess]
    now = datetime.now(timezone.utc)
    base_views = rng.randint(4000, 60000)
    gap = rng.choice([1.5, 2, 3, 4])
    videos = []
    for i, title in enumerate(titles):
        short = rng.random() < 0.6
        views = int(base_views * rng.uniform(0.4, 2.2))
        videos.append({
            "title": title, "tags": [], "duration_seconds": rng.choice([20, 30, 45, 58]) if short else rng.choice([300, 480, 720, 900]),
            "views": views, "likes": int(views * rng.uniform(0.03, 0.08)), "comments": int(views * rng.uniform(0.002, 0.008)),
            "published_at": (now - timedelta(days=i * gap + rng.randint(0, 1))).isoformat(),
        })
    name = re.sub(r"[_\-.]+", " ", handle.strip().lstrip("@").split("/")[-1]).strip().title() or "Sample Channel"
    return name[:80], videos


def analyze_videos(videos: list[dict], user_topics: list[str], trend_topics: list[str]) -> dict:
    n = len(videos)
    titles = [v["title"] for v in videos]
    words: Counter = Counter()
    for v in videos:
        words.update(set(_tokens(v["title"])) | {t.lower() for t in v.get("tags", [])[:5]})
    frequent = [w for w, c in words.most_common(8) if c >= 2][:6] or [w for w, _ in words.most_common(5)]
    shorts = [v for v in videos if 0 < v["duration_seconds"] <= 60]
    longs = [v for v in videos if v["duration_seconds"] > 60]
    formats = []
    for label, group in (("Short-form videos (60 seconds or less)", shorts), ("Longer videos (over 1 minute)", longs)):
        if group:
            formats.append(f"{label}: {len(group)} of {n} videos, about {sum(v['views'] for v in group) // len(group):,} views each")
    formats.sort(key=lambda s: int(re.search(r"(\d+) of", s).group(1)), reverse=True)

    dates = sorted(datetime.fromisoformat(v["published_at"].replace("Z", "+00:00")) for v in videos if v.get("published_at"))
    patterns, freq = [], "Not enough public data to estimate"
    if len(dates) >= 2:
        span_days = max(1.0, (dates[-1] - dates[0]).total_seconds() / 86400)
        per_week = (len(dates) - 1) / span_days * 7
        freq = f"About {per_week:.1f} videos per week" if per_week >= 1 else f"About {1 / per_week:.1f} weeks between videos" if per_week > 0 else freq
        days = Counter(d.strftime("%A") for d in dates)
        top_day, top_n = days.most_common(1)[0]
        patterns.append(f"Most uploads land on {top_day} ({top_n} of {len(dates)} videos).")
        patterns.append(f"Public data shows {len(dates)} uploads over roughly {int(span_days)} days.")
    cats = Counter(c for t in titles if (c := _classify(t)))
    haystack = " ".join(titles).lower()
    gaps = []
    for topic in list(dict.fromkeys([*user_topics, *trend_topics])):
        key = [w for w in _tokens(topic)] or [topic.lower()]
        if not any(k in haystack for k in key):
            gaps.append(f"Consider testing '{topic}': it does not appear in this account's recent public titles.")
        if len(gaps) >= 5:
            break
    if not gaps:
        gaps.append("This account's recent titles already cover your current topics; consider differentiating by format or language.")
    total = lambda f: sum(v[f] for v in videos)  # noqa: E731
    return {
        "videos_analyzed": n, "topics": frequent, "titles": titles[:12], "posting_frequency": freq,
        "avg_duration_seconds": int(total("duration_seconds") / n) if n else 0,
        "views": total("views"), "likes": total("likes"), "comments": total("comments"),
        "categories": [c for c, _ in cats.most_common(3)], "frequent_topics": frequent,
        "popular_formats": formats, "posting_patterns": patterns, "content_gaps": gaps,
    }


def _user_context(db: Session, user: User) -> tuple[list[str], list[str]]:
    topics = [t for (t,) in db.execute(select(AnalyticsEntry.topic).where(AnalyticsEntry.user_id == user.id,
                                                                          AnalyticsEntry.topic.is_not(None)).distinct().limit(6))]
    from app.models.insights import Trend

    cp = getattr(user, "creator_profile", None)
    stmt = select(Trend.topic).where(Trend.is_active.is_(True), Trend.language_code == "en")
    if cp and cp.category_id:
        stmt = stmt.where(Trend.category_id == cp.category_id)
    trends = [t for (t,) in db.execute(stmt.order_by(Trend.trend_score.desc()).limit(4))]
    return topics, trends


def competitor_out(db: Session, c: Competitor) -> dict:
    return {"id": str(c.id), "display_name": c.display_name, "platform": lookup.platform_slug(db, c.platform_id),
            "handle_or_url": c.handle_or_url, **(c.analysis or {}), "is_sample": c.is_sample,
            "created_at": iso(c.created_at)}


def analyze_competitor(db: Session, user: User, platform: str, handle_or_url: str) -> dict:
    pslug = lookup.slugify(platform or "") or "other"
    user_topics, trend_topics = _user_context(db, user)
    display, videos, is_sample = None, [], True
    if yt.is_enabled() and pslug in ("youtube", "youtube_shorts"):
        try:
            channel = yt.resolve_channel(handle_or_url)
            videos = [v for v in yt.channel_recent_videos(channel, 20) if v["views"] or v["title"]]
            if videos:
                display, is_sample = channel["title"] or handle_or_url, False
        except yt.YouTubeError:
            logger.info("Public channel lookup unavailable; using sample analysis")
    if not videos:
        display, videos = _sample_videos(handle_or_url)
    analysis = analyze_videos(videos, user_topics, trend_topics)
    analysis["note"] = SAMPLE_NOTE if is_sample else PUBLIC_NOTE
    row = Competitor(user_id=user.id, platform_id=lookup.platform_id(db, pslug), handle_or_url=handle_or_url[:500],
                     display_name=(display or handle_or_url)[:200], analysis=analysis, is_sample=is_sample)
    db.add(row)
    db.commit()
    db.refresh(row)
    return competitor_out(db, row)


def list_competitors(db: Session, user: User) -> list[dict]:
    rows = db.scalars(select(Competitor).where(Competitor.user_id == user.id).order_by(Competitor.created_at.desc()))
    return [competitor_out(db, r) for r in rows]


def get_owned(db: Session, user: User, cid: str) -> Optional[Competitor]:
    try:
        row = db.get(Competitor, uuid.UUID(cid))
    except ValueError:
        return None
    return row if row is not None and row.user_id == user.id else None
