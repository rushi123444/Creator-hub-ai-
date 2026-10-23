"""Deterministic, topic-aware sample generator (English, Hindi, Marathi).

Used when no OpenAI key is configured. Returns the same shapes as the live path (validated through
`app.ai.schemas`). Output is deterministic for a given context; `ctx.variation` (bumped by
/ai/regenerate) rotates which template is picked so a regenerate visibly differs.
"""
from __future__ import annotations

import re
import zlib
from dataclasses import replace
from typing import Any, Iterable, Optional

from app.ai.context import CATEGORIES, GenContext, LANGUAGES, normalise_category
from app.ai.sample_text import CATEGORY_KEYWORDS, INTENT_KEYWORDS, TEXT
from app.ai.schemas import HOOK_ORDER, _tag


def _t(ctx: GenContext) -> dict:
    return TEXT.get(ctx.language) or TEXT["en"]


def _pick(options: list, ctx: GenContext, salt: str, offset: int = 0):
    if not options:
        return ""
    base = zlib.crc32(f"{ctx.topic}|{ctx.language}|{salt}".encode("utf-8"))
    return options[(base + ctx.variation + offset) % len(options)]


def _fmt(template: str, **kw: Any) -> str:
    class _D(dict):
        def __missing__(self, key: str) -> str:
            return ""

    try:
        return template.format_map(_D(**kw))
    except (ValueError, IndexError):
        return template


def classify_category(text: str, default: Optional[str] = None) -> tuple[Optional[str], str]:
    """Keyword-based category guess. Returns (category, confidence_label)."""
    low = (text or "").lower()
    scores: dict[str, int] = {}
    for cat, words in CATEGORY_KEYWORDS.items():
        n = sum(1 for w in words if w in low)
        if n:
            scores[cat] = n
    if not scores:
        return default, "low"
    best = max(scores, key=lambda c: (scores[c], -CATEGORIES.index(c)))
    label = "high" if scores[best] >= 3 else "medium" if scores[best] == 2 else "low"
    return best, label


def _category(ctx: GenContext) -> Optional[str]:
    cat = normalise_category(ctx.category)
    if cat in CATEGORIES:
        return cat
    guess, _ = classify_category(ctx.topic)
    return guess


def topic_text(ctx: GenContext) -> str:
    if ctx.topic and ctx.topic.strip():
        return ctx.topic.strip()
    cat = _category(ctx) or "_"
    names = _t(ctx)["default_topic"]
    return names.get(cat) or names["_"]


def _audience(ctx: GenContext) -> str:
    return (ctx.audience or "").strip() or _t(ctx)["default_audience"]


def _vars(ctx: GenContext, **extra: Any) -> dict:
    cat = _category(ctx)
    return {
        "t": topic_text(ctx),
        "p": ctx.platform_label,
        "a": _audience(ctx),
        "s": ctx.duration_seconds,
        "c": _t(ctx)["category_names"].get(cat or "", cat or ""),
        "n": 3,
        **extra,
    }


def _word(ctx: GenContext) -> str:
    """Compact tag stem from the topic (up to two words)."""
    words = [w for w in re.split(r"\s+", topic_text(ctx)) if w][:2]
    stem = "".join(w.capitalize() if ctx.language == "en" else w for w in words)
    stem = _tag(stem).lstrip("#")
    return stem[:24] or "Creator"


# ---- hooks ---------------------------------------------------------------------------------------
def hook_for(ctx: GenContext, hook_type: str) -> dict:
    options = _t(ctx)["hooks"][hook_type]
    return {"type": hook_type, "text": _fmt(_pick(options, ctx, f"hook:{hook_type}"), **_vars(ctx))}


def hooks(ctx: GenContext) -> list[dict]:
    return [hook_for(ctx, h) for h in HOOK_ORDER]


def title(ctx: GenContext) -> str:
    return _fmt(_pick(_t(ctx)["titles"], ctx, "title"), **_vars(ctx))[:190]


def cta(ctx: GenContext) -> str:
    return _fmt(_pick(_t(ctx)["cta"], ctx, "cta"), **_vars(ctx))


# ---- script --------------------------------------------------------------------------------------
def script(ctx: GenContext, hook_text: Optional[str] = None) -> dict:
    tx = _t(ctx)
    v = _vars(ctx)
    hook_text = hook_text or hook_for(ctx, "question")["text"]
    intro_map = tx["intro"]
    intro = _fmt(intro_map.get(ctx.tone) or intro_map["default"], **v)
    # Longer targets get more points.
    n_points = 3 if ctx.duration_seconds <= 45 else 4 if ctx.duration_seconds <= 90 else 5
    start = (zlib.crc32(f"{ctx.topic}|pts".encode()) + ctx.variation) % len(tx["points"])
    points = [_fmt(tx["points"][(start + i) % len(tx["points"])], **v) for i in range(n_points)]
    n_examples = 1 if ctx.duration_seconds <= 45 else 2
    ex_start = (zlib.crc32(f"{ctx.topic}|ex".encode()) + ctx.variation) % len(tx["examples"])
    examples = [_fmt(tx["examples"][(ex_start + i) % len(tx["examples"])], **v) for i in range(n_examples)]
    call = cta(ctx)
    ending = _fmt(_pick(tx["ending"], ctx, "ending"), **v)
    full = "\n\n".join([hook_text, intro, *points, *examples, call, ending])
    return {
        "hook": hook_text,
        "introduction": intro,
        "main_points": points,
        "examples": examples,
        "cta": call,
        "ending": ending,
        "full_script": full,
    }


