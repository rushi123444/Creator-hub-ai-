"""AI routes in sample mode (no OpenAI key): shapes, languages, regenerate, assistant, long-to-short."""
import re

import pytest

DEVANAGARI = re.compile(r"[ऀ-ॿ]")
LONG_TEXT = (
    "Learning to code is easier when you build small projects every week. "
    "Start with a simple calculator, then move to a to-do list, and finally a small website. "
    "Most beginners quit because they try to learn everything at once instead of one concept at a time. "
    "Keep a notebook of mistakes, because every bug you fix teaches you something you will not forget."
)


def post(client, headers, path, body):
    return client.post(f"/api/v1/ai/{path}", json=body, headers=headers)


@pytest.mark.parametrize("lang", ["en", "hi", "mr"])
def test_generate_bundle_shape_and_language(client, creator_headers, lang):
    r = post(client, creator_headers, "generate", {"topic": "AI tools" if lang == "en" else "एआय टूल्स", "language": lang})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["is_sample"] is True and d["model"]
    assert [h["type"] for h in d["hooks"]] == ["question", "curiosity", "problem", "benefit", "story"]
    assert set(d["script"]) >= {"hook", "introduction", "main_points", "examples", "cta", "ending", "full_script"}
    assert set(d["caption"]) >= {"instagram_caption", "youtube_description", "short_description", "cta", "keywords"}
    assert set(d["hashtags"]) == {"broad", "medium", "niche"} and all(d["hashtags"].values())
    assert d["ideas"] and set(d["ideas"][0]) >= {"title", "topic", "format", "reason", "suggested_hook"}
    if lang in ("hi", "mr"):
        assert DEVANAGARI.search(d["hooks"][0]["text"])
        assert DEVANAGARI.search(d["script"]["full_script"])
        assert DEVANAGARI.search(d["caption"]["instagram_caption"])
    else:
        assert not DEVANAGARI.search(d["script"]["full_script"])


@pytest.mark.parametrize("lang", ["hi", "mr"])
def test_individual_routes_devanagari(client, creator_headers, lang):
    body = {"topic": "फिटनेस", "language": lang}
    hooks = post(client, creator_headers, "hooks", body).json()["hooks"]
    assert len(hooks) == 5 and all(DEVANAGARI.search(h["text"]) for h in hooks)
    script = post(client, creator_headers, "script", body).json()["script"]
    assert DEVANAGARI.search(script["introduction"])
    caption = post(client, creator_headers, "caption", body).json()["caption"]
    assert DEVANAGARI.search(caption["youtube_description"])
    tags = post(client, creator_headers, "hashtags", body).json()["hashtags"]
    assert any(DEVANAGARI.search(t) for t in tags["broad"] + tags["medium"] + tags["niche"])
    assert all(t.startswith("#") for t in tags["broad"])


def test_hooks_script_caption_hashtags_ideas_en(client, creator_headers):
    body = {"topic": "Python for beginners", "language": "en", "platform": "youtube", "tone": "funny"}
    for path, key in (("hooks", "hooks"), ("script", "script"), ("caption", "caption"), ("hashtags", "hashtags"), ("ideas", "ideas")):
        r = post(client, creator_headers, path, body)
        assert r.status_code == 200
        assert key in r.json() and r.json()["is_sample"] is True
    ideas = post(client, creator_headers, "ideas", body).json()["ideas"]
    assert len(ideas) >= 4


def test_profile_personalises_defaults(client, creator_headers):
    d = post(client, creator_headers, "hooks", {"topic": "लॅपटॉप"}).json()  # demo creator prefers Marathi
    assert DEVANAGARI.search(d["hooks"][0]["text"])


