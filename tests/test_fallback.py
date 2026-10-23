"""Failure handling: AI provider failures -> 503 AI_UNAVAILABLE (no provider text); YouTube failure -> sample; rate limit."""
import pytest

from app.config.settings import reset_settings_cache

FRIENDLY = "AI generation is temporarily unavailable. Please try again."
SECRET = "provider-secret-detail-xyz"


@pytest.fixture()
def live_ai(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-not-real")
    monkeypatch.setattr("app.ai.client.RETRY_DELAY_SECONDS", 0)
    reset_settings_cache()
    yield
    monkeypatch.undo()
    reset_settings_cache()


class _Resp:
    def __init__(self, text):
        self.output_text = text


def _fake(behaviour):
    class Responses:
        calls = 0

        def create(self, **kw):
            Responses.calls += 1
            return behaviour(Responses.calls)

    class Client:
        responses = Responses()

    return Client()


@pytest.mark.parametrize("behaviour", [
    lambda n: (_ for _ in ()).throw(RuntimeError(SECRET)),
    lambda n: (_ for _ in ()).throw(TimeoutError(SECRET)),
    lambda n: _Resp(""),
    lambda n: _Resp("not json {" + SECRET),
    lambda n: _Resp("[1, 2]"),
])
def test_ai_failures_return_503_without_provider_text(client, creator_headers, live_ai, monkeypatch, behaviour):
    monkeypatch.setattr("app.ai.client.get_client", lambda: _fake(behaviour))
    r = client.post("/api/v1/ai/hooks", json={"topic": "AI tools"}, headers=creator_headers)
    assert r.status_code == 503, r.text
    assert r.json() == {"error": {"code": "AI_UNAVAILABLE", "message": FRIENDLY}}
    assert SECRET not in r.text


def test_timeout_is_retried_once(client, creator_headers, live_ai, monkeypatch):
    fake = _fake(lambda n: (_ for _ in ()).throw(TimeoutError("slow")))
    monkeypatch.setattr("app.ai.client.get_client", lambda: fake)
    assert client.post("/api/v1/ai/script", json={"topic": "x topic"}, headers=creator_headers).status_code == 503
    assert fake.responses.calls == 2


def test_rate_limit_429(client, creator_headers, monkeypatch):
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "2")
    reset_settings_cache()
    try:
        codes = [client.post("/api/v1/ai/hooks", json={"topic": "AI tools"}, headers=creator_headers).status_code for _ in range(3)]
    finally:
        monkeypatch.undo()
        reset_settings_cache()
    assert codes == [200, 200, 429]


def test_youtube_failure_falls_back_to_sample(client, creator_headers, monkeypatch):
    from app.services import youtube_service as yt

    monkeypatch.setenv("YOUTUBE_API_KEY", "yt-test-key")
    reset_settings_cache()

    def boom(*a, **k):
        raise yt.YouTubeError("quota")

    monkeypatch.setattr(yt, "_get", boom)
    try:
        r = client.post("/api/v1/trends/refresh", headers=creator_headers)
        assert r.status_code == 200 and r.json()["source"] == "sample"
        assert r.json()["note"] == "Showing available sample insights."
        c = client.post("/api/v1/competitors/analyze", json={"platform": "youtube", "handle_or_url": "@someone"}, headers=creator_headers)
        assert c.status_code == 200 and c.json()["is_sample"] is True
        listing = client.get("/api/v1/trends", headers=creator_headers)
        assert listing.status_code == 200 and listing.json()["items"]
    finally:
        monkeypatch.undo()
        reset_settings_cache()
    assert "yt-test-key" not in r.text and "quota" not in r.text


def test_youtube_live_parsing(client, creator_headers, monkeypatch):
    from app.services import youtube_service as yt

    assert yt.parse_duration("PT1H2M3S") == 3723 and yt.parse_duration("PT45S") == 45 and yt.parse_duration("bad") == 0

    def fake_get(path, params):
        if path == "channels":
            return {"items": [{"id": "UC1", "snippet": {"title": "Live Chan"}, "statistics": {"subscriberCount": "10"},
                               "contentDetails": {"relatedPlaylists": {"uploads": "UU1"}}}]}
        if path == "playlistItems":
            return {"items": [{"contentDetails": {"videoId": "v1"}}, {"contentDetails": {"videoId": "v2"}}]}
        return {"items": [
            {"id": "v1", "snippet": {"title": "Python basics tutorial", "publishedAt": "2026-09-20T10:00:00Z", "tags": ["python"]},
             "statistics": {"viewCount": "1000", "likeCount": "50", "commentCount": "5"}, "contentDetails": {"duration": "PT8M"}},
            {"id": "v2", "snippet": {"title": "Python tips shorts", "publishedAt": "2026-09-25T10:00:00Z", "tags": ["python"]},
             "statistics": {"viewCount": "3000", "likeCount": "90", "commentCount": "9"}, "contentDetails": {"duration": "PT30S"}}]}

    monkeypatch.setenv("YOUTUBE_API_KEY", "yt-test-key")
    reset_settings_cache()
    monkeypatch.setattr(yt, "_get", fake_get)
    try:
        d = client.post("/api/v1/competitors/analyze", json={"platform": "youtube", "handle_or_url": "@live"}, headers=creator_headers).json()
    finally:
        monkeypatch.undo()
        reset_settings_cache()
    assert d["is_sample"] is False and d["display_name"] == "Live Chan" and d["views"] == 4000 and "python" in d["frequent_topics"]
