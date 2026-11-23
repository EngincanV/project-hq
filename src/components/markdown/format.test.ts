import {
  applyEdit,
  cycleHeading,
  indentList,
  insertHorizontalRule,
  pasteLink,
  toggleCodeBlock,
  toggleHeading,
  toggleInline,
  toggleLink,
  toggleList,
  toggleQuote,
  type Edit,
} from './format';

/**
 * Test notation: `[` and `]` mark the selection, `|` an empty cursor. `run` applies a transform and returns
 * the result in the same notation.
 */
function parse(input: string) {
  const cursor = input.indexOf('|');
  if (cursor >= 0) return { text: input.replace('|', ''), sel: { from: cursor, to: cursor } };
  const from = input.indexOf('[');
  const to = input.indexOf(']') - 1;
  return { text: input.replace('[', '').replace(']', ''), sel: { from, to } };
}

function show(text: string, edit: Edit) {
  const out = applyEdit(text, edit);
  const { from, to } = edit.selection;
  if (from === to) return out.slice(0, from) + '|' + out.slice(from);
  return out.slice(0, from) + '[' + out.slice(from, to) + ']' + out.slice(to);
}

function run(input: string, transform: (text: string, sel: { from: number; to: number }) => Edit | null) {
  const { text, sel } = parse(input);
  const edit = transform(text, sel);
  return edit ? show(text, edit) : null;
}

describe('toggleInline', () => {
  const bold = (t: string, s: { from: number; to: number }) => toggleInline(t, s, '**');
  const italic = (t: string, s: { from: number; to: number }) => toggleInline(t, s, '*');

  it('wraps the selection and keeps it selected', () => {
    expect(run('say [hello] now', bold)).toBe('say **[hello]** now');
  });

  it('keeps surrounding spaces outside the markers', () => {
    expect(run('say[ hello ]now', bold)).toBe('say **[hello]** now');
  });

  it('wraps the word at the cursor', () => {
    expect(run('say hel|lo now', bold)).toBe('say **[hello]** now');
  });

  it('inserts empty markers with the cursor inside', () => {
    expect(run('say | now', bold)).toBe('say **|** now');
  });

  it('un-toggles markers outside the selection', () => {
    expect(run('say **[hello]** now', bold)).toBe('say [hello] now');
  });

  it('un-toggles markers inside the selection', () => {
    expect(run('say [**hello**] now', bold)).toBe('say [hello] now');
  });

  it('un-toggles from a cursor inside the word', () => {
    expect(run('say **hel|lo** now', bold)).toBe('say [hello] now');
  });

  it('tells italic from bold', () => {
    expect(run('a **[b]** c', italic)).toBe('a ***[b]*** c');
    expect(run('a ***[b]*** c', italic)).toBe('a **[b]** c');
    expect(run('a ***[b]*** c', bold)).toBe('a *[b]* c');
    expect(run('a *[b]* c', italic)).toBe('a [b] c');
  });

  it('handles strikethrough and inline code', () => {
    expect(run('[gone]', (t, s) => toggleInline(t, s, '~~'))).toBe('~~[gone]~~');
    expect(run('`[x]`', (t, s) => toggleInline(t, s, '`'))).toBe('[x]');
  });

  it('leaves list, heading and quote markup outside the markers', () => {
    const task = '- [ ] item';
    expect(applyEdit(task, toggleInline(task, { from: 0, to: task.length }, '**'))).toBe('- [ ] **item**');
    expect(run('[> - quoted]', bold)).toBe('> - **[quoted]**');
    expect(run('[## Title]', italic)).toBe('## *[Title]*');
  });

  it('turns multi-line inline code into a code block', () => {
    expect(run('[a\nb]', (t, s) => toggleInline(t, s, '`'))).toBe('```\n[a\nb]\n```');
  });
});

