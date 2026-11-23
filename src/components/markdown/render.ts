// Markdown → safe HTML for the preview.
//
// markdown-it runs with `html: false` (raw HTML is shown as text) and its link validation (no `javascript:`,
// `vbscript:`, `file:`, most `data:`). The output then goes through DOMPurify, whose hook opens links to other
// sites in a new tab, keeps `#…` links (in-app routes) in place, strips the `href` of links that point into the
// app's own origin (relative paths, `/…`, this host), and keeps images limited to `https:` URLs or files inside
// the content folder.
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import { isExternalUrl } from './paths';

/** Attribute that carries a relative image path; the preview loads the file and sets `src` itself. */
export const LOCAL_SRC_ATTR = 'data-hq-src';

const md = new MarkdownIt({ html: false, linkify: true, typographer: false });
md.use(taskLists, { enabled: true });

const renderImage = md.renderer.rules.image!;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = String(token.attrGet('src') ?? '');
  if (!/^https:/i.test(src)) {
    token.attrs = (token.attrs ?? []).filter(([name]) => name !== 'src');
    if (src && !isExternalUrl(src)) token.attrSet(LOCAL_SRC_ATTR, src);
  }
  token.attrSet('loading', 'lazy');
  return renderImage(tokens, idx, options, env, self);
};

let purifier: ReturnType<typeof DOMPurify> | null = null;

const isLoopback = (host: string) => /^(localhost|.+\.localhost|127(\.\d{1,3}){3}|\[::1\])$/i.test(host);

/**
 * What a link in rendered Markdown may do: `hash` = an in-app route or anchor (`#…`, or this page's own URL with
 * a hash), `external` = another site (opened in a new tab), `blocked` = a document on the app's own origin
 * (relative paths, `/…`, this host — also under another loopback name on the same port, and `blob:` URLs).
 */
export function linkTarget(href: string, base: { href: string; origin: string } = window.location): 'hash' | 'external' | 'blocked' {
  if (href.startsWith('#')) return 'hash';
  let url: URL;
  let page: URL;
  try {
    url = new URL(href, base.href);
    page = new URL(base.href);
  } catch {
    return 'blocked';
  }
  const sameServer =
    url.origin === base.origin ||
    (url.protocol === page.protocol && url.port === page.port && isLoopback(url.hostname) && isLoopback(page.hostname));
  if (!sameServer) return url.protocol === 'blob:' ? 'blocked' : 'external';
  const samePage = url.origin === base.origin && url.pathname === page.pathname && url.search === page.search;
  return samePage && url.hash.length > 1 && href.includes('#') ? 'hash' : 'blocked';
}

/** A private DOMPurify instance, so our hook does not affect anyone else's sanitising. */
function getPurifier() {
  if (purifier) return purifier;
  purifier = DOMPurify(window);
  purifier.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href');
      const target = href === null ? 'none' : linkTarget(href);
      if (target === 'hash') {
        node.setAttribute('href', href!.slice(href!.indexOf('#')));
        node.removeAttribute('target');
      } else if (target === 'external') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      } else {
        // Same-origin documents (relative paths, `/…`, this host) are never navigable: a file from the content
        // repo opened as a page would run as the app. The link text stays, as plain text.
        node.removeAttribute('href');
        node.removeAttribute('target');
        node.removeAttribute('rel');
      }
    } else if (node.tagName === 'IMG') {
      const src = node.getAttribute('src');
      if (src !== null && !/^https:/i.test(src)) node.removeAttribute('src');
    } else if (node.tagName === 'INPUT' && node.getAttribute('type') !== 'checkbox') {
      node.remove();
    }
  });
  return purifier;
}

/** Makes an HTML string safe to put into the page: no scripts, event handlers, styles, SVG/MathML or forms. */
export function sanitizeHtml(html: string): string {
  return getPurifier().sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style'],
  });
}

export interface Rendered {
  html: string;
  /** Source line (0-based) of each task list item, in document order — the n-th checkbox is `taskLines[n]`. */
  taskLines: number[];
}

/** Renders markdown to sanitised HTML. */
export function renderMarkdown(source: string): Rendered {
  const tokens = md.parse(source, {});
  return { html: sanitizeHtml(md.renderer.render(tokens, md.options, {})), taskLines: taskLinesOf(tokens) };
}

/** Source lines of the task list items, numbered the same way as the preview's checkboxes. */
export function findTaskLines(source: string): number[] {
  return taskLinesOf(md.parse(source, {}));
}

function taskLinesOf(tokens: ReturnType<typeof md.parse>): number[] {
  const lines: number[] = [];
  for (const token of tokens) {
    if (token.type === 'list_item_open' && token.map && String(token.attrGet('class') ?? '').includes('task-list-item')) {
      lines.push(token.map[0]);
    }
  }
  return lines;
}
