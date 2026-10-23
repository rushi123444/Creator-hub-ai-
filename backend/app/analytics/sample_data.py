"""Demo analytics for the seeded creator: correlated, deterministic and clearly sample data."""
from __future__ import annotations

import random
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.insights import AnalyticsEntry
from app.models.reference import Category, Platform

# category -> language -> [(title, topic)]
TOPICS = {
    "Technology": {
        "mr": [("एआय टूल्स वापरून अभ्यास कसा कराल", "एआय टूल्स"), ("मोबाईल सुरक्षा: ५ सोपे उपाय", "मोबाईल सुरक्षा"),
               ("कोडिंग शिकायला कुठून सुरुवात करावी", "कोडिंग सुरुवात"), ("फ्री टूल्स ज्यांनी काम सोपे होते", "फ्री टूल्स")],
        "hi": [("AI टूल्स जो पढ़ाई आसान बना दें", "AI टूल्स"), ("फोन हैक होने से कैसे बचें", "मोबाइल सुरक्षा")],
        "en": [("5 AI tools every student should know", "AI tools"), ("Cybersecurity basics in 60 seconds", "cybersecurity"),
               ("Build your first website this weekend", "web development")],
    },
    "Education": {
        "mr": [("परीक्षेच्या शेवटच्या आठवड्याचे नियोजन", "परीक्षा नियोजन")],
        "hi": [("बोर्ड परीक्षा रिवीजन का आसान तरीका", "रिवीजन")],
        "en": [("Study routine that actually works", "study routine"), ("MSBTE exam strategy explained", "diploma exams")],
    },
    "Entertainment": {
        "mr": [("कॉलेज लाइफ मधले मजेदार प्रसंग", "कॉलेज कॉमेडी")],
        "hi": [("हॉस्टल लाइफ की रिलेटेबल बातें", "हॉस्टल लाइफ")],
        "en": [("Things only engineering students understand", "college humour")],
    },
    "Business": {
        "mr": [("विद्यार्थ्यांसाठी साइड इन्कम आयडिया", "साइड हसल")],
        "en": [("Freelancing roadmap for beginners", "freelancing")],
    },
}
CATEGORY_WEIGHTS = {"Technology": 0.58, "Education": 0.17, "Entertainment": 0.15, "Business": 0.10}
LANG_WEIGHTS = {"mr": 0.45, "hi": 0.2, "en": 0.35}
# multiplicative effects, so patterns are discoverable by the recommendation rules
LANG_ENGAGEMENT = {"mr": 1.25, "hi": 1.05, "en": 0.9}
CATEGORY_VIEWS = {"Technology": 1.2, "Education": 0.9, "Entertainment": 1.4, "Business": 0.8}


def _pick(rng: random.Random, weights: dict[str, float]) -> str:
    return rng.choices(list(weights), weights=list(weights.values()))[0]


def seed_demo_analytics(db: Session, user_id, days: int = 90) -> int:
    """Insert ~one post per 1.5 days over `days` days. Idempotent per user. Returns rows created."""
    if db.scalar(select(func.count()).select_from(AnalyticsEntry).where(AnalyticsEntry.user_id == user_id)):
        return 0
    cats = {c.name: c.id for c in db.scalars(select(Category))}
    plats = {p.slug: p.id for p in db.scalars(select(Platform))}
    rng = random.Random("creatorhub-demo-analytics")
    today = date.today()
    created = 0
    for offset in range(days, 0, -1):
        if rng.random() > 0.68:
            continue
        day = today - timedelta(days=offset)
        category = _pick(rng, CATEGORY_WEIGHTS)
        language = _pick(rng, {k: v for k, v in LANG_WEIGHTS.items() if k in TOPICS[category]})
        title, topic = rng.choice(TOPICS[category][language])
        platform = "instagram" if rng.random() < 0.62 else "youtube"
        is_reel = platform == "instagram"
        duration = rng.choice([22, 28, 35, 42, 55]) if is_reel else rng.choice([240, 420, 600, 780])
        growth = 1 + (days - offset) / days * 0.6              # audience grows over the period
        weekend = 1.2 if day.weekday() in (5, 6) else 1.0
        base = (3200 if is_reel else 1400) * growth * weekend * CATEGORY_VIEWS[category] * rng.uniform(0.55, 1.6)
        views = int(base)
        rate = rng.uniform(0.045, 0.085) * LANG_ENGAGEMENT[language] * (1.1 if is_reel else 0.85)
        interactions = views * rate
        likes = int(interactions * 0.74)
        comments = int(interactions * 0.07 * rng.uniform(0.6, 1.4))
        shares = int(interactions * 0.11 * (1.2 if is_reel else 0.6))
        saves = int(interactions * 0.08 * (1.3 if category == "Technology" else 1.0))
        reach = None if rng.random() < 0.15 else int(views * rng.uniform(0.82, 0.95))
        db.add(AnalyticsEntry(
            user_id=user_id, title=title, topic=topic, platform_id=plats.get(platform), category_id=cats.get(category),
            language_code=language, recorded_on=day, publication_date=day - timedelta(days=rng.randint(0, 2)),
            duration_seconds=duration, views=views, likes=likes, comments=comments, shares=shares, saves=saves,
            reach=reach, watch_time_minutes=round(views * duration / 60 * rng.uniform(0.35, 0.6), 1),
            followers_gained=int(views * rng.uniform(0.001, 0.006)),
        ))
        created += 1
    db.commit()
    return created
