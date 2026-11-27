import { sha256Hex } from './errors';

describe('sha256Hex', () => {
  it('matches the hash the local API computes (node:crypto sha256 of the UTF-8 bytes)', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(await sha256Hex('çalışma ağacı\n')).toBe('84dd7fd6ae7ce97e9ffdd1f261e1f751d0f28554863facb489e1415b432821b2');
  });
});