# ---- caption / hashtags --------------------------------------------------------------------------
def caption(ctx: GenContext) -> dict:
    tx = _t(ctx)
    v = _vars(ctx)
    call = cta(ctx)
    h = hook_for(ctx, "benefit")["text"]
    kws = [_fmt(k, **v) for k in tx["keywords"]]
    return {
        "instagram_caption": _fmt(tx["ig"], h=h, cta=call, **v),
        "youtube_description": _fmt(tx["ytd"], cta=call, **v),
        "short_description": _fmt(tx["shortd"], **v)[:140],
        "cta": call,
        "keywords": kws,
    }


def hashtags(ctx: GenContext) -> dict:
    tx = _t(ctx)
    w = _word(ctx)
    cat = _category(ctx) or "_"
    broad = list(tx["tags_broad"].get(cat) or tx["tags_broad"]["_"])
    if ctx.platform in ("youtube", "youtube_shorts") and "#Shorts" not in broad:
        broad = broad[:5] + ["#Shorts"]
    medium = [_fmt(x, w=w) for x in tx["tags_medium"]]
    niche = [_fmt(x, w=w) for x in tx["tags_niche"]]
    return {"broad": broad, "medium": medium, "niche": niche}


# ---- ideas ---------------------------------------------------------------------------------------
def ideas(ctx: GenContext, trends: Iterable[str] = ()) -> list[dict]:
    tx = _t(ctx)
    v = _vars(ctx)
    formats = tx["idea_formats"]
    titles = tx["idea_titles"]
    trend_list = [t for t in trends if t][:2]
    out: list[dict] = []
    for i in range(6):
        fmt = formats[(i + ctx.variation) % len(formats)]
        topic = v["t"]
        if i < len(trend_list):
            topic = trend_list[i]
            reason = _fmt(tx["idea_reason_trend"], t=topic, f=fmt)
        else:
            reason = _fmt(tx["idea_reason"][i % len(tx["idea_reason"])], c=v["c"], f=fmt)
        idea_title = _fmt(titles[(i + ctx.variation) % len(titles)], **{**v, "t": topic})
        sub = replace(ctx, topic=topic, variation=ctx.variation + i)
        out.append({
            "title": idea_title[:190],
            "topic": topic[:190],
            "format": fmt[:58],
            "reason": reason,
            "suggested_hook": hook_for(sub, HOOK_ORDER[i % len(HOOK_ORDER)])["text"],
        })
    return out


def bundle(ctx: GenContext, trends: Iterable[str] = ()) -> dict:
    hk = hooks(ctx)
    return {
        "title": title(ctx),
        "hooks": hk,
        "script": script(ctx, hook_text=hk[0]["text"]),
        "caption": caption(ctx),
        "hashtags": hashtags(ctx),
        "cta": cta(ctx),
        "ideas": ideas(ctx, trends)[:4],
    }


# ---- assistant -----------------------------------------------------------------------------------
def detect_intent(text: str) -> str:
    low = (text or "").lower()
    for intent, words in INTENT_KEYWORDS.items():
        if any(w in low for w in words):
            return intent
    return "default"


def assistant_reply(ctx: GenContext, messages: list[dict[str, str]], trends: Iterable[str] = ()) -> str:
    last_user = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")
    intent = detect_intent(last_user)
    reply_ctx = ctx
    text = _t(ctx)["assistant"].get(intent) or _t(ctx)["assistant"]["default"]
    reply = _fmt(text, **_vars(reply_ctx))
    if intent == "trend":
        names = [t for t in trends if t][:3]
        if names:
            reply += " " + ", ".join(names)
    return reply


# ---- long to short -------------------------------------------------------------------------------
def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?।])\s+|\n+", text.strip())
    return [p.strip() for p in parts if len(p.strip()) >= 20]


def _clip(text: str, limit: int) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def long_to_short(ctx: GenContext, source_text: str, target_seconds: int = 45) -> list[dict]:
    tx = _t(ctx)
    sentences = _sentences(source_text) or [_clip(source_text, 200)]
    # Three roughly equal slices of the source so each short draws on a different section.
    size = max(1, len(sentences) // 3)
    slices = [sentences[i * size:(i + 1) * size] or sentences[-1:] for i in range(3)]
    if len(sentences) >= 3:
        slices[2] = sentences[2 * size:] or sentences[-1:]
    out: list[dict] = []
    base_ctx = ctx
    for i, chunk in enumerate(slices, start=1):
        key_section = _clip(" ".join(chunk[:2]), 260)
        k = _clip(chunk[0], 140)
        c = replace(base_ctx, variation=ctx.variation + i)
        v = {"n": i, "k": k, "s": min(max(target_seconds, 10), 60)}
        h = _fmt(_pick(tx["short_hook"], c, "sh", i), **v)
        call = tx["short_cta"]
        out.append({
            "short_idea": _fmt(tx["short_idea"][(i - 1 + ctx.variation) % len(tx["short_idea"])], n=i),
            "hook": h,
            "suggested_duration_seconds": max(15, min(target_seconds, 90)),
            "key_section": key_section,
            "short_script": _fmt(tx["short_script"], h=h, k=_clip(" ".join(chunk[:3]), 420), cta=call),
            "cta": call,
        })
    return out


def summarize(ctx: GenContext, text: str) -> str:
    sentences = _sentences(text)
    body = " ".join(sentences[:2]) if sentences else text.strip()
    return _t(ctx)["summary_prefix"] + _clip(body, 500)


def pattern_summary(ctx: GenContext, facts: dict[str, Any]) -> dict:
    tx = _t(ctx)
    topics = ", ".join(str(x) for x in (facts.get("frequent_topics") or [])[:4]) or "-"
    freq = str(facts.get("posting_frequency") or "")
    return {
        "summary": _fmt(tx["pattern"], topics=topics, freq=freq),
        "takeaways": list(tx["pattern_takeaways"]),
    }


assert set(LANGUAGES) <= set(TEXT)
