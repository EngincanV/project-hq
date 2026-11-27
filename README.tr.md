# Project HQ

Tüm uygulamalarını tek yerden yönet: notlar, yol haritası, takvim, mağaza ve reklam bilgileri, konsol bağlantıları.
Hepsi kendi git deponda Markdown olarak durur.

[![CI](https://github.com/EngincanV/project-hq/actions/workflows/ci.yml/badge.svg)](https://github.com/EngincanV/project-hq/actions/workflows/ci.yml)
[![Son sürüm](https://img.shields.io/github/v/release/EngincanV/project-hq?sort=semver)](https://github.com/EngincanV/project-hq/releases/latest)
[![Lisans: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) · Ayrıntılı belgeler İngilizcedir ve [docs/](docs/) klasöründedir.

![Üç demo proje ve bugünün planıyla Project HQ paneli](docs/screenshots/dashboard.png)

## Project HQ nedir?

Project HQ, birden fazla uygulama, oyun ya da SaaS ürünü geliştirip yayınlayanlar için küçük, yerel öncelikli bir
çalışma alanıdır. Her projenin yol haritasını, notlarını, mağaza bilgilerini, reklam kimliklerini ve konsol
bağlantılarını tek yerde tutar; beş farklı araç arasında gidip gelmezsin. Yazdığın her şey, sahibi olduğun bir git
deposunda düz Markdown ve JSON olarak durur. **Yayınla** düğmesi düzenlemelerini bir commit'e çevirir. İçerik sadece
dosyalardan oluştuğu için onu herhangi bir editörle ya da Claude Code gibi bir kodlama ajanıyla da düzenleyebilirsin.
Tarayıcıda ya da macOS ve Windows için masaüstü uygulaması olarak çalışır.

- **Projeler:** tüm uygulamaların durumları ve yol haritası ilerlemesiyle tek panoda.
- **Notlar:** bölünmüş önizlemeli, görev listeli ve görsel destekli Markdown editörü.
- **Yol haritası:** her proje için basit bir Markdown listesi olarak saklanan pano.
- **Takvim:** tüm projeler için haftalık ve aylık planlayıcı.
- **Mağazalar ve reklamlar:** Google Play, App Store ve AdMob kimlikleri, durumları ve bağlantıları.
- **Bağlantılar:** her konsol ve panel için hızlı erişim kartları.
- **Yayınla:** değişiklikleri gözden geçir ve kendi git'inle commit'le.
- **Canlı yenileme:** başka araçların yaptığı değişiklikler birkaç saniyede görünür.
- Türkçe ve İngilizce arayüz, açık ve koyu tema, telefonda da çalışır.

## Başlarken

Project HQ'yu iki yolla çalıştırabilirsin. İkisi de aynı uygulamadır ve içeriğini kendi git deponda tutar.

| | Masaüstü uygulaması | Kaynaktan (tarayıcıda) |
| --- | --- | --- |
| Kurulum | [Releases](https://github.com/EngincanV/project-hq/releases) sayfasından indir | `git clone`, `npm install` |
| Gerekenler | git | Node.js, npm ve git |
| Açıldığı yer | kendi penceresi | tarayıcın |
| Güncelleme | yerleşik | `git pull` |

Project HQ erken bir `0.x` sürümüdür; bazı pürüzler olabilir.

### Masaüstü uygulaması

1. Son sürümü [Releases](https://github.com/EngincanV/project-hq/releases) sayfasından indir: macOS için `.dmg`
   (Apple silicon için `arm64`, Intel için `x64`), Windows için `Setup .exe`.
2. Sürümler imzasızdır, bu yüzden ilk açılışta bir adım daha gerekir:
   - **macOS:** Uygulamalar klasöründe Project HQ'ya sağ tıkla ve **Aç**'ı seç. macOS yine reddederse bir kez
     `xattr -cr "/Applications/Project HQ.app"` çalıştır.
   - **Windows:** SmartScreen uyarısında **Ek bilgi**'ye, sonra **Yine de çalıştır**'a tıkla.
3. [git](https://git-scm.com)'in kurulu olduğundan emin ol. Uygulama demo içerikle açılır.
4. **Ayarlar > Yerel depo**'yu aç, **Klasör seç**'e tıkla ve içerik deponu seç (herhangi bir git deposu olabilir;
   Project HQ dosyalarını içindeki `content/` klasöründe tutar).
5. git'i ve klasörü denetlemek için **Bağlantıyı test et**'e, sonra **Kaydet**'e bas.

Güncellemeler, ayarların nerede saklandığı ve uygulamayı kendin derlemek için: [docs/desktop.md](docs/desktop.md).

### Kaynaktan (tarayıcıda)

[Node.js](https://nodejs.org) 22.22+, 24.15+ ya da 26+ (`.nvmrc` 24 der) ve npm, ayrıca `user.name` ile `user.email`
ayarlanmış [git](https://git-scm.com) gerekir.

```sh
git clone https://github.com/EngincanV/project-hq.git
cd project-hq
npm install
npm run setup    # içerik deponu oluşturur ve uygulamayı ona yönlendirir
npm start        # http://127.0.0.1:4173 adresinde açılır
```

Önce demo içerikle göz atmak istersen `npm run setup` adımını atla; demo düzenlemeleri sunucuyu durdurunca silinir.
Kurulum seçenekleri ve ortam değişkenleri: [docs/configuration.md](docs/configuration.md).

## Nasıl çalışır

İçeriğin, bu uygulamanın kodundan ayrı olarak kendi git deponda düz Markdown ve JSON dosyaları olarak durur. Project HQ
bu dosyaları okur ve yazar: kaynaktan ya da masaüstü uygulaması olarak çalıştırdığında `127.0.0.1`'e bağlı küçük bir
yerel sunucu üzerinden, telefonunda web uygulaması olarak kullandığında GitHub API üzerinden. Her düzenleme hemen
kaydedilir; **Yayınla** içerik klasörünü commit'ler ve kendi git kimlik bilgilerinle push eder. Uygulama parolanı ya da
SSH anahtarını hiç görmez. Bkz. [docs/publishing.md](docs/publishing.md) ve [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Kullanım

- **Projeler.** Panodan bir proje oluştur, sonra **Genel bakış**'ta türünü, durumunu, emojisini ve rengini ayarla.
  Gerekince Mağazalar ve Reklamlar sekmelerini de orada aç.
- **Notlar.** Her proje için istediğin kadar Markdown notu yaz. Görselleri yapıştır ya da sürükle; notların yanına
  kaydedilir. Notlar kendiliğinden kaydedilir.
- **Yol haritası.** Sütun ve kart ekle, kartları sütunlar arasında taşı ve tamamlandı olarak işaretle. İstediğin an ham
  Markdown'a geç.
- **Takvim.** Günlerini tüm projeler için planla. Açık yol haritası kartlarını bekleyenler listesinden bir güne sürükle;
  bugünün planı panoda da görünür.
- **Mağazalar ve reklamlar.** Her proje için paket adlarını, bundle id'leri, durumları, sürümleri ve AdMob kimliklerini
  tut. Project HQ mağaza ve konsol bağlantılarını oluşturur; Google ya da Apple API'lerini çağırmaz.
- **Bağlantılar.** Play Console, App Store Connect, Firebase, Stripe ve diğerleri için hızlı erişim kartları ekle.
- **Yayınla.** `Mod+Shift+U` ile yayınlanmamış tüm değişiklikleri gör, istemediklerinden vazgeç ve yayınla.

Ayrıntılı tur: [docs/usage.md](docs/usage.md). Kısayollar: [docs/keyboard-shortcuts.md](docs/keyboard-shortcuts.md).

## Claude Code ile kullanmak

İçeriğin düz dosyalardan oluştuğu için [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) onu doğrudan
güncelleyebilir: bir özelliği bitirince yol haritasındaki kartı işaretler, geri bildirimleri karta çevirir ya da
haftanı planlar. Açık uygulama değişiklikleri birkaç saniyede gösterir; sen de onları Yayınla panelinde gözden
geçirirsin. `npm run setup`, ajanlara dosya biçimlerini öğreten bir `CLAUDE.md` ekler. Tam rehber:
[docs/claude-code.md](docs/claude-code.md).

## Senkronizasyon ve çakışmalar

Yerel modda (kaynaktan ya da masaüstü uygulamasıyla) **Yayınla** arka planda şunları yapar:

1. Yarım kalmış bir git işlemi (rebase, merge) varsa ya da dalın upstream'i ayarlı değilken remote'ta aynı isimde bir
   dal varsa hiç başlamaz ve nedenini söyler.
2. Editörde bekleyen yazmaları diske yazar. Sen yazarken dosya dışarıda (Claude Code, başka bir editör, bir pull)
   değiştiyse üzerine yazmaz: editörde "Bu dosya dışarıdan değiştirildi" uyarısı çıkar ve *Benimkini kullan*,
   *Diskteki sürümü yükle* ya da *İptal* seçersin. Seçim yapılmadan yayınlama durur.
3. İçerik klasöründeki tüm değişiklikleri (uygulamanınkiler ve Claude Code gibi araçlarınkiler) tek commit'te toplar;
   commit gövdesinde değişen dosyalar listelenir.
4. `git fetch` yapar; remote ilerlemişse commit'ini remote'un üstüne rebase eder (merge commit oluşmaz).
5. Push eder. Arada başka bir push olduysa fetch + rebase'i bir kez daha yapıp yeniden dener.
6. Sonra uygulama her şeyi diskten yeniden okur; remote'tan gelen değişiklikler de ekrana yansır.

**Çakışma olursa** (aynı satırlar hem sende hem remote'ta değişmişse) rebase geri alınır: hiçbir şey push edilmez,
hiçbir değişiklik kaybolmaz ve değişikliklerin yayınlanmamış olarak kalır. Yayınla paneli çakışan dosyaları listeler;
her biri için *Benimkini tut*, *Remote'takini tut* ya da *Kendim düzenleyeceğim* seçersin. Sonuncusu dosyayı iki
sürümü de içeren çakışma işaretleriyle (`<<<<<<< mine` … `>>>>>>> remote`) yazar; düzenleyip işaretleri sildikten sonra
yeniden Yayınla'ya basarsın (işaretler duran bir dosya yayınlanmaz). Uygulama asla force push, `reset --hard` ya da
`git clean` kullanmaz. Uygulama açılınca ve pencere odaklanınca arka planda `git fetch` yapılır; remote'ta yeni commit
varsa üst çubukta "Remote'ta yeni değişiklikler var" ve **Senkronize et** düğmesi görünür. Ayrıntılar:
[docs/publishing.md](docs/publishing.md).

## Belgeler

Belgeler İngilizcedir.

- [Kullanım turu](docs/usage.md)
- [Masaüstü uygulaması](docs/desktop.md)
- [Yapılandırma](docs/configuration.md): kurulum seçenekleri, ortam değişkenleri, uygulama içi ayarlar
- [Yayınlama](docs/publishing.md): commit ve push nasıl çalışır
- [Entegrasyonlar](docs/integrations.md): GitHub, Google Play, App Store, AdMob
- [Telefonda kullanmak (PWA)](docs/pwa.md)
- [Claude Code ile kullanmak](docs/claude-code.md)
- [İçerik biçimi](docs/content-format.md)
- [Klavye kısayolları](docs/keyboard-shortcuts.md)
- [Güvenlik modeli](docs/security.md)
- [Geliştirme](docs/development.md): komutlar, klasör yapısı, bilinen sınırlar
- [Mimari](docs/ARCHITECTURE.md)
- [Sürüm çıkarma](docs/releasing.md) (bakımcılar için)
- [Değişiklik günlüğü](CHANGELOG.md)

## Katkıda bulunmak

Katkılar memnuniyetle karşılanır. Pull request açmadan önce [CONTRIBUTING.md](CONTRIBUTING.md) dosyasını oku; büyük
değişiklikler için önce bir issue aç. Lütfen [Davranış Kuralları](CODE_OF_CONDUCT.md)'na uy.

## Güvenlik

Güvenlik sorunlarını herkese açık issue olarak bildirme. [SECURITY.md](SECURITY.md)'de anlatıldığı gibi özel güvenlik
açığı bildirimini kullan.

## Lisans

[MIT](LICENSE) © Engincan Veske
