"""Import all models so Base.metadata is complete (needed by create_all / Alembic / seeding)."""
from app.models.content import (  # noqa: F401
    CONTENT_STATUSES, Caption, Content, ContentCalendar, ContentIdea, Hashtag, Hook, Script,
)
from app.models.insights import (  # noqa: F401
    AnalyticsEntry, Competitor, Recommendation, Trend, TrendTopic,
)
from app.models.reference import Category, Language, Platform  # noqa: F401
from app.models.system import AIRequest, Notification, PlatformSetting, Report  # noqa: F401
from app.models.user import (  # noqa: F401
    ROLES, CreatorProfile, EditorProfile, EditorSkill, Profile, User,
)
