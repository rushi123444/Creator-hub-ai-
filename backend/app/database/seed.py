"""Idempotent seed: reference data, platform settings, demo accounts and demo workspace data.

`seed_all(db, include_demo_accounts)`: production passes False, so demo accounts (and the
rows that hang off them) are never created there. Every seeded row has a deterministic UUID
(uuid5) so re-running the seed or exporting it as SQL is stable.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.content import Caption, Content, ContentCalendar, ContentIdea, Hashtag, Hook, Script
from app.models.reference import Category, Language, Platform
from app.models.system import Notification, PlatformSetting, Report
from app.models.user import CreatorProfile, EditorProfile, EditorSkill, Profile, User
from app.services.security import hash_password

logger = logging.getLogger("creatorhub.seed")
NS = uuid.UUID("6f1c2b0e-8a4d-4c57-9d3e-0c4e5a7b1d20")

LANGUAGES = [("en", "English", "English"), ("hi", "Hindi", "हिन्दी"), ("mr", "Marathi", "मराठी")]
PLATFORMS = [("instagram", "Instagram"), ("youtube", "YouTube"), ("youtube_shorts", "YouTube Shorts"),
             ("facebook", "Facebook"), ("x", "X"), ("linkedin", "LinkedIn"), ("other", "Other")]
CATEGORIES = [("Technology", "Gadgets, software, AI and coding."), ("Education", "Learning, exams and skills."),
              ("Gaming", "Game streams, reviews and tips."), ("Business", "Startups, money and careers."),
              ("Entertainment", "Comedy, music and pop culture."), ("Fitness", "Workouts, health habits and nutrition.")]
SETTINGS = {"open_registration": True, "ai_daily_limit_per_user": 200, "announcement": ""}

DEMO_ACCOUNTS = [
    ("creator@creatorhub.ai", "Creator@123", "Aarav Deshmukh", "creator"),
    ("editor@creatorhub.ai", "Editor@123", "Meera Kulkarni", "editor"),
    ("admin@creatorhub.ai", "Admin@12345", "Platform Admin", "admin"),
]
EXTRA_CREATORS = [
    ("Priya Joshi", "Education", "youtube", "mr"), ("Rohan Patil", "Gaming", "youtube", "en"),
    ("Sneha Kale", "Fitness", "instagram", "hi"), ("Vikram Shinde", "Business", "linkedin", "en"),
    ("Ananya Rao", "Entertainment", "instagram", "hi"), ("Kunal Mehta", "Technology", "youtube_shorts", "en"),
    ("Pooja Bhosale", "Education", "instagram", "mr"), ("Imran Sheikh", "Business", "youtube", "hi"),
]
EXTRA_EDITORS = [
    ("Siddharth Pawar", "Reels editor for fast-paced storytelling", "reels", ["en", "mr"], 5, ["Premiere Pro", "CapCut", "Sound design"], True),
    ("Neha Gupta", "YouTube long-form and retention editing", "youtube", ["en", "hi"], 7, ["DaVinci Resolve", "Retention editing", "Subtitles"], True),
    ("Arjun Nair", "Motion graphics and animated explainers", "motion_graphics", ["en"], 6, ["After Effects", "Lottie", "Kinetic text"], True),
    ("Tanvi Desai", "Thumbnails that earn the click", "thumbnail", ["en", "hi", "mr"], 4, ["Photoshop", "Figma", "A/B testing"], False),
    ("Karan Malhotra", "Gaming montages and stream highlights", "gaming", ["en", "hi"], 3, ["Premiere Pro", "Highlights", "OBS"], False),
    ("Ritika Sawant", "Marathi reels and short-form edits", "reels", ["mr", "hi"], 2, ["CapCut", "Captions", "Color grading"], False),
    ("Faisal Khan", "Documentary-style YouTube edits", "youtube", ["hi", "en"], 8, ["Final Cut Pro", "Storytelling", "Audio cleanup"], True),
    ("Isha Bapat", "Clean motion graphics for educators", "motion_graphics", ["mr", "en"], 5, ["After Effects", "Illustrator", "Infographics"], False),
    ("Dev Chavan", "Thumbnail and channel art designer", "thumbnail", ["en", "mr"], 3, ["Photoshop", "Canva", "Branding"], False),
    ("Zoya Ansari", "Esports clips and short gaming reels", "gaming", ["hi", "en"], 4, ["DaVinci Resolve", "Shorts", "Overlays"], False),
]


def uid(*parts: str) -> uuid.UUID:
    return uuid.uuid5(NS, ":".join(parts))


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def seed_reference(db: Session) -> None:
    for code, name, native in LANGUAGES:
        if db.get(Language, code) is None:
            db.add(Language(code=code, name=name, native_name=native))
    existing_p = {p.slug for p in db.scalars(select(Platform))}
    for slug, name in PLATFORMS:
        if slug not in existing_p:
            db.add(Platform(slug=slug, name=name))
    existing_c = {c.slug for c in db.scalars(select(Category))}
    for name, desc in CATEGORIES:
        if name.lower() not in existing_c:
            db.add(Category(name=name, slug=name.lower(), description=desc))
    for key, value in SETTINGS.items():
        if db.get(PlatformSetting, key) is None:
            db.add(PlatformSetting(key=key, value={"value": value}))
    db.flush()


def _ids(db: Session) -> tuple[dict[str, int], dict[str, int]]:
    cats = {c.name: c.id for c in db.scalars(select(Category))}
    plats = {p.slug: p.id for p in db.scalars(select(Platform))}
    return cats, plats


def _ensure_user(db: Session, email: str, password: str, name: str, role: str, *, lang: str = "en",
                 completed: bool = True, username: str | None = None, cat: int | None = None,
                 plat: int | None = None, tone: str | None = None, interests: list | None = None) -> tuple[User, bool]:
    user = db.scalar(select(User).where(User.email == email))
    if user is not None:
        return user, False
    user = User(id=uid("user", email), email=email, password_hash=hash_password(password), full_name=name, role=role)
    db.add(user)
    db.flush()
    db.add(Profile(id=uid("profile", email), user_id=user.id, username=username, preferred_language=lang,
                   ui_language=lang, profile_completed=completed,
                   bio=f"{name} on CreatorHub AI." if completed else None))
    if role == "creator":
        db.add(CreatorProfile(id=uid("cprofile", email), user_id=user.id, category_id=cat, platform_id=plat,
                              creator_type="solo", experience_level="intermediate",
                              interests=interests or [], default_tone=tone or "educational"))
    db.flush()
    return user, True


def _ensure_editor(db: Session, key: str, user_id, name, headline, spec, langs, years, skills, verified) -> EditorProfile:
    eid = uid("editor", key)
    e = db.get(EditorProfile, eid)
    if e is not None:
        return e
    slug = name.lower().replace(" ", ".")
    e = EditorProfile(id=eid, user_id=user_id, display_name=name, headline=headline, specialization=spec,
                      languages=langs, experience_years=years, is_verified=verified, status="active",
                      portfolio_url=f"https://portfolio.example.com/{slug}",
                      instagram_url=f"https://instagram.com/{slug.replace('.', '_')}",
                      contact_email=f"{slug}@example.com",
                      bio=f"{name} edits {spec.replace('_', ' ')} projects for creators across India.")
    db.add(e)
    db.flush()
    for s in skills:
        db.add(EditorSkill(editor_id=e.id, skill=s))
    db.flush()
    return e


def seed_accounts(db: Session) -> User | None:
    cats, plats = _ids(db)
    demo_creator = None
    for email, pw, name, role in DEMO_ACCOUNTS:
        if role == "creator":
            demo_creator, _ = _ensure_user(db, email, pw, name, role, lang="mr", username="aarav.tech",
                                           cat=cats["Technology"], plat=plats["instagram"], tone="educational",
                                           interests=["AI tools", "Android", "Coding for beginners"])
        elif role == "editor":
            u, _ = _ensure_user(db, email, pw, name, role, lang="mr", username="meera.edits")
            _ensure_editor(db, email, u.id, name, "Reels and short-form editor", "reels", ["mr", "en", "hi"], 4,
                           ["Premiere Pro", "CapCut", "Captions"], True)
        else:
            _ensure_user(db, email, pw, name, role, username="admin")
    for i, (name, cat, plat, lang) in enumerate(EXTRA_CREATORS):
        email = f"{name.split()[0].lower()}.{name.split()[1].lower()}@example.com"
        _ensure_user(db, email, "Creator@123", name, "creator", lang=lang, username=f"{name.split()[0].lower()}{i + 1}",
                     cat=cats[cat], plat=plats[plat], interests=[cat.lower()])
    for name, headline, spec, langs, years, skills, verified in EXTRA_EDITORS:
        _ensure_editor(db, name.lower(), None, name, headline, spec, langs, years, skills, verified)
    db.flush()
    return demo_creator


def seed_demo_workspace(db: Session, user: User) -> None:
    """Content, calendar, ideas, hooks, captions, scripts, notifications for the demo creator."""
    if db.scalar(select(Content.id).where(Content.user_id == user.id).limit(1)):
        return
    cats, plats = _ids(db)
    tech, ig, yt = cats["Technology"], plats["instagram"], plats["youtube"]
    now = _now()
    rows = [  # title, topic, type, platform, lang, status, days-offset
        ("5 AI tools every student should know", "AI tools", "reel", ig, "en", "published", -20),
        ("Android 16 features in 60 seconds", "Android", "reel", ig, "en", "published", -12),
        ("मोबाइल फोन बॅटरी वाचवण्याचे ५ मार्ग", "Battery tips", "reel", ig, "mr", "published", -6),
        ("How to learn Python in 30 days", "Python", "youtube_video", yt, "en", "scheduled", 3),
        ("Best budget laptops under 50,000", "Laptops", "youtube_video", yt, "en", "scheduled", 6),
        ("ChatGPT prompts for coding beginners", "Prompts", "reel", ig, "en", "editing", 0),
        ("VS Code shortcuts that save hours", "VS Code", "tutorial", yt, "en", "recording", 0),
        ("फ्री AI टूल्स - विद्यार्थ्यांसाठी", "AI tools", "reel", ig, "mr", "script", 0),
        ("Build a portfolio site in one day", "Web dev", "tutorial", yt, "en", "script", 0),
        ("Is the new smartwatch worth it?", "Wearables", "reel", ig, "en", "draft", 0),
        ("Git explained simply", "Git", "educational", yt, "en", "draft", 0),
        ("Phone camera myths", "Cameras", "reel", ig, "hi", "idea", 0),
        ("Top 3 free hosting platforms", "Hosting", "post", ig, "en", "idea", 0),
        ("Cybersecurity basics for students", "Security", "educational", yt, "en", "idea", 0),
    ]
    contents: list[Content] = []
    for i, (title, topic, ctype, plat, lang, status, off) in enumerate(rows):
        when = now + timedelta(days=off, hours=10) if status in ("published", "scheduled") else None
        c = Content(id=uid("content", str(i)), user_id=user.id, title=title, topic=topic, content_type=ctype,
                    platform_id=plat, category_id=tech, language_code=lang, status=status,
                    body=f"Script outline for {title}." if status not in ("idea",) else None,
                    caption=f"{title} #creatorhub" if status in ("scheduled", "published") else None,
                    hashtags=["#tech", "#" + topic.lower().replace(" ", "")], ai_generated=i % 2 == 0,
                    scheduled_at=when, published_at=when if status == "published" else None,
                    created_at=now - timedelta(days=25 - i), updated_at=now - timedelta(days=max(0, 20 - i)))
        contents.append(c)
        db.add(c)
    db.flush()
    cal = [(0, "published", -20), (1, "published", -12), (2, "published", -6), (3, "scheduled", 3),
           (4, "scheduled", 6), (5, "editing", 1)]
    for n, (idx, status, off) in enumerate(cal):
        c = contents[idx]
        db.add(ContentCalendar(id=uid("cal", str(n)), user_id=user.id, content_id=c.id, title=c.title,
                               platform_id=c.platform_id, status=status, scheduled_at=now + timedelta(days=off, hours=10),
                               notes="Auto-added demo entry."))
    ideas = [("AI tools for exam preparation", "AI tools", "reel", "Education topics are rising on Instagram.", "Stop studying the hard way."),
             ("Python projects for beginners", "Python", "youtube_video", "Beginner coding content has steady demand.", "Build this in 20 minutes."),
             ("Budget phone buying guide", "Phones", "reel", "Evergreen buying-guide topic.", "Do not buy a phone before watching this.")]
    for i, (t, topic, fmt, reason, hook) in enumerate(ideas):
        db.add(ContentIdea(id=uid("idea", str(i)), user_id=user.id, title=t, topic=topic, format=fmt, reason=reason,
                           suggested_hook=hook, category_id=tech, platform_id=ig, language_code="en"))
    hooks = [("question", "Did you know your phone is tracking more than you think?"),
             ("curiosity", "This one setting doubled my battery life."),
             ("problem", "Struggling to learn coding? You are probably doing this wrong."),
             ("benefit", "Learn Python in 30 days with this simple plan."),
             ("story", "Last year I could not write a single line of code.")]
    for i, (ht, text) in enumerate(hooks):
        db.add(Hook(id=uid("hook", str(i)), user_id=user.id, topic="Technology", hook_type=ht, text=text,
                    language_code="en", platform_id=ig))
    db.add(Caption(id=uid("caption", "0"), user_id=user.id, topic="AI tools",
                   instagram_caption="5 AI tools that make studying easier. Save this for later!",
                   youtube_description="A quick tour of five AI tools students can use today.",
                   short_description="Five AI tools for students.", cta="Follow for more tech tips.",
                   keywords=["ai tools", "students", "study"], language_code="en", platform_id=ig))
    db.add(Hashtag(id=uid("hashtag", "0"), user_id=user.id, topic="AI tools", broad=["#tech", "#ai"],
                   medium=["#aitools", "#studytips"], niche=["#aiforstudents"], language_code="en", platform_id=ig))
    db.add(Script(id=uid("script", "0"), user_id=user.id, topic="AI tools", hook=hooks[0][1],
                  introduction="Today: five AI tools for students.", main_points=["Notes", "Research", "Practice"],
                  examples=["Summarise a chapter"], cta="Follow for more.", ending="See you next time.",
                  full_script="Hook, intro, three points, call to action.", language_code="en", platform_id=ig,
                  duration_seconds=45, tone="educational"))
    notes = [("Welcome to CreatorHub AI", "Explore trends and generate your first script.", "welcome", "/app/studio"),
             ("Post scheduled", "Your video is scheduled for later this week.", "calendar", "/app/calendar"),
             ("New trend in Technology", "AI tools for students is trending in Marathi.", "trend", "/app/trends"),
             ("Weekly recommendations ready", "Review your new recommendations.", "recommendation", "/app/dashboard")]
    for i, (t, b, k, link) in enumerate(notes):
        db.add(Notification(id=uid("notification", str(i)), user_id=user.id, title=t, body=b, kind=k, link=link,
                            is_read=i == 0, created_at=now - timedelta(hours=i * 7)))
    db.flush()


def seed_demo_report(db: Session) -> None:
    if db.get(Report, uid("report", "0")):
        return
    reporter = db.scalar(select(User).where(User.email == "creator@creatorhub.ai"))
    editor = db.get(EditorProfile, uid("editor", "karan malhotra"))
    if reporter and editor:
        db.add(Report(id=uid("report", "0"), reporter_id=reporter.id, target_type="editor_profile", target_id=editor.id,
                      reason="Unresponsive", details="Did not reply to project messages for two weeks."))
        db.flush()


def _guarded(label: str, fn, *args) -> None:
    try:
        n = fn(*args)
        logger.info("Seeded %s: %s", label, n)
    except ImportError:
        logger.warning("Seed hook for %s is not available; skipping.", label)


def seed_insights(db: Session, demo_creator: User | None) -> None:
    try:
        from app.trends.service import seed_sample_trends
    except ImportError:
        logger.warning("app.trends.service not available; trends not seeded.")
    else:
        seed_sample_trends(db)
    if demo_creator is None:
        return
    try:
        from app.analytics.sample_data import seed_demo_analytics
    except ImportError:
        logger.warning("app.analytics.sample_data not available; analytics not seeded.")
    else:
        seed_demo_analytics(db, demo_creator.id, days=90)
    try:
        from app.services.recommendation_service import seed_demo_recommendations
    except ImportError:
        logger.warning("app.services.recommendation_service not available; recommendations not seeded.")
    else:
        seed_demo_recommendations(db, demo_creator.id)


def seed_all(db: Session, include_demo_accounts: bool = True) -> None:
    """Seed everything. Idempotent. Never creates demo accounts when include_demo_accounts is False."""
    from app.database.session import set_rls_context

    set_rls_context(db, None, "system")
    seed_reference(db)
    demo_creator = None
    if include_demo_accounts:
        demo_creator = seed_accounts(db)
        if demo_creator is not None:
            seed_demo_workspace(db, demo_creator)
        seed_demo_report(db)
    seed_insights(db, demo_creator)
    db.commit()
