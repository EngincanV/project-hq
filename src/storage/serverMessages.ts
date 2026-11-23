// Translations for the stable codes the local API (server/api.mjs, CODES) sends next to its English text.
// Unknown codes, and codes whose text carries details (git output), show the server's text as is.
import { defineMessages, getLang, type Lang } from '../i18n';

export const serverMessages = defineMessages({
  tr: {
    demo: 'Demo içerik: yayınlama kapalı. Kendi içerik klasörünü kullanmak için `npm run setup` çalıştır.',
    not_a_repo: 'İçerik klasörü bir git deposu değil. Klasörde `git init` çalıştır ya da `npm run setup` kullan.',
    no_remote: 'Uzak depo (git remote) yok: yayınlamak yalnızca yerelde commit oluşturur.',
    nothing_to_publish: 'Yayınlanacak bir şey yok: içerik klasöründe değişiklik yok.',
    committed_local: 'Uzak depo tanımlı olmadığı için commit yalnızca yerelde oluşturuldu.',
    pushed_earlier: 'Yeni değişiklik yoktu; daha önceki commit’ler gönderildi.',
    invalid_path: 'Geçersiz dosya yolu.',
    too_large: 'Dosya çok büyük (en fazla 25 MB).',
    invalid_json: 'Sunucu isteği anlayamadı.',
    is_directory: 'Bu bir klasör, dosya değil.',
    not_found: 'Bulunamadı.',
    forbidden: 'Yerel sunucu isteği reddetti.',
    method_not_allowed: 'Bu işlem desteklenmiyor.',
    unknown_route: 'Yerel sunucu bu isteği tanımıyor. Uygulama ve sunucu farklı sürümlerde olabilir.',
    server_error: 'Yerel sunucuda bir hata oluştu; ayrıntılar terminalde.',
  },
  en: {
    demo: 'Demo content: publishing is turned off. Run `npm run setup` to use your own content folder.',
    not_a_repo: 'The content folder is not a git repository. Run `git init` there or use `npm run setup`.',
    no_remote: 'No git remote: publishing only creates a local commit.',
    nothing_to_publish: 'Nothing to publish: no changes in the content folder.',
    committed_local: 'Committed locally because no git remote is configured.',
    pushed_earlier: 'There were no new changes; earlier commits were pushed.',
    invalid_path: 'Invalid file path.',
    too_large: 'The file is too large (25 MB at most).',
    invalid_json: 'The server could not read the request.',
    is_directory: 'This is a folder, not a file.',
    not_found: 'Not found.',
    forbidden: 'The local server refused the request.',
    method_not_allowed: 'This operation is not supported.',
    unknown_route: 'The local server does not know this request. The app and the server may be different versions.',
    server_error: 'Something went wrong in the local server; see the terminal for details.',
  },
});

type Code = keyof (typeof serverMessages)['tr'];

/** The text for a server `code` in `lang`, or `fallback` (the server's own text) for unknown/missing codes. */
export function serverText(code: string | undefined, fallback: string | undefined, lang: Lang = getLang()): string | undefined {
  const dict = serverMessages[lang];
  if (code && Object.prototype.hasOwnProperty.call(dict, code)) return dict[code as Code];
  return fallback;
}