describe('toggleList', () => {
  it('adds and removes bullets on the current line', () => {
    expect(run('hel|lo', (t, s) => toggleList(t, s, 'bullet'))).toBe('- hel|lo');
    expect(run('- hel|lo', (t, s) => toggleList(t, s, 'bullet'))).toBe('hel|lo');
  });

  it('puts the cursor after the marker on an empty line', () => {
    expect(run('a\n|', (t, s) => toggleList(t, s, 'task'))).toBe('a\n- [ ] |');
  });

  it('numbers selected lines and skips blank ones', () => {
    expect(run('[a\n\nb]', (t, s) => toggleList(t, s, 'ordered'))).toBe('1. [a\n\n2. b]');
  });

  it('converts between list kinds, keeping indentation', () => {
    expect(run('  1. it|em', (t, s) => toggleList(t, s, 'bullet'))).toBe('  - it|em');
    expect(run('- it|em', (t, s) => toggleList(t, s, 'task'))).toBe('- [ ] it|em');
    expect(run('- [x] it|em', (t, s) => toggleList(t, s, 'task'))).toBe('it|em');
  });

  it('converts a mixed selection instead of removing', () => {
    expect(run('[- a\nb]', (t, s) => toggleList(t, s, 'bullet'))).toBe('- [a\n- b]');
  });
});

describe('indentList', () => {
  it('nests a list item under the previous one', () => {
    expect(run('- a\n- b|', (t, s) => indentList(t, s, 1))).toBe('- a\n  - b|');
    expect(run('1. a\n1. b|', (t, s) => indentList(t, s, 1))).toBe('1. a\n   1. b|');
  });

  it('outdents to the parent level', () => {
    expect(run('- a\n  - b|', (t, s) => indentList(t, s, -1))).toBe('- a\n- b|');
  });

  it('returns null outside lists so Tab can move focus', () => {
    expect(run('plain|', (t, s) => indentList(t, s, 1))).toBeNull();
    expect(run('- top|', (t, s) => indentList(t, s, -1))).toBeNull();
  });
});

describe('headings and quotes', () => {
  it('cycles H1 → H2 → H3 → paragraph', () => {
    expect(run('Ti|tle', cycleHeading)).toBe('# Ti|tle');
    expect(run('# Ti|tle', cycleHeading)).toBe('## Ti|tle');
    expect(run('### Ti|tle', cycleHeading)).toBe('Ti|tle');
  });

  it('toggles a given heading level', () => {
    expect(run('## Ti|tle', (t, s) => toggleHeading(t, s, 2))).toBe('Ti|tle');
    expect(run('# Ti|tle', (t, s) => toggleHeading(t, s, 2))).toBe('## Ti|tle');
  });

  it('quotes and unquotes lines', () => {
    expect(run('[a\nb]', toggleQuote)).toBe('> [a\n> b]');
    expect(run('[> a\n> b]', toggleQuote)).toBe('[a\nb]');
  });
});

describe('blocks', () => {
  it('wraps lines in a fence and removes it again', () => {
    expect(run('[code]', toggleCodeBlock)).toBe('```\n[code]\n```');
    expect(run('```\n[code]\n```', toggleCodeBlock)).toBe('[code]');
  });

  it('inserts an empty fence on a blank line with blank lines around', () => {
    expect(run('text\n|', toggleCodeBlock)).toBe('text\n\n```\n|\n```\n');
  });

  it('inserts a rule below the current line, separated by blank lines', () => {
    expect(run('ab|c\nxyz', insertHorizontalRule)).toBe('abc\n\n---\n|\nxyz');
    expect(run('abc|', insertHorizontalRule)).toBe('abc\n\n---\n|');
  });
});

describe('links', () => {
  it('links selected text and selects the URL placeholder', () => {
    expect(run('see [docs] now', toggleLink)).toBe('see [docs]([https://]) now');
  });

  it('turns a selected URL into a link with the cursor in the label', () => {
    expect(run('[https://x.dev]', toggleLink)).toBe('[|](https://x.dev)');
  });

  it('unwraps a link around the cursor', () => {
    expect(run('see [do|cs](https://x.dev) now', toggleLink)).toBe('see [docs] now');
  });

  it('makes a link when a URL is pasted over text', () => {
    expect(run('see [docs] now', (t, s) => pasteLink(t, s, 'https://x.dev'))).toBe('see [docs](https://x.dev)| now');
    expect(run('see [docs] now', (t, s) => pasteLink(t, s, 'not a url'))).toBeNull();
    expect(run('see | now', (t, s) => pasteLink(t, s, 'https://x.dev'))).toBeNull();
  });
});
