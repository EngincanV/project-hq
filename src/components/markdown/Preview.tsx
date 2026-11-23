// Rendered, sanitised Markdown. Relative images are read from storage and shown through object URLs.
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, type MouseEvent } from 'react';
import { useStorage } from '../../storage';
import { useMessages } from '../../i18n';
import { cx } from '../../ui';
import { imageMimeFor } from './assets';
import { markdownMessages } from './messages';
import { resolveDocPath } from './paths';
import { LOCAL_SRC_ATTR, renderMarkdown } from './render';
import { imageBlob } from './svg';
import styles from './Preview.module.css';

interface PreviewProps {
  source: string;
  /** Path of the document, to resolve relative image paths. */
  docPath: string;
  /** The n-th task checkbox was clicked. */
  onToggleTask: (index: number) => void;
  minHeight: number;
  className?: string;
}

const TASK_SELECTOR = 'input.task-list-item-checkbox';

export function Preview({ source, docPath, onToggleTask, minHeight, className }: PreviewProps) {
  const t = useMessages(markdownMessages);
  const storage = useStorage();
  const deferred = useDeferredValue(source);
  const { html } = useMemo(() => renderMarkdown(deferred), [deferred]);
  const root = useRef<HTMLDivElement>(null);
  // content path → object URL (or the pending load / null when the file is missing)
  const urls = useRef(new Map<string, Promise<string | null>>());

  // Revoke every object URL when the preview goes away.
  useEffect(() => {
    const cache = urls.current;
    return () => {
      for (const url of cache.values()) void url.then((u) => u && URL.revokeObjectURL(u));
      cache.clear();
    };
  }, [storage]);

  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    for (const img of container.querySelectorAll<HTMLImageElement>(`img[${LOCAL_SRC_ATTR}]`)) {
      const path = resolveDocPath(docPath, img.getAttribute(LOCAL_SRC_ATTR) ?? '');
      const mime = path ? imageMimeFor(path) : null;
      if (!path || !mime) continue;
      let url = urls.current.get(path);
      if (!url) {
        url = storage.readBytes(path).then(
          (bytes) => {
            // SVGs are cleaned (svg.ts): a blob: URL has the app's origin when opened in a tab of its own.
            const blob = bytes ? imageBlob(bytes, mime) : null;
            return blob ? URL.createObjectURL(blob) : null;
          },
          () => null,
        );
        urls.current.set(path, url);
      }
      void url.then((u) => {
        if (u) img.src = u;
        else {
          img.classList.add(styles.missing);
          img.title = t.imageMissing(path);
        }
      });
    }
  }, [html, docPath, storage, t]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!(target instanceof HTMLInputElement) || !target.matches(TASK_SELECTOR)) return;
    const boxes = [...(root.current?.querySelectorAll(TASK_SELECTOR) ?? [])];
    onToggleTask(boxes.indexOf(target));
  };

  if (!deferred.trim()) {
    return (
      <div className={cx(styles.preview, styles.empty, className)} style={{ minHeight }} aria-label={t.previewLabel}>
        {t.previewEmpty}
      </div>
    );
  }
  return (
    <div
      ref={root}
      className={cx(styles.preview, className)}
      style={{ minHeight }}
      role="region"
      aria-label={t.previewLabel}
      onClick={onClick}
      // Safe: renderMarkdown escapes raw HTML and runs DOMPurify (see render.ts and its XSS tests).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
