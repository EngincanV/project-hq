import { defineMessages } from '../../i18n';

export const adsMessages = defineMessages({
  tr: {
    admob: 'AdMob',
    intro: 'Google AdMob kimlikleri ve panel bağlantısı. Reklam birimi kimliklerini ve deneyleri aşağıdaki notlarda tut.',
    openAdmob: 'AdMob’u aç',
    publisherId: 'Yayıncı kimliği',
    publisherHint: 'Biçim: pub-1234567890123456',
    androidAppId: 'Android uygulama kimliği',
    iosAppId: 'iOS uygulama kimliği',
    appIdHint: 'Biçim: ca-app-pub-1234567890123456~1234567890',
    formatWarning: (hint: string) => `Beklenen biçime uymuyor. ${hint}`,
    dashboardUrl: 'Panel adresi',
    dashboardHint: (url: string) => `Boş bırakılırsa: ${url}`,
    notes: 'AdMob notları',
    placeholder: 'Reklam birimleri, deneyler, notlar…',
  },
  en: {
    admob: 'AdMob',
    intro: 'Google AdMob ids and the dashboard link. Keep ad unit ids and experiments in the notes below.',
    openAdmob: 'Open AdMob',
    publisherId: 'Publisher ID',
    publisherHint: 'Format: pub-1234567890123456',
    androidAppId: 'Android app ID',
    iosAppId: 'iOS app ID',
    appIdHint: 'Format: ca-app-pub-1234567890123456~1234567890',
    formatWarning: (hint: string) => `Does not match the expected format. ${hint}`,
    dashboardUrl: 'Dashboard URL',
    dashboardHint: (url: string) => `When empty: ${url}`,
    notes: 'AdMob notes',
    placeholder: 'Ad units, experiments, notes…',
  },
});