def test_regenerate_sections_differ(client, creator_headers):
    params = {"topic": "budget phones", "language": "en"}
    first = post(client, creator_headers, "hooks", params).json()["hooks"]
    r = post(client, creator_headers, "regenerate", {"section": "hooks", "params": params, "current": first})
    assert r.status_code == 200 and r.json()["section"] == "hooks"
    assert len(r.json()["value"]) == 5 and r.json()["value"] != first
    for section in ("script", "caption", "hashtags", "title", "cta", "ideas"):
        r = post(client, creator_headers, "regenerate", {"section": section, "params": params})
        assert r.status_code == 200, section
        assert r.json()["value"] and r.json()["is_sample"] is True
    h = post(client, creator_headers, "regenerate", {"section": "hook", "hook_type": "story", "params": params}).json()
    assert h["value"]["type"] == "story" and h["value"]["text"]


def test_regenerate_rejects_bad_section(client, creator_headers):
    r = post(client, creator_headers, "regenerate", {"section": "nope", "params": {}})
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize("lang,msg", [("en", "Can you suggest a hook for my reel?"), ("hi", "मुझे स्क्रिप्ट चाहिए"), ("mr", "मला कॅप्शन हवं आहे")])
def test_assistant(client, creator_headers, lang, msg):
    r = post(client, creator_headers, "assistant", {"messages": [{"role": "user", "content": msg}], "language": lang})
    assert r.status_code == 200
    d = r.json()
    assert d["message"]["role"] == "assistant" and d["message"]["content"] and d["is_sample"] is True
    if lang != "en":
        assert DEVANAGARI.search(d["message"]["content"])
    assert "guarantee" not in d["message"]["content"].lower()


def test_assistant_validation(client, creator_headers):
    assert post(client, creator_headers, "assistant", {"messages": []}).status_code == 422
    assert post(client, creator_headers, "assistant", {"messages": [{"role": "system", "content": "x"}]}).status_code == 422


@pytest.mark.parametrize("lang", ["en", "hi", "mr"])
def test_long_to_short_three_shorts(client, creator_headers, lang):
    r = post(client, creator_headers, "long-to-short", {"source_text": LONG_TEXT, "language": lang, "target_platform": "youtube_shorts"})
    assert r.status_code == 200
    shorts = r.json()["shorts"]
    assert len(shorts) == 3
    for s in shorts:
        assert set(s) >= {"short_idea", "hook", "suggested_duration_seconds", "key_section", "short_script", "cta"}
        assert s["suggested_duration_seconds"] > 0
    if lang != "en":
        assert DEVANAGARI.search(shorts[0]["hook"])


def test_long_to_short_min_length_422(client, creator_headers):
    r = post(client, creator_headers, "long-to-short", {"source_text": "too short", "language": "en"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    r = post(client, creator_headers, "long-to-short", {"source_text": "x" * 30001, "language": "en"})
    assert r.status_code == 422


def test_input_limits(client, creator_headers):
    assert post(client, creator_headers, "hooks", {"topic": "a" * 201}).status_code == 422
    assert post(client, creator_headers, "hooks", {"topic": "ok", "instructions": "a" * 1001}).status_code == 422
    assert post(client, creator_headers, "hooks", {"topic": "ok", "language": "fr"}).status_code == 422


def test_summarize_and_classify(client, creator_headers):
    s = post(client, creator_headers, "summarize", {"text": LONG_TEXT, "language": "en"}).json()
    assert s["summary"].startswith("In short")
    c = post(client, creator_headers, "classify-topic", {"text": "Best workout and gym diet plan for weight loss"}).json()
    assert c["category"] == "Fitness" and c["confidence_label"] in ("low", "medium", "high")


def test_requires_auth(client):
    r = client.post("/api/v1/ai/hooks", json={"topic": "x"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "UNAUTHORIZED"


def test_ai_requests_logged_metadata_only(client, creator_headers, db):
    from sqlalchemy import select
    from app.models.system import AIRequest

    before = len(db.scalars(select(AIRequest)).all())
    post(client, creator_headers, "hooks", {"topic": "secret-topic-xyz", "language": "en"})
    db.expire_all()
    rows = db.scalars(select(AIRequest)).all()
    assert len(rows) == before + 1
    row = rows[-1] if rows[-1].feature == "hooks" else [r for r in rows if r.feature == "hooks"][-1]
    assert row.status == "sample" and row.language_code == "en" and row.input_chars > 0
    assert "secret-topic-xyz" not in repr(row.__dict__)
