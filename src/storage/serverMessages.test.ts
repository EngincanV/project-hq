import { serverText } from './serverMessages';

describe('serverText', () => {
  it('translates known codes', () => {
    expect(serverText('committed_local', 'Committed locally (no git remote configured)', 'tr')).toMatch(/yerelde/);
    expect(serverText('demo', 'x', 'en')).toMatch(/npm run setup/);
  });

  it('falls back to the server text for unknown or missing codes', () => {
    expect(serverText('push_failed', 'remote: denied', 'tr')).toBe('remote: denied');
    expect(serverText(undefined, 'plain', 'en')).toBe('plain');
    expect(serverText('toString', 'safe', 'en')).toBe('safe');
    expect(serverText(undefined, undefined, 'en')).toBeUndefined();
  });
});
