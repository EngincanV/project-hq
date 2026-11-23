import { LOCAL_SRC_ATTR, linkTarget, renderMarkdown, sanitizeHtml } from './render';

/** Renders and parses the result so tests look at the DOM the preview would get. */
function dom(markdown: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = renderMarkdown(markdown).html;
  return div;
}

/** Nothing in the tree can run code: no script-ish elements, no on* handlers, no javascript:/data: URLs. */
function expectInert(root: HTMLElement) {
  expect(root.querySelector('script, iframe, object, embed, style, svg, math, form')).toBeNull();
  for (const el of root.querySelectorAll('*')) {
    for (const attr of el.attributes) {
      expect(attr.name.startsWith('on')).toBe(false);
      expect(attr.value).not.toMatch(/^\s*(javascript|vbscript|data):/i);
    }
  }
}

describe('renderMarkdown', () => {
  it('renders GitHub-flavoured basics', () => {
    const root = dom('# Title\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n> quote\n\n```\ncode\n```\n\n~~old~~');
    expect(root.querySelector('h1')?.textContent).toBe('Title');
    expect(root.querySelector('table td')?.textContent).toBe('1');
    expect(root.querySelector('blockquote')).not.toBeNull();
    expect(root.querySelector('pre code')?.textContent).toBe('code\n');
    expect(root.querySelector('s')?.textContent).toBe('old');
  });

  it('opens links in a new tab safely, including linkified URLs', () => {
    const root = dom('[site](https://x.dev) and https://y.dev');
    const links = root.querySelectorAll('a');
    expect(links).toHaveLength(2);
    for (const a of links) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('never makes same-origin documents navigable (relative paths, /…, this host)', () => {
    const here = window.location;
    const root = dom(
      [
        '[rel](other-note.md)',
        '[up](../assets/logo.svg)',
        '[abs](/content/projects/a/assets/x.svg)',
        '[dot](./x.html)',
        `[self](${here.origin}/content/x.svg)`,
        `[proto](//${here.host}/content/x.svg)`,
        `[query](?raw)`,
        `[loop](${here.protocol}//127.0.0.1:${here.port}/content/x.svg)`,
        `[blob](blob:${here.origin}/1234)`,
      ].join(' '),
    );
    const links = root.querySelectorAll('a');
    expect(links).toHaveLength(9);
    for (const a of links) {
      expect(a.hasAttribute('href'), a.textContent ?? '').toBe(false);
      expect(a.hasAttribute('target')).toBe(false);
    }
    expect(root.textContent).toContain('rel');
  });

  it('keeps in-app hash routes and external links working', () => {
    const root = dom(
      `[route](#/p/demo/notes) [anchor](#top) [full](${window.location.origin}${window.location.pathname}#/plan) [ext](https://x.dev/a) [plain](http://x.dev) [mail](mailto:a@x.dev)`,
    );
    const [route, anchor, full, ext, plain, mail] = root.querySelectorAll('a');
    expect(route.getAttribute('href')).toBe('#/p/demo/notes');
    expect(route.hasAttribute('target')).toBe(false);
    expect(anchor.getAttribute('href')).toBe('#top');
    expect(full.getAttribute('href')).toBe('#/plan');
    expect(full.hasAttribute('target')).toBe(false);
    for (const a of [ext, plain, mail]) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    }
    expect(ext.getAttribute('href')).toBe('https://x.dev/a');
  });

  it('classifies links against the page URL', () => {
    const page = { href: 'https://me.github.io/project-hq/index.html', origin: 'https://me.github.io' };
    expect(linkTarget('notes/a.md', page)).toBe('blocked');
    expect(linkTarget('/other-repo/', page)).toBe('blocked');
    expect(linkTarget('https://me.github.io/other/x.svg', page)).toBe('blocked');
    expect(linkTarget('https://me.github.io/project-hq/index.html#/plan', page)).toBe('hash');
    expect(linkTarget('https://github.com/me/repo', page)).toBe('external');
    const local = { href: 'http://localhost:5173/', origin: 'http://localhost:5173' };
    expect(linkTarget('http://127.0.0.1:5173/content/x.svg', local)).toBe('blocked');
    expect(linkTarget('http://[::1]:5173/x', local)).toBe('blocked');
    expect(linkTarget('http://localhost:3000/', local)).toBe('external');
  });

  it('renders task checkboxes and reports their source lines', () => {
    const { html, taskLines } = renderMarkdown('intro\n\n- [ ] a\n- [x] b\n- c');
    const div = document.createElement('div');
    div.innerHTML = html;
    const boxes = div.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(boxes).toHaveLength(2);
    expect(boxes[0].checked).toBe(false);
    expect(boxes[1].checked).toBe(true);
    expect(taskLines).toEqual([2, 3]);
  });

  it('keeps https images and moves relative ones to a data attribute', () => {
    const root = dom('![a](https://x.dev/a.png) ![b](../assets/b.png) ![c](http://x.dev/c.png)');
    const [a, b, c] = root.querySelectorAll('img');
    expect(a.getAttribute('src')).toBe('https://x.dev/a.png');
    expect(b.hasAttribute('src')).toBe(false);
    expect(b.getAttribute(LOCAL_SRC_ATTR)).toBe('../assets/b.png');
    expect(c.hasAttribute('src')).toBe(false);
    expect(c.hasAttribute(LOCAL_SRC_ATTR)).toBe(false);
  });
});

describe('XSS', () => {
  it('shows raw HTML as text', () => {
    const root = dom('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n<b>bold</b>');
    expectInert(root);
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('b')).toBeNull();
    expect(root.textContent).toContain('<script>alert(1)</script>');
  });

  it('drops javascript:, vbscript: and data: links', () => {
    const root = dom(
      '[a](javascript:alert(1)) [b](JaVaScRiPt:alert(1)) [c](vbscript:x) [d](data:text/html;base64,PHNjcmlwdD4=) [e](  javascript:alert(1))',
    );
    expectInert(root);
    for (const a of root.querySelectorAll('a')) expect(a.getAttribute('href') ?? '').not.toMatch(/script|data:/i);
  });

  it('drops javascript: and data: images', () => {
    const root = dom('![x](javascript:alert(1)) ![y](data:image/svg+xml;base64,PHN2Zz4=) ![z](data:image/png;base64,AAAA)');
    expectInert(root);
    for (const img of root.querySelectorAll('img')) expect(img.hasAttribute('src')).toBe(false);
  });

  it('cannot smuggle attributes through link titles or image alt text', () => {
    const root = dom('[a](https://x.dev "x\\" onmouseover=\\"alert(1)") ![" onerror="alert(1)](https://x.dev/a.png)');
    expectInert(root);
  });

  it('sanitises hostile HTML handed to it directly', () => {
    const div = document.createElement('div');
    div.innerHTML = sanitizeHtml(
      '<img src="x" onerror="alert(1)"><a href="javascript:alert(1)">x</a><svg><script>alert(1)</script></svg>' +
        '<iframe src="https://x.dev"></iframe><style>*{}</style><p style="color:red" onclick="x()">p</p>' +
        '<input type="text" value="phish"><form action="https://x.dev"><button>go</button></form>',
    );
    expectInert(div);
    expect(div.querySelector('input')).toBeNull();
    expect(div.querySelector('img')?.hasAttribute('src')).toBe(false);
    expect(div.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(div.querySelector('p')?.hasAttribute('style')).toBe(false);
  });
});
