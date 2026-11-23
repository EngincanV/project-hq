// Human-readable errors the GitHub adapter hands to the UI (in the active language).
import { defineMessages, getLang } from '../../i18n';

export const githubMessages = defineMessages({
  tr: {
    offline: 'GitHub’a ulaşılamıyor. İnternet bağlantını kontrol et.',
    unauthorized: 'GitHub token’ı kabul etmedi (401). Token’ın doğru olduğundan ve süresinin dolmadığından emin ol.',
    forbidden:
      'GitHub bu işleme izin vermedi (403). Token’ın bu depoda “Contents: Read and write” iznine sahip olduğundan emin ol.',
    rateLimited: (reset: string) => `GitHub istek sınırına ulaşıldı. ${reset} sonra tekrar dene.`,
    notFound: (repo: string) => `${repo} bulunamadı ya da token bu depoya erişemiyor (404).`,
    branchNotFound: (branch: string) => `“${branch}” dalı bu depoda yok.`,
    conflict: 'GitHub isteği reddetti (409). Depo boş ya da değişmiş olabilir.',
    invalid: (detail: string) => `GitHub isteği reddetti (422): ${detail}`,
    server: (status: number) => `GitHub şu anda yanıt vermiyor (${status}). Biraz sonra tekrar dene.`,
    unexpected: (status: number, detail: string) => `GitHub hatası (${status}): ${detail}`,
    noToken: 'GitHub token’ı girilmedi; yayınlamak için Ayarlar’dan bağlan.',
    noSettings: 'GitHub deposu ayarlanmadı.',
    nothingToPublish: 'Yayınlanacak değişiklik yok.',
    nothingChanged: 'Değişikliklerin depodakiyle aynı; commit gerekmedi.',
    notCached: 'Bu dosya çevrimdışı kullanılabilir değil.',
    bootstrapMessage: 'Project HQ içerik klasörünü oluştur',
    readmeText: (dir: string) =>
      `# İçerik\n\nBu klasör Project HQ tarafından yönetilir. Projeler \`${dir}/projects/<slug>/\` altında durur.\n`,
  },
  en: {
    offline: 'Cannot reach GitHub. Check your internet connection.',
    unauthorized: 'GitHub rejected the token (401). Check that it is correct and has not expired.',
    forbidden:
      'GitHub refused this request (403). Make sure the token has “Contents: Read and write” on this repository.',
    rateLimited: (reset: string) => `GitHub rate limit reached. Try again after ${reset}.`,
    notFound: (repo: string) => `${repo} was not found or the token cannot access it (404).`,
    branchNotFound: (branch: string) => `The branch “${branch}” does not exist in this repository.`,
    conflict: 'GitHub rejected the request (409). The repository may be empty or has changed.',
    invalid: (detail: string) => `GitHub rejected the request (422): ${detail}`,
    server: (status: number) => `GitHub is not responding right now (${status}). Try again in a moment.`,
    unexpected: (status: number, detail: string) => `GitHub error (${status}): ${detail}`,
    noToken: 'No GitHub token; connect in Settings to publish.',
    noSettings: 'No GitHub repository is configured.',
    nothingToPublish: 'There are no changes to publish.',
    nothingChanged: 'Your changes match the repository already; no commit was needed.',
    notCached: 'This file is not available offline.',
    bootstrapMessage: 'Create the Project HQ content folder',
    readmeText: (dir: string) =>
      `# Content\n\nThis folder is managed by Project HQ. Projects live under \`${dir}/projects/<slug>/\`.\n`,
  },
});

/** Messages in the current UI language (the adapter runs outside React). */
export function gm() {
  return githubMessages[getLang()];
}
