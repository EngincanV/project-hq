import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useMessages } from '../i18n';
import { cx } from './cx';
import { IconButton } from './IconButton';
import { uiMessages } from './messages';
import styles from './Toast.module.css';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastApi {
  /** Shows a short message. Errors stay 8 s, others 4 s, unless `durationMs` is given. */
  show: (message: string, tone?: ToastTone, durationMs?: number) => void;
}

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Renders toasts in an aria-live region. Wrap the app once. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useMessages(uiMessages);
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((i) => i.id !== id)), []);

  const show = useCallback<ToastApi['show']>(
    (message, tone = 'info', durationMs) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-3), { id, message, tone }]);
      setTimeout(() => dismiss(id), durationMs ?? (tone === 'error' ? 8000 : 4000));
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={cx(styles.toast, styles[item.tone])}>
            <span className={styles.message}>{item.message}</span>
            <IconButton size="sm" label={t.dismiss} icon={<X size={14} />} onClick={() => dismiss(item.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** `const toast = useToast(); toast.show('Saved', 'success')`. Needs `<ToastProvider>`. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast() must be used inside <ToastProvider>');
  return api;
}
