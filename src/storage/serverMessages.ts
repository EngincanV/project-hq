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
    // Publish = sync with the remote (server/sync.mjs)
    operation_in_progress:
      'İçerik deposunda yarım kalmış bir git işlemi (rebase, merge…) var. Yayınlamadan önce o işlemi tamamla ya da iptal et (ör. `git rebase --abort`).',
    unmerged_files: 'İçerik deposunda çözülmemiş çakışmaları olan dosyalar var. Önce bunları git ile çöz.',
    detached_head: 'İçerik deposu bir dalda değil (detached HEAD). Önce bir dala geç (ör. `git switch main`).',
    no_upstream:
      "Bu dalın upstream'i ayarlanmamış ama remote'ta aynı isimde bir dal var. İçerik deposunda bir kez `git branch --set-upstream-to=origin/<dal>` çalıştır.",
    conflict_markers:
      'Bazı dosyalarda hâlâ çakışma işaretleri (<<<<<<< / >>>>>>>) var. Dosyayı düzenleyip işaretleri sil, sonra tekrar yayınla.',
    outside_changes:
      'İçerik klasörünün dışında commit’lenmemiş değişiklikler var; bunlarla birleştirme yapılamaz. Önce içerik deposunda bunları commit’le ya da geri al.',
    fetch_failed: 'Remote’tan değişiklikler alınamadı (ağ bağlantısını ve git erişim bilgilerini kontrol et). Hiçbir şey kaybolmadı; değişikliklerin hâlâ yayınlanmayı bekliyor.',
    rebase_failed: 'Remote’taki değişikliklerle birleştirme yapılamadı. Hiçbir şey kaybolmadı; değişikliklerin hâlâ yayınlanmayı bekliyor.',
    rebase_conflict: 'Senin değişikliklerinle remote’taki değişiklikler aynı satırlara dokunuyor. Hiçbir şey yayınlanmadı ya da kaybolmadı.',
    push_failed: 'Değişiklikler gönderilemedi (git push başarısız). Hiçbir şey kaybolmadı; değişikliklerin hâlâ yayınlanmayı bekliyor.',
    push_rejected: 'Yayınlarken remote art arda değişti; iki denemede de gönderilemedi. Biraz sonra tekrar dene. Hiçbir şey kaybolmadı.',
    pulled_only: 'Yayınlanacak yeni bir değişiklik yoktu; remote’taki değişiklikler alındı.',
    local_changes:
      'Yayınlanmamış değişikliklerin remote’ta da değişen dosyalara dokunuyor. Önce yayınla; Yayınla iki tarafı birleştirir.',
    merge_unavailable:
      'Bu dosya elle birleştirilemiyor (bir tarafta silinmiş ya da metin dosyası değil). "Benimkini tut" ya da "Remote’takini tut" seç.',
    file_changed: 'Dosya sen yazarken uygulamanın dışında değişti; üzerine yazılmadı.',
    commit_failed: 'Commit oluşturulamadı.',
    diff_failed: 'Değişiklikler okunamadı (git diff başarısız).',
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
    operation_in_progress:
      'A git operation (rebase, merge…) is half-way done in the content repository. Finish or abort it first (e.g. `git rebase --abort`).',
    unmerged_files: 'The content repository has files with unresolved conflicts. Resolve them in git first.',
    detached_head: 'The content repository is not on a branch (detached HEAD). Switch to a branch first (e.g. `git switch main`).',
    no_upstream:
      'This branch has no upstream, but the remote has a branch with the same name. Run `git branch --set-upstream-to=origin/<branch>` once in the content repository.',
    conflict_markers: 'Some files still contain conflict markers (<<<<<<< / >>>>>>>). Edit them, remove the markers, then publish again.',
    outside_changes:
      'There are uncommitted changes outside the content folder, so the merge cannot run. Commit or undo them in the content repository first.',
    fetch_failed: 'Could not get changes from the remote (check the network and your git credentials). Nothing was lost; your changes are still waiting to be published.',
    rebase_failed: 'Could not merge with the changes on the remote. Nothing was lost; your changes are still waiting to be published.',
    rebase_conflict: 'Your changes and the remote changes touch the same lines. Nothing was published or lost.',
    push_failed: 'Could not push (git push failed). Nothing was lost; your changes are still waiting to be published.',
    push_rejected: 'The remote kept changing while publishing; both attempts were rejected. Try again in a moment. Nothing was lost.',
    pulled_only: 'There was nothing new to publish; changes from the remote were brought in.',
    local_changes: 'Your unpublished changes touch files that changed on the remote too. Publish first; publishing merges both.',
    merge_unavailable: 'This file cannot be merged by hand (deleted on one side, or not a text file). Choose "Keep mine" or "Keep the remote one".',
    file_changed: 'The file changed outside the app while you were typing; it was not overwritten.',
    commit_failed: 'Could not create the commit.',
    diff_failed: 'Could not read the changes (git diff failed).',
  },
});

type Code = keyof (typeof serverMessages)['tr'];

/** The text for a server `code` in `lang`, or `fallback` (the server's own text) for unknown/missing codes. */
export function serverText(code: string | undefined, fallback: string | undefined, lang: Lang = getLang()): string | undefined {
  const dict = serverMessages[lang];
  if (code && Object.prototype.hasOwnProperty.call(dict, code)) return dict[code as Code];
  return fallback;
}
