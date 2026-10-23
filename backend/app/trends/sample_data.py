"""Deterministic sample trends (clearly labelled sample data, not live platform metrics).

Each spec: (topic, category, platform, language, growth_pct, engagement_rate, content_count,
topic_frequency, recency_days, related_topics). History (30 days) is generated deterministically.
"""
from __future__ import annotations

import math
import zlib
from datetime import date, timedelta

SAMPLE_SOURCE = "CreatorHub sample data"

# fmt: off
TREND_SPECS: list[tuple] = [
    # ---- Technology
    ("AI tools for students", "Technology", "instagram", "en", 182, 8.4, 940, 150, 0.5, ["ChatGPT study tips", "free AI tools", "AI notes apps"]),
    ("Python in 30 days", "Technology", "youtube", "en", 96, 6.1, 620, 118, 1.5, ["Python projects", "coding roadmap", "learn to code free"]),
    ("Smartphone camera tricks", "Technology", "youtube_shorts", "en", 74, 7.2, 810, 132, 2.0, ["phone photography", "reel editing apps", "low light tips"]),
    ("AI टूल्स से पैसे कमाएं", "Technology", "instagram", "hi", 210, 9.1, 720, 140, 0.8, ["फ्रीलांसिंग", "AI वीडियो टूल्स", "ऑनलाइन कमाई"]),
    ("मोबाइल से कोडिंग सीखें", "Technology", "youtube_shorts", "hi", 88, 6.8, 410, 84, 2.5, ["कोडिंग शुरुआत", "फ्री कोर्स", "ऐप बनाना"]),
    ("एआय टूल्स वापरून अभ्यास", "Technology", "instagram", "mr", 134, 7.6, 280, 62, 1.0, ["मराठी एआय टिप्स", "विद्यार्थी टूल्स", "नोट्स बनवा"]),
    ("मोबाईल सुरक्षा टिप्स", "Technology", "youtube_shorts", "mr", 61, 5.9, 190, 48, 3.0, ["ऑनलाइन फसवणूक", "पासवर्ड सुरक्षा", "स्कॅम ओळखा"]),
    ("Cybersecurity basics for beginners", "Technology", "youtube", "en", 58, 5.2, 470, 96, 3.5, ["phishing awareness", "safe passwords", "ethical hacking intro"]),
    # ---- Education
    ("Study with me routines", "Education", "youtube", "en", 71, 6.4, 880, 126, 1.0, ["pomodoro method", "exam preparation", "study desk setup"]),
    ("Board exam last-minute tips", "Education", "instagram", "en", 120, 8.9, 760, 122, 0.7, ["revision timetable", "memory tricks", "stress free exams"]),
    ("MSBTE diploma exam strategy", "Education", "youtube_shorts", "en", 66, 7.1, 260, 58, 2.2, ["diploma notes", "polytechnic tips", "internship guide"]),
    ("परीक्षा की तैयारी कैसे करें", "Education", "youtube_shorts", "hi", 98, 7.9, 640, 110, 1.2, ["रिवीजन ट्रिक्स", "टाइम टेबल", "याद करने के तरीके"]),
    ("इंग्लिश स्पीकिंग प्रैक्टिस", "Education", "instagram", "hi", 84, 8.2, 590, 102, 1.8, ["रोज़ की बातचीत", "ग्रामर टिप्स", "इंटरव्यू इंग्लिश"]),
    ("स्कॉलरशिप माहिती", "Education", "instagram", "mr", 112, 8.5, 230, 54, 1.4, ["अर्ज प्रक्रिया", "शिक्षण योजना", "विद्यार्थी मार्गदर्शन"]),
    ("बारावीनंतर करिअर पर्याय", "Education", "youtube", "mr", 77, 6.6, 175, 44, 3.2, ["इंजिनिअरिंग प्रवेश", "डिप्लोमा मार्ग", "करिअर मार्गदर्शन"]),
    ("Skill-based learning over degrees", "Education", "youtube", "en", 45, 5.0, 390, 80, 4.5, ["online certificates", "portfolio projects", "self learning"]),
    # ---- Gaming
    ("Budget gaming setup", "Gaming", "youtube", "en", 63, 6.0, 700, 112, 2.0, ["low end PC games", "gaming mouse", "desk tour"]),
    ("Mobile gaming tips and sensitivity", "Gaming", "youtube_shorts", "en", 108, 8.0, 960, 148, 0.6, ["BGMI settings", "headshot practice", "esports clips"]),
    ("Minecraft survival series", "Gaming", "youtube", "en", 39, 5.4, 540, 90, 5.0, ["redstone builds", "Minecraft seeds", "hardcore mode"]),
    ("फ्री फायर टिप्स और ट्रिक्स", "Gaming", "youtube_shorts", "hi", 142, 8.8, 830, 128, 0.9, ["शार्प शूटिंग", "रैंक पुश", "गेमिंग क्लिप्स"]),
    ("गेमिंग हाईलाइट्स हिंदी", "Gaming", "instagram", "hi", 70, 6.9, 360, 76, 2.6, ["मज़ेदार गेम क्लिप", "लाइव स्ट्रीम", "गेमिंग मीम्स"]),
    ("मराठी गेमिंग कॉमेंट्री", "Gaming", "youtube_shorts", "mr", 93, 7.4, 120, 36, 1.6, ["मराठी स्ट्रीमर", "मोबाईल गेम्स", "गेमिंग विनोद"]),
    ("Indie games worth playing", "Gaming", "youtube", "en", 34, 4.9, 280, 60, 6.0, ["hidden gems", "game reviews", "story games"]),
    # ---- Business
    ("Side hustles for students", "Business", "instagram", "en", 132, 8.1, 780, 120, 0.9, ["freelancing start", "print on demand", "content writing"]),
    ("Small business branding on Instagram", "Business", "instagram", "en", 79, 6.7, 520, 98, 1.7, ["logo basics", "reel marketing", "customer stories"]),
    ("Stock market basics", "Business", "youtube", "en", 52, 5.5, 650, 108, 2.8, ["SIP explained", "mutual funds", "budgeting"]),
    ("छोटा बिज़नेस आइडिया", "Business", "youtube_shorts", "hi", 104, 7.7, 610, 106, 1.3, ["कम बजट बिज़नेस", "घर से काम", "ग्राहक कैसे पाएं"]),
    ("ऑनलाइन बिज़नेस शुरू करें", "Business", "instagram", "hi", 86, 7.0, 440, 88, 2.1, ["डिजिटल मार्केटिंग", "डिलीवरी ऐप्स", "सोशल मीडिया सेलिंग"]),
    ("स्थानिक व्यवसायासाठी रील मार्केटिंग", "Business", "instagram", "mr", 101, 7.8, 160, 40, 1.9, ["दुकान प्रचार", "ग्राहक वाढवा", "मराठी ब्रँडिंग"]),
    ("शेअर बाजार सोप्या भाषेत", "Business", "youtube", "mr", 57, 5.8, 150, 38, 3.8, ["गुंतवणूक सुरुवात", "SIP माहिती", "बचत टिप्स"]),
    # ---- Entertainment
    ("Relatable college life skits", "Entertainment", "instagram", "en", 126, 9.3, 910, 140, 0.4, ["hostel life", "exam memes", "friends comedy"]),
    ("Trending audio reel ideas", "Entertainment", "instagram", "en", 148, 8.7, 990, 152, 0.3, ["reel transitions", "dance challenge", "voiceover trends"]),
    ("Movie review in 60 seconds", "Entertainment", "youtube_shorts", "en", 47, 5.7, 560, 94, 3.0, ["web series picks", "spoiler free", "OTT recommendations"]),
    ("मज़ेदार कॉलेज स्किट्स", "Entertainment", "instagram", "hi", 118, 9.0, 800, 130, 0.7, ["दोस्ती कॉमेडी", "हॉस्टल लाइफ", "रिलेटेबल मीम्स"]),
    ("बॉलीवुड गाने रील ट्रेंड", "Entertainment", "instagram", "hi", 92, 7.5, 700, 114, 1.1, ["डांस रील", "ट्रेंडिंग ऑडियो", "लिप सिंक"]),
    ("मराठी कॉमेडी रील्स", "Entertainment", "instagram", "mr", 138, 9.2, 260, 60, 0.6, ["गावाकडची गंमत", "कुटुंब विनोद", "मराठी मीम्स"]),
    ("मराठी गाणी आणि लोककला", "Entertainment", "youtube", "mr", 49, 5.3, 130, 34, 4.2, ["लावणी", "भक्तिगीते", "लोकगीत कव्हर"]),
    # ---- Fitness
    ("Home workout without equipment", "Fitness", "instagram", "en", 91, 7.4, 870, 134, 1.0, ["bodyweight routine", "15 minute workout", "beginner fitness"]),
    ("High protein vegetarian meals", "Fitness", "instagram", "en", 112, 8.3, 730, 116, 0.8, ["paneer recipes", "meal prep", "protein snacks"]),
    ("Morning routine for energy", "Fitness", "youtube_shorts", "en", 55, 6.2, 590, 98, 2.4, ["habit building", "stretching", "hydration tips"]),
    ("घर पर वर्कआउट", "Fitness", "youtube_shorts", "hi", 103, 7.9, 680, 112, 1.0, ["बिना उपकरण एक्सरसाइज", "वेट लॉस टिप्स", "योगा रूटीन"]),
    ("डाइट प्लान शाकाहारी", "Fitness", "instagram", "hi", 68, 6.5, 410, 82, 2.7, ["प्रोटीन आहार", "देसी नाश्ता", "फिटनेस आदतें"]),
    ("घरच्या घरी व्यायाम", "Fitness", "instagram", "mr", 89, 7.2, 180, 42, 1.5, ["सूर्यनमस्कार", "सकाळचा व्यायाम", "निरोगी सवयी"]),
    ("योगासने सोप्या पद्धतीने", "Fitness", "youtube", "mr", 43, 5.1, 120, 32, 5.2, ["प्राणायाम", "पाठदुखी व्यायाम", "ध्यान मार्गदर्शन"]),
]
# fmt: on


