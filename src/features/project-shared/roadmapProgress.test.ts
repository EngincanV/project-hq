import { countRoadmapTasks, progressPercent } from './roadmapProgress';

describe('countRoadmapTasks', () => {
  it('counts open and done top-level task lines', () => {
    const md = [
      '# Roadmap',
      '',
      '## Now',
      '- [ ] First',
      '  detail line',
      '  - [x] nested checkbox in a detail (ignored)',
      '- [x] Done',
      '- [X] Done too',
      '',
      '## Next',
      '* [ ] Star bullet',
      '- plain bullet',
      '- [ ]',
      '-[ ] missing space',
    ].join('\n');
    expect(countRoadmapTasks(md)).toEqual({ done: 2, total: 4 + 1 });
  });

  it('ignores fenced code and handles CRLF and empty input', () => {
    expect(countRoadmapTasks('```\n- [ ] in code\n```\r\n- [x] real\r\n')).toEqual({ done: 1, total: 1 });
    expect(countRoadmapTasks('')).toEqual({ done: 0, total: 0 });
  });
});

describe('progressPercent', () => {
  it('rounds and handles zero', () => {
    expect(progressPercent({ done: 0, total: 0 })).toBe(0);
    expect(progressPercent({ done: 1, total: 3 })).toBe(33);
    expect(progressPercent({ done: 3, total: 3 })).toBe(100);
  });
});
