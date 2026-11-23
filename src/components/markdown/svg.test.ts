import { imageBlob, sanitizeSvg, sanitizeSvgBytes } from './svg';

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'image/svg+xml');
}

const HOSTILE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="10" height="10" viewBox="0 0 10 10" onload="alert(1)">
  <script>alert(2)</script>
  <defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs>
  <rect id="r" width="10" height="10" fill="url(#g)" onclick="alert(3)" style="fill: url(https://evil.example/x.svg#a)"/>
  <foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(4)"/></div></foreignObject>
  <image href="https://evil.example/track.png" width="5" height="5"/>
  <image xlink:href="https://evil.example/track2.png" width="5" height="5"/>
  <use href="#r"/>
  <use xlink:href="#r" x="1"/>
  <a href="javascript:alert(5)"><circle r="2"/></a>
  <set attributeName="href" to="javascript:alert(6)"/>
  <animate attributeName="href" values="javascript:alert(7)"/>
  <style>@import url(https://evil.example/a.css); rect { fill: blue }</style>
</svg>`;

describe('sanitizeSvg', () => {
  it('removes scripts, handlers, foreignObject, animations and external references', () => {
    const out = sanitizeSvg(HOSTILE);
    expect(out).not.toBeNull();
    const text = out!;
    expect(text).not.toMatch(/<script|onload|onclick|onerror|foreignObject|javascript:|evil\.example|<set|<animate/i);
    const doc = parse(text);
    expect(doc.querySelector('parsererror')).toBeNull();
    const root = doc.documentElement;
    expect(root.localName).toBe('svg');
    expect(root.namespaceURI).toBe('http://www.w3.org/2000/svg');
    // Harmless content survives, including fragment references.
    expect(root.querySelector('rect')?.getAttribute('fill')).toBe('url(#g)');
    expect(root.querySelector('linearGradient')).not.toBeNull();
    const uses = root.querySelectorAll('use');
    expect(uses).toHaveLength(2);
    expect(uses[0].getAttribute('href')).toBe('#r');
    expect(uses[1].getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe('#r');
    for (const img of root.querySelectorAll('image')) {
      expect(img.getAttribute('href')).toBeNull();
      expect(img.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBeNull();
    }
    expect(root.querySelector('circle')).not.toBeNull();
  });

  it('keeps an ordinary SVG upload intact enough to render', () => {
    const out = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><path d="M0 0h4v4z" fill="#123456" style="stroke: red"/></svg>');
    const root = parse(out!).documentElement;
    expect(root.getAttribute('viewBox')).toBe('0 0 4 4');
    expect(root.querySelector('path')?.getAttribute('d')).toBe('M0 0h4v4z');
    expect(root.querySelector('path')?.getAttribute('style')).toContain('stroke');
  });

  it('returns null when there is no SVG left', () => {
    expect(sanitizeSvg('<html><body><script>alert(1)</script></body></html>')).toBeNull();
    expect(sanitizeSvg('')).toBeNull();
    expect(sanitizeSvg('not an image')).toBeNull();
    expect(sanitizeSvg('<script>alert(1)</script>')).toBeNull();
  });

  it('rejects bytes that are not UTF-8 text', () => {
    expect(sanitizeSvgBytes(new Uint8Array([0xff, 0xfe, 0x00, 0x3c]))).toBeNull();
    expect(sanitizeSvgBytes(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toContain('<svg');
  });
});

describe('imageBlob', () => {
  it('passes raster images through and cleans SVGs', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(imageBlob(png, 'image/png')?.size).toBe(4);
    const blob = imageBlob(new TextEncoder().encode(HOSTILE), 'image/svg+xml');
    expect(blob?.type).toBe('image/svg+xml');
    const text = await blob!.text();
    expect(text).toContain('<svg');
    expect(text).not.toMatch(/script|onload|evil\.example/i);
  });

  it('gives null (a broken image) when an SVG cannot be cleaned', () => {
    expect(imageBlob(new TextEncoder().encode('<p>no svg</p>'), 'image/svg+xml')).toBeNull();
  });
});
