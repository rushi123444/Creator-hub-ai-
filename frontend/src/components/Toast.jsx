import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import { getFriendlyError } from '../services/api.js';

const ToastContext = createContext({ success() {}, error() {}, info() {}, fromError() {}, dismiss() {} });

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };

/**
 * ToastProvider (mounted once in main.jsx) and useToast().
 *   const toast = useToast();
 *   toast.success('Saved');  toast.error('Could not save');  toast.info('...');
 *   toast.fromError(err)  -> error toast with getFriendlyError(err)
 * Each accepts (message, { duration }) ; default 4s, errors 6s. Max 4 visible.
 */
export function ToastProvider({ children }) {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const idRef = useRef(0);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setItems((list) => list.filter((x) => x.id !== id));
    const tm = timers.current.get(id);
    if (tm) { clearTimeout(tm); timers.current.delete(id); }
  }, []);

  const push = useCallback((type, message, opts = {}) => {
    if (!message) return;
    const id = ++idRef.current;
    setItems((list) => [...list.slice(-3), { id, type, message }]);
    timers.current.set(id, setTimeout(() => dismiss(id), opts.duration ?? (type === 'error' ? 6000 : 4000)));
  }, [dismiss]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const api = useMemo(() => ({
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m, o),
    info: (m, o) => push('info', m, o),
    fromError: (e, o) => push('error', getFriendlyError(e), o),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="toasts" aria-live="polite" aria-atomic="false">
            {items.map((it) => {
              const Icon = ICONS[it.type];
              return (
                <div key={it.id} className={`toast toast--${it.type}`} role={it.type === 'error' ? 'alert' : 'status'}>
                  <Icon size={18} aria-hidden="true" className="toast__icon" />
                  <p className="toast__msg">{it.message}</p>
                  <button type="button" className="toast__x" onClick={() => dismiss(it.id)} aria-label={t('toast.dismiss', 'Dismiss')}>
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
