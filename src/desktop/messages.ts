import { defineMessages } from '../i18n';

export const desktopMessages = defineMessages({
  tr: {
    updateAvailable: (version: string) => `Project HQ ${version} çıktı.`,
    updateReady: (version: string) => `Project HQ ${version} indirildi; yeniden başlatınca kurulur.`,
    download: 'İndir',
    restart: 'Yeniden başlat',
    later: 'Sonra',
    newTab: '(tarayıcıda açılır)',
  },
  en: {
    updateAvailable: (version: string) => `Project HQ ${version} is available.`,
    updateReady: (version: string) => `Project HQ ${version} is downloaded and installs on restart.`,
    download: 'Download',
    restart: 'Restart',
    later: 'Later',
    newTab: '(opens in your browser)',
  },
});