def _seed(text: str) -> int:
    return zlib.crc32(text.encode("utf-8"))


def build_history(topic: str, final_score: float, growth_pct: float, days: int = 30,
                  end: date | None = None) -> list[dict]:
    """30 daily points ending at `final_score`; higher growth => steeper earlier climb. Deterministic."""
    end = end or date.today()
    rnd = _seed(topic)
    start_score = max(5.0, final_score - min(35.0, 8.0 + growth_pct / 6.0))
    points: list[dict] = []
    for i in range(days):
        t = i / (days - 1)
        base = start_score + (final_score - start_score) * (t ** 1.4)
        wobble = math.sin((rnd % 17) + i * 0.9) * 1.8 * (1 - t)
        score = final_score if i == days - 1 else max(0.0, min(100.0, base + wobble))
        points.append({"date": (end - timedelta(days=days - 1 - i)).isoformat(), "score": round(score, 1)})
    return points


def keywords_for(topic: str, related: list[str], frequency: int) -> list[tuple[str, int]]:
    """Keyword -> frequency rows for trend_topics (decreasing weights)."""
    rows = [(topic, frequency)]
    for idx, kw in enumerate(related):
        rows.append((kw, max(1, int(frequency * (0.72 - idx * 0.17)))))
    return rows

# Query hints used when searching YouTube in each language.
LANG_HINT = {"en": "tips", "hi": "हिंदी", "mr": "मराठी"}
