import { consoleUrl, isDerivedListingUrl, listingUrl } from './storeUrls';

describe('listingUrl', () => {
  it('prefers the saved listing URL', () => {
    const listing = { enabled: true, appId: 'com.x.app', storeUrl: 'https://example.com/app' };
    expect(listingUrl('android', listing)).toBe('https://example.com/app');
    expect(isDerivedListingUrl('android', listing)).toBe(false);
  });

  it('derives the Play listing from the package name', () => {
    const listing = { enabled: true, appId: ' com.example.game ' };
    expect(listingUrl('android', listing)).toBe('https://play.google.com/store/apps/details?id=com.example.game');
    expect(isDerivedListingUrl('android', listing)).toBe(true);
  });

  it('derives nothing for iOS, invalid package names or unsafe saved URLs', () => {
    expect(listingUrl('ios', { enabled: true, appId: 'com.example.game' })).toBeNull();
    expect(listingUrl('android', { enabled: true, appId: 'not a package' })).toBeNull();
    expect(listingUrl('android', { enabled: true })).toBeNull();
    expect(listingUrl('android', undefined)).toBeNull();
    expect(listingUrl('ios', { enabled: true, storeUrl: 'javascript:alert(1)' })).toBeNull();
    expect(listingUrl('android', { enabled: true, appId: 'a.b', storeUrl: 'javascript:alert(1)' })).toBe(
      'https://play.google.com/store/apps/details?id=a.b',
    );
  });
});

describe('consoleUrl', () => {
  it('uses the saved URL or the console home', () => {
    expect(consoleUrl('android', undefined)).toBe('https://play.google.com/console');
    expect(consoleUrl('ios', { enabled: true })).toBe('https://appstoreconnect.apple.com');
    expect(consoleUrl('ios', { enabled: true, consoleUrl: 'https://appstoreconnect.apple.com/apps/1' })).toBe(
      'https://appstoreconnect.apple.com/apps/1',
    );
    expect(consoleUrl('android', { enabled: true, consoleUrl: 'javascript:x' })).toBe('https://play.google.com/console');
  });
});
