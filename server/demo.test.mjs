import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { daysBetween, prepareDemoRoot, shiftDate, shiftPlanFiles } from './demo.mjs';
import { PROJECT_DIR } from './env.mjs';

describe('demo plan shifting', () => {
  it('counts and shifts calendar days', () => {
    expect(daysBetween('2026-11-23', '2026-12-01')).toBe(8);
    expect(daysBetween('2026-11-23', '2026-11-01')).toBe(-22);
    expect(shiftDate('2026-11-28', 8)).toBe('2026-12-06');
    expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('keeps files untouched for a zero offset', () => {
    const files = { '2026-11.md': '# 2026-11\n\n## 2026-11-23\n- [ ] A\n' };
    expect(shiftPlanFiles(files, 0)).toEqual(files);
  });

  it('moves day sections and regroups them by month', () => {
    const files = {
      '2026-11.md': '# 2026-11\n\n## 2026-11-23\n- [ ] A #x\n  detail\n\n## 2026-11-30\n- [x] B\n',
    };
    expect(shiftPlanFiles(files, 3)).toEqual({
      '2026-11.md': '# 2026-11\n\n## 2026-11-26\n- [ ] A #x\n  detail\n',
      '2026-12.md': '# 2026-12\n\n## 2026-12-03\n- [x] B\n',
    });
  });
});

describe('prepareDemoRoot', () => {
  it('copies the bundled demo content and moves the plan to today', () => {
    const root = prepareDemoRoot({ projectDir: PROJECT_DIR, today: new Date(2027, 0, 10) });
    try {
      const projects = fs.readdirSync(path.join(root, 'content', 'projects'));
      expect(projects.length).toBeGreaterThan(0);
      const plan = fs.readdirSync(path.join(root, 'content', 'plan'));
      expect(plan).toContain('2027-01.md');
      expect(fs.readFileSync(path.join(root, 'content', 'plan', '2027-01.md'), 'utf8')).toContain('## 2027-01-10');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
