import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Plus, Trash2, Send, RotateCw, MessagesSquare, X, Eraser } from 'lucide-react';
import { Button, ConfirmDialog, CopyButton, EmptyState, IconButton, PageHeader, SampleBadge, Spinner, Textarea, useToast } from '../components';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { aiService } from '../services';
import { ApiError, getFriendlyError } from '../services/api.js';
import { STORAGE_KEYS } from '../utils';
import '../styles/pagesB1.css';

const PROMPT_KEYS = ['ast.p1', 'ast.p2', 'ast.p3', 'ast.p4', 'ast.p5'];
const PROMPTS = ['Give me 10 Reel ideas for coding students.', 'Rewrite this hook.', 'Make this script more engaging.', 'Convert this script into a 60-second Reel.', 'Give me 5 CTA options.'];
const UNAVAILABLE = 'AI generation is temporarily unavailable. Please try again.';
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const blank = () => ({ id: uid(), title: '', messages: [], updated: Date.now() });

export default function AIAssistant() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  useDocumentTitle(t('nav.assistant', 'AI Assistant'));
  const [store, setStore] = useLocalStorage(user?.id ? STORAGE_KEYS.chat(user.id) : null, null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const chats = Array.isArray(store?.chats) && store.chats.length ? store.chats : null;
  const [fallback] = useState(blank);
  const list = chats || [fallback];
  const active = list.find((c) => c.id === store?.activeId) || list[0];
  const sorted = useMemo(() => [...list].sort((a, b) => b.updated - a.updated), [list]);
  const persist = (nextChats, activeId = active.id) => setStore({ chats: nextChats.slice(0, 40), activeId });

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [active.messages.length, busy, active.id]);

  const updateChat = (id, fn, base = list) => {
    const next = base.map((c) => (c.id === id ? { ...fn(c), updated: Date.now() } : c));
    persist(next, id);
    return next;
  };

  const ask = async (messages, chatId, base) => {
    setBusy(true); setError('');
    try {
      const payload = { messages: messages.map((m) => ({ role: m.role, content: m.content })), language: lang };
      const r = await aiService.assistant(payload);
      const reply = r?.message?.content;
      if (!reply) throw new Error('empty');
      updateChat(chatId, (c) => ({ ...c, messages: [...messages, { id: uid(), role: 'assistant', content: reply, sample: !!r.is_sample }] }), base);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setError(code === 'RATE_LIMITED' || code === 'VALIDATION_ERROR' ? getFriendlyError(e) : UNAVAILABLE);
    }
    setBusy(false);
  };

  const send = async (raw) => {
    const content = (raw ?? text).trim();
    if (!content || busy) return;
    setText('');
    const msgs = [...active.messages, { id: uid(), role: 'user', content }];
    const base = chats ? list : [fallback];
    const next = base.map((c) => (c.id === active.id ? { ...c, title: c.title || content.slice(0, 48), messages: msgs, updated: Date.now() } : c));
    persist(next, active.id);
    await ask(msgs, active.id, next);
    inputRef.current?.focus();
  };

  const regenerate = async () => {
    const msgs = [...active.messages];
    while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
    if (!msgs.length || busy) return;
    const next = updateChat(active.id, (c) => ({ ...c, messages: msgs }));
    await ask(msgs, active.id, next);
  };

  const newChat = () => {
    if (!active.messages.length && chats) { setListOpen(false); inputRef.current?.focus(); return; }
    const c = blank();
    persist([c, ...(chats ? list : [])], c.id);
    setError(''); setListOpen(false);
  };
  const removeChat = (id) => {
    const rest = list.filter((c) => c.id !== id);
    if (!rest.length) rest.push(blank());
    persist(rest, id === active.id ? rest[0].id : active.id);
    toast.success(t('toast.deleted', 'Deleted'));
  };
  const clearChat = () => {
    updateChat(active.id, (c) => ({ ...c, messages: [], title: '' }));
    setConfirmClear(false); setError('');
    toast.success(t('toast.deleted', 'Deleted'));
  };

  const lastAi = [...active.messages].reverse().find((m) => m.role === 'assistant');
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className="page">
      <PageHeader
        title={t('ast.title', 'AI Assistant')}
        description={t('ast.desc', 'Ask for ideas, rewrites and scripts. Your chats stay on this device.')}
        actions={(
          <div className="row row--sm">
            <Button className="chat__toggle" variant="secondary" icon={MessagesSquare} onClick={() => setListOpen((o) => !o)}>{t('ast.chats', 'Conversations')}</Button>
            <Button variant="secondary" icon={Eraser} disabled={!active.messages.length} onClick={() => setConfirmClear(true)}>{t('ast.clear', 'Clear chat')}</Button>
            <Button icon={Plus} onClick={newChat}>{t('ast.new', 'New chat')}</Button>
          </div>
        )}
      />
      <div className="chat">
        <aside className={`chat__side${listOpen ? ' open' : ''}`} aria-label={t('ast.chats', 'Conversations')}>
          <div className="chat__list">
            {sorted.map((c) => (
              <div key={c.id} className={`chat__item${c.id === active.id ? ' on' : ''}`}>
                <button type="button" onClick={() => { persist(list, c.id); setListOpen(false); setError(''); }}>{c.title || t('ast.untitled', 'New conversation')}</button>
                {(c.messages.length > 0) && <IconButton size="sm" label={t('ast.delete', 'Delete conversation')} icon={Trash2} onClick={() => removeChat(c.id)} />}
              </div>
            ))}
          </div>
        </aside>
        <section className="chat__main">
          <div className="chat__scroll" aria-live="polite">
            {!active.messages.length ? (
              <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 560 }}>
                <EmptyState icon={Sparkles} title={t('ast.emptyTitle', 'How can I help with your content?')} description={t('ast.emptyDesc', 'Try one of these to get started.')} compact />
                <div className="chat__prompts">
                  {PROMPTS.map((p, i) => <Button key={p} size="sm" variant="secondary" onClick={() => send(p)} disabled={busy}>{PROMPT_KEYS[i] && t(PROMPT_KEYS[i], p)}</Button>)}
                </div>
              </div>
            ) : active.messages.map((m) => (
              <div key={m.id} className={`chat__msg chat__msg--${m.role === 'user' ? 'user' : 'ai'}`}>
                <div className="chat__meta">
                  <span>{m.role === 'user' ? t('ast.you', 'You') : t('ast.ai', 'Assistant')}</span>
                  {m.sample && <SampleBadge />}
                </div>
                <div className="chat__bubble">{m.content}</div>
                {m.role === 'assistant' && (
                  <div className="row row--sm">
                    <CopyButton text={m.content} iconOnly size="sm" />
                    {m === lastAi && m === active.messages[active.messages.length - 1] && (
                      <IconButton size="sm" label={t('common.regenerate', 'Regenerate')} icon={RotateCw} onClick={regenerate} disabled={busy} />
                    )}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="chat__msg chat__msg--ai"><div className="chat__bubble row row--sm"><Spinner size={14} /> <span className="muted">{t('ast.thinking', 'Thinking…')}</span></div></div>}
            {error && (
              <div className="chat__msg chat__msg--ai" role="alert">
                <div className="chat__bubble" style={{ borderColor: 'var(--danger)' }}>{error === UNAVAILABLE ? t('ast.unavailable', UNAVAILABLE) : error}</div>
                <div className="row row--sm">
                  <Button size="sm" variant="secondary" icon={RotateCw} onClick={() => (active.messages[active.messages.length - 1]?.role === 'user' ? ask(active.messages, active.id, list) : regenerate())}>{t('common.retry', 'Retry')}</Button>
                  <IconButton size="sm" label={t('common.close', 'Close')} icon={X} onClick={() => setError('')} />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form className="chat__compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <Textarea ref={inputRef} rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} maxLength={4000}
              placeholder={t('ast.placeholder', 'Ask anything about your content…')} aria-label={t('ast.placeholder', 'Ask anything about your content…')} />
            <Button type="submit" icon={Send} loading={busy} disabled={!text.trim()}>{t('ast.send', 'Send')}</Button>
          </form>
        </section>
      </div>
      <ConfirmDialog open={confirmClear} onClose={() => setConfirmClear(false)} onConfirm={clearChat} danger
        title={t('ast.clearTitle', 'Clear this chat?')} description={t('ast.clearDesc', 'All messages in this conversation will be removed.')} confirmLabel={t('ast.clear', 'Clear chat')} />
    </div>
  );
}
