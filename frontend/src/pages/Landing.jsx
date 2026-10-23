import { useState } from 'react';
import {
  ArrowRight, BarChart3, CalendarDays, Check, Compass, Globe2, Layers, LayoutDashboard, Languages,
  Sparkles, TrendingUp, Wand2, Zap, BadgeCheck, Target, Bot, Users,
} from 'lucide-react';
import { Button, Badge } from '../components';
import { PublicNav, PublicFooter } from '../layouts/PublicLayout.jsx';
import { useI18n } from '../i18n';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import '../styles/pagesA.css';

const LINKS = [
  { href: '#features', key: 'landing.nav.features', label: 'Features' },
  { href: '#studio', key: 'nav.studio', label: 'AI Studio' },
  { href: '#trends', key: 'nav.trends', label: 'Trends' },
  { href: '#analytics', key: 'nav.analytics', label: 'Analytics' },
  { href: '#editors', key: 'landing.nav.editors', label: 'Editors' },
];

function DashboardPreview() {
  const pts = [18, 26, 22, 34, 30, 44, 40, 56, 50, 66, 62, 78];
  const w = 360, h = 110;
  const xy = pts.map((p, i) => [(i / (pts.length - 1)) * w, h - (p / 90) * h]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <div className="mock-wrap" aria-hidden="true">
      <div className="mock">
        <div className="mock__bar"><i className="mock__dot" /><i className="mock__dot" /><i className="mock__dot" /><span className="mock__url">app.creatorhub.ai/dashboard</span></div>
        <div className="mock__body">
          <div className="mock__side">
            <div className="on"><LayoutDashboard size={14} /> Dashboard</div>
            <div><Sparkles size={14} /> AI Studio</div>
            <div><TrendingUp size={14} /> Trends</div>
            <div><Layers size={14} /> Content</div>
            <div><CalendarDays size={14} /> Calendar</div>
            <div><BarChart3 size={14} /> Analytics</div>
          </div>
          <div className="mock__main">
            <div className="mock__stats">
              {[['Total views', '232.6K', '+12%'], ['Engagement', '8.3%', '+0.9'], ['Saved ideas', '24', ''], ['Scheduled', '6', '']].map(([a, b, c]) => (
                <div className="mock__stat" key={a}><small>{a}</small><b>{b}</b>{c && <i>{c}</i>}</div>
              ))}
            </div>
            <div className="mock__row">
              <div className="mock__panel">
                <h4>Performance overview</h4>
                <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="120" preserveAspectRatio="none">
                  <defs><linearGradient id="lg1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".4" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
                  {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke="var(--chart-grid)" strokeDasharray="3 3" />)}
                  <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="url(#lg1)" />
                  <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" />
                  <path d={xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${(y + 18 + (i % 3) * 3).toFixed(1)}`).join(' ')} fill="none" stroke="var(--chart-2)" strokeWidth="1.8" strokeDasharray="4 3" />
                </svg>
              </div>
              <div className="mock__panel">
                <h4>Trending now</h4>
                {[['Study with AI tools', '68'], ['Mobile safety tips', '61'], ['Budget travel hacks', '55']].map(([a, b]) => <div className="mock__li" key={a}><span>{a}</span><span>{b}</span></div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mock__float">
        <div className="row row--sm" style={{ marginBottom: 6 }}><Sparkles size={13} color="var(--accent-text)" /><b>Hook generated</b></div>
        “Did you know 3 free AI tools can cut your study time in half?”
      </div>
    </div>
  );
}

const WHY = [
  [Wand2, 'landing.why1.t', 'One place for the whole workflow', 'landing.why1.d', 'Ideas, scripts, captions, scheduling and results live together, so nothing slips between tabs and spreadsheets.'],
  [TrendingUp, 'landing.why2.t', 'Decisions backed by data', 'landing.why2.d', 'Transparent trend scores and clear engagement formulas show what is moving, and why.'],
  [Languages, 'landing.why3.t', 'English, Hindi and Marathi', 'landing.why3.d', 'Create and read in the language your audience actually speaks, with natural tone, not word-for-word translation.'],
  [Target, 'landing.why4.t', 'Personalised to you', 'landing.why4.d', 'Your niche, platform, level and style shape every suggestion from the first draft.'],
  [Zap, 'landing.why5.t', 'Fast first drafts', 'landing.why5.d', 'Go from a rough topic to hooks, script, caption and hashtags in one click, then refine each piece.'],
  [BadgeCheck, 'landing.why6.t', 'Honest insights', 'landing.why6.d', 'Analysis shows patterns and experiments to try. It never promises virality.'],
];

const STEPS = [
  ['landing.how1.t', 'Set up your profile', 'landing.how1.d', 'Pick your platform, niche and language in under a minute.'],
  ['landing.how2.t', 'Discover what is trending', 'landing.how2.d', 'Browse scored topics and send one straight to the studio.'],
  ['landing.how3.t', 'Create and plan', 'landing.how3.d', 'Generate hooks, script and captions, then place them on your calendar.'],
  ['landing.how4.t', 'Learn from results', 'landing.how4.d', 'Log performance, read the patterns and decide what to try next.'],
];

const EDITORS = [
  ['Riya Kulkarni', 'Reels editor', ['Reels', 'Captions'], 'mr · hi · en'],
  ['Sameer Khan', 'YouTube editor', ['Long-form', 'Thumbnails'], 'hi · en'],
  ['Neha Patil', 'Motion graphics', ['Titles', 'Animation'], 'mr · en'],
];

function Check2({ children }) { return <li><Check size={16} />{children}</li>; }

export default function Landing() {
  const { t } = useI18n();
  const [lang, setLang] = useState('mr');
  useDocumentTitle('');
  const samples = {
    en: ['Hook', 'Did you know 3 free AI tools can cut your study time in half?'],
    hi: ['हुक', 'क्या आप जानते हैं कि 3 मुफ़्त एआय टूल आपकी पढ़ाई का समय आधा कर सकते हैं?'],
    mr: ['हुक', 'तुम्हाला माहिती आहे का, 3 मोफत एआय टूल्स तुमचा अभ्यासाचा वेळ निम्मा करू शकतात?'],
  };

  return (
    <div className="public">
      <PublicNav links={LINKS} />
      <main id="main">
        <section className="land-hero">
          <div className="land-wrap land-hero__grid">
            <div className="land-hero__copy">
              <Badge tone="accent" icon={Sparkles}>{t('landing.badge', 'AI-Powered Creator Environment')}</Badge>
              <h1>{t('landing.h1a', 'Create Smarter.')} <em>{t('landing.h1b', 'Grow With Data.')}</em></h1>
              <p className="sub">{t('landing.sub', 'Discover trends, generate content, plan your workflow and understand performance — all from one intelligent creator environment.')}</p>
              <div className="land-hero__cta">
                <Button to="/register" size="lg" iconRight={ArrowRight}>{t('landing.start', 'Start Creating')}</Button>
                <Button href="#features" variant="secondary" size="lg">{t('landing.explore', 'Explore Features')}</Button>
              </div>
              <div className="land-proof">
                <span><Check size={14} />{t('landing.proof1', 'Free to start')}</span>
                <span><Check size={14} />{t('landing.proof2', 'English, Hindi, Marathi')}</span>
                <span><Check size={14} />{t('landing.proof3', 'Built for creators and editors')}</span>
              </div>
            </div>
            <DashboardPreview />
          </div>
        </section>

        <section className="land-section" id="features">
          <div className="land-wrap">
            <p className="land-eyebrow">{t('landing.why.eyebrow', 'Why CreatorHub AI')}</p>
            <h2 className="land-h2">{t('landing.why.h', 'Less guesswork. More of what works.')}</h2>
            <p className="land-lead">{t('landing.why.lead', 'Most creators juggle five tools and a gut feeling. CreatorHub AI brings research, creation, planning and learning into one calm workspace.')}</p>
            <div className="feat-grid">
              {WHY.map(([Icon, tk, tf, dk, df]) => (
                <article className="feat" key={tk}><span className="feat__icon"><Icon size={19} /></span><h3>{t(tk, tf)}</h3><p>{t(dk, df)}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section className="land-section land-section--alt" id="studio">
          <div className="land-wrap split">
            <div>
              <p className="land-eyebrow">{t('nav.studio', 'AI Studio')}</p>
              <h2 className="land-h2">{t('landing.studio.h', 'Turn an idea into ready-to-publish content.')}</h2>
              <p className="land-lead">{t('landing.studio.lead', 'Describe your topic once. Get hooks, a full script, caption, hashtags, title and a call to action, each one editable, copyable and regenerable on its own.')}</p>
              <ul className="checks">
                <Check2>{t('landing.studio.c1', 'Five hook styles: question, curiosity, problem, benefit, story')}</Check2>
                <Check2>{t('landing.studio.c2', 'Tone, platform, duration and audience controls')}</Check2>
                <Check2>{t('landing.studio.c3', 'Save the best pieces to your library or content pipeline')}</Check2>
              </ul>
              <div style={{ marginTop: 24 }}><Button to="/register" iconRight={ArrowRight}>{t('landing.tryStudio', 'Try the studio')}</Button></div>
            </div>
            <div className="viz" aria-hidden="true">
              <div className="row row--between"><b>{t('landing.studio.card', 'Hooks')}</b><Badge tone="accent" dot>Reels</Badge></div>
              <div className="viz__out"><b>{t('hook.question', 'Question')}</b>Are you still writing captions from scratch?</div>
              <div className="viz__out"><b>{t('hook.curiosity', 'Curiosity')}</b>The one editing trick small creators keep missing.</div>
              <div className="viz__out"><b>{t('hook.benefit', 'Benefit')}</b>Plan a full week of content in 20 minutes.</div>
            </div>
          </div>
        </section>

        <section className="land-section" id="trends">
          <div className="land-wrap split split--rev">
            <div>
              <p className="land-eyebrow">{t('nav.trends', 'Trends')}</p>
              <h2 className="land-h2">{t('landing.trends.h', 'Discover trends before you commit.')}</h2>
              <p className="land-lead">{t('landing.trends.lead', 'Every topic gets a transparent Trend Score built from recency, growth, engagement and topic frequency. Not an official platform metric, just a clear way to compare ideas.')}</p>
              <ul className="checks">
                <Check2>{t('landing.trends.c1', 'Filter by platform, category, language and time range')}</Check2>
                <Check2>{t('landing.trends.c2', 'See the breakdown behind every score')}</Check2>
                <Check2>{t('landing.trends.c3', 'Send a trend to the studio in one click')}</Check2>
              </ul>
            </div>
            <div className="viz" aria-hidden="true">
              {[['Study with AI tools', 'Education · Instagram', 82], ['Budget phone reviews', 'Technology · YouTube', 71], ['10-minute home workouts', 'Fitness · Shorts', 64], ['Small business reels', 'Business · Instagram', 52]].map(([a, b, v]) => (
                <div className="trend-row" key={a}><b>{a}</b><span className="tabular" style={{ color: 'var(--accent-text)', fontWeight: 700 }}>{v}</span><small>{b}</small><div className="trend-bar"><i style={{ width: `${v}%` }} /></div></div>
              ))}
            </div>
          </div>
        </section>

        <section className="land-section land-section--alt" id="analytics">
          <div className="land-wrap split">
            <div>
              <p className="land-eyebrow">{t('landing.analytics.eyebrow', 'Performance Analytics')}</p>
              <h2 className="land-h2">{t('landing.analytics.h', 'Understand performance, not just numbers.')}</h2>
              <p className="land-lead">{t('landing.analytics.lead', 'Log your results and see views, engagement and the formats that work best for your audience. Formulas are shown, never hidden.')}</p>
              <ul className="checks">
                <Check2>{t('landing.analytics.c1', 'Views and engagement over time')}</Check2>
                <Check2>{t('landing.analytics.c2', 'Platform, category and language breakdowns')}</Check2>
                <Check2>{t('landing.analytics.c3', 'Content analyzer with experiments to try next')}</Check2>
              </ul>
            </div>
            <div className="viz" aria-hidden="true">
              <svg viewBox="0 0 400 170" width="100%" height="190">
                {[0, 1, 2, 3].map((i) => <line key={i} x1="0" x2="400" y1={20 + i * 40} y2={20 + i * 40} stroke="var(--chart-grid)" strokeDasharray="3 3" />)}
                {[40, 62, 48, 90, 74, 112, 96, 130, 118, 140].map((v, i) => <rect key={i} x={10 + i * 39} y={160 - v} width="24" height={v} rx="5" fill={i % 3 === 0 ? 'var(--chart-2)' : 'var(--accent)'} opacity={0.35 + i * 0.065} />)}
              </svg>
              <div className="row row--between text-sm muted"><span>Engagement rate</span><b style={{ color: 'var(--text)' }}>8.3%</b></div>
            </div>
          </div>
        </section>

        <section className="land-section" id="calendar">
          <div className="land-wrap split split--rev">
            <div>
              <p className="land-eyebrow">{t('nav.calendar', 'Content Calendar')}</p>
              <h2 className="land-h2">{t('landing.cal.h', 'Plan the week. Keep the rhythm.')}</h2>
              <p className="land-lead">{t('landing.cal.lead', 'Move content from idea to published on a simple calendar. Statuses stay in sync between your pipeline and your schedule.')}</p>
              <ul className="checks">
                <Check2>{t('landing.cal.c1', 'Month and week views')}</Check2>
                <Check2>{t('landing.cal.c2', 'Idea, draft, script, recording, editing, scheduled, published')}</Check2>
              </ul>
            </div>
            <div className="viz" aria-hidden="true">
              <div className="cal-mini">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
                {Array.from({ length: 21 }, (_, i) => (
                  <div key={i}>{i + 1}{[2, 5, 9, 12, 16].includes(i) && <i style={{ background: ['var(--st-scheduled)', 'var(--st-editing)', 'var(--st-published)', 'var(--st-script)', 'var(--st-draft)'][[2, 5, 9, 12, 16].indexOf(i)] }} />}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="land-section land-section--alt" id="multilingual">
          <div className="land-wrap split">
            <div>
              <p className="land-eyebrow">{t('landing.lang.eyebrow', 'Multilingual Creation')}</p>
              <h2 className="land-h2">{t('landing.lang.h', 'Create in the language your audience speaks.')}</h2>
              <p className="land-lead">{t('landing.lang.lead', 'Generate and read content in English, Hindi or Marathi. The whole interface switches too.')}</p>
              <div style={{ marginTop: 20 }}><Globe2 size={20} color="var(--accent-text)" /></div>
            </div>
            <div className="viz">
              <div className="lang-tabs" role="tablist" aria-label="Language preview">
                {[['en', 'English'], ['hi', 'हिन्दी'], ['mr', 'मराठी']].map(([c, l]) => (
                  <Button key={c} size="sm" variant={lang === c ? 'primary' : 'secondary'} role="tab" aria-selected={lang === c} onClick={() => setLang(c)}>{l}</Button>
                ))}
              </div>
              <div className="viz__out"><b>{samples[lang][0]}</b>{samples[lang][1]}</div>
            </div>
          </div>
        </section>

        <section className="land-section" id="editors">
          <div className="land-wrap">
            <p className="land-eyebrow">{t('landing.ed.eyebrow', 'Editor Directory')}</p>
            <h2 className="land-h2">{t('landing.ed.h', 'Find an editor who fits your style.')}</h2>
            <p className="land-lead">{t('landing.ed.lead', 'Browse verified video editors by specialization and language, view portfolios and reach out directly.')}</p>
            <div className="editor-cards" aria-hidden="true">
              {EDITORS.map(([n, h, tags, l]) => (
                <div className="editor-card" key={n}>
                  <div className="row"><Compass size={18} color="var(--accent-text)" /><b>{n}</b></div>
                  <span className="muted text-sm">{h}</span>
                  <div className="row row--wrap row--sm">{tags.map((x) => <span className="mock__chip" key={x}>{x}</span>)}</div>
                  <span className="faint text-xs">{l}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 24 }}><Button to="/register" variant="secondary" icon={Users}>{t('landing.ed.cta', 'Join as a creator or editor')}</Button></div>
          </div>
        </section>

        <section className="land-section land-section--alt" id="how">
          <div className="land-wrap">
            <p className="land-eyebrow">{t('landing.how.eyebrow', 'How It Works')}</p>
            <h2 className="land-h2">{t('landing.how.h', 'From first idea to learning loop.')}</h2>
            <div className="steps">
              {STEPS.map(([tk, tf, dk, df]) => <div className="step" key={tk}><h3>{t(tk, tf)}</h3><p>{t(dk, df)}</p></div>)}
            </div>
          </div>
        </section>

        <section className="land-section">
          <div className="land-wrap">
            <div className="cta-box">
              <Bot size={28} color="var(--accent-text)" />
              <h2>{t('landing.cta.h', 'Ready to create smarter?')}</h2>
              <p className="muted" style={{ maxWidth: '52ch' }}>{t('landing.cta.p', 'Set up your creator profile in a minute and generate your first piece of content today.')}</p>
              <div className="land-hero__cta">
                <Button to="/register" size="lg" iconRight={ArrowRight}>{t('landing.start', 'Start Creating')}</Button>
                <Button to="/login" variant="secondary" size="lg">{t('public.login', 'Log in')}</Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter links={[{ to: '/forgot-password', label: t('auth.forgot', 'Forgot password?') }]} />
    </div>
  );
}
