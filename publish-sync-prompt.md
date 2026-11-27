Bu repo Project HQ: notları, roadmap'leri ve uygulama bilgilerini proje bazında düz Markdown olarak ayrı bir git content repo'sunda (project-hq-content) tutan bir uygulama. Uygulamada "Yayınla" denince localdeki git ile commit ve push yapılıyor. Aynı Markdown dosyalarını Claude Code gibi dış araçlar da düzenleyebiliyor, içerik başka bir makineden de push'lanmış olabiliyor.

Bu görevi headless (claude -p) olarak, tek seferde ve kimseye soru sormadan tamamlayacaksın. Belirsiz bir noktada en makul kararı ver, devam et ve kararını en sondaki raporda gerekçesiyle yaz.

## Sorun
Şu an "Yayınla" akışı senkronizasyonu hesaba katmıyor. Push'tan önce pull alınmıyor, uygulamanın yazdığı değişikliklerle Claude Code'un ya da remote'un yaptığı değişikliklerin çakışması ele alınmıyor. Bu yüzden push reddedilebiliyor, bir taraf diğerinin üstüne yazabiliyor ve veri kaybı riski var.

## Hedef
"Yayınla" güvenli bir senkronizasyon akışına dönüşsün: önce yerel değişiklikler (uygulamanınkiler ve dış araçlarınkiler) commit'lensin, sonra remote ile rebase üzerinden birleştirilsin, en son push edilsin. Hiçbir durumda kullanıcının yaptığı değişiklik sessizce kaybolmasın.

## 1. Keşif
Kod yazmadan önce şunları bul:
- "Yayınla" butonunun handler'ı ve git komutlarını çalıştıran servis/modül (web ve Electron tarafında aynı kod mu çalışıyor?)
- Uygulamanın Markdown dosyalarını diske nasıl yazdığı ve diskteki değişiklikleri nasıl algıladığı (file watcher var mı?)
- Editörde kaydedilmemiş değişikliklerin nerede tutulduğu
- Mevcut test altyapısı, lint ve build komutları (package.json script'lerine bak)

Mevcut mimariye ve kod stiline uy, gereksiz refactor yapma, yeni bağımlılık eklemekten kaçın. Gerçekten gerekiyorsa ekle ve raporda nedenini yaz.

## 2. Yeni "Yayınla" akışı
Sırayla şu adımları uygula:

1. Ön kontrol: Repo'da yarım kalmış bir rebase/merge varsa ya da branch'in upstream'i yoksa işlemi başlatma, kullanıcıya anlaşılır bir mesaj göster.
2. Editör koruması: Açık bir dosyada kaydedilmemiş değişiklik varsa ve bu dosya yüklendikten sonra diskte değişmişse (hash ya da mtime karşılaştırmasıyla), üstüne yazma. Kullanıcıya "Bu dosya dışarıdan değiştirildi" uyarısı göster ve seçim sun (benimkini kullan / diskteki sürümü yükle / iptal).
3. Yerel commit: Bekleyen yazmaları diske flush et, ardından `git add -A` ve commit (değişiklik yoksa bu adımı atla). Commit mesajında değişen dosyalar kısaca listelensin. Bu sayede Claude Code'un yaptığı değişiklikler de aynı commit'e girer.
4. Remote ile birleştir: `git fetch`, ardından geride kalınmışsa `git pull --rebase` (ya da `git rebase origin/<branch>`).
5. Çakışma durumu: Rebase çakışırsa `git rebase --abort` ile repo'yu işlem öncesi durumuna geri döndür, çakışan dosyaları listele ve kullanıcıya göster. Her dosya için basit bir çözüm sun: "Benimkini tut", "Remote'takini tut" ya da "Kendim düzenleyeceğim" (bu seçenek dosyayı conflict marker'larıyla açar, kullanıcı düzenleyip tekrar Yayınla der).
6. Push: Push non-fast-forward sebebiyle reddedilirse (arada başka bir push olmuşsa) fetch + rebase adımını bir kez daha deneyip tekrar push et. İkinci denemede de olmazsa kullanıcıya bildir.
7. Sonrası: Başarılı olursa uygulamanın state'ini diskten yeniden yükle ki remote'tan gelen değişiklikler arayüze yansısın. Başarılı ya da başarısız, sonucu kullanıcıya net bir mesajla göster.

Bonus: Küçük bir iş olacaksa, uygulama açıldığında ya da pencere odaklandığında arka planda `git fetch` yapıp remote'ta yeni commit varsa "Remote'ta yeni değişiklikler var" göstergesi ve yanında "Senkronize et" butonu ekle. Büyük bir iş olacaksa yapma, raporda öner.

## Kesin kurallar
- Uygulama kodunda asla `git push --force`, `git reset --hard`, `git checkout -- .` ya da `git clean` kullanma.
- Commit'lenmemiş hiçbir değişikliği silme ya da üstüne yazma.
- Git komutlarını shell string'i birleştirerek değil, argüman dizisiyle çalıştır (Windows ve macOS'ta path'ler boşluk ya da Türkçe karakter içerebilir).
- Her git çağrısının hatasını yakala ve kullanıcıya anlamlı bir Türkçe mesajla göster. Arayüz Türkçe, yeni metinler de Türkçe olsun.
- Testleri ASLA benim gerçek content repo'mda çalıştırma, test kodu içinde geçici dizinlerde oluşturulan test repo'ları kullan ve test sonunda temizle.
- Bu repo üzerinde (project-hq) sen kendin asla push yapma, branch değiştirme ve mevcut commit geçmişini değiştirme. Şu an üzerinde olduğun branch'te çalış.

## 3. Testler
Geçici bir bare repo + iki clone kurup en az şu senaryoları otomatik testle doğrula:
- Claude Code uygulamada açık olmayan bir dosyayı değiştirmiş, Yayınla ile bu değişiklik de commit'lenip push'lanıyor.
- Remote'ta farklı bir dosyada yeni commit var, rebase sorunsuz geçiyor ve iki değişiklik de korunuyor.
- Remote'ta ve localde aynı dosyanın aynı satırları değişmiş, akış abort ediliyor, hiçbir değişiklik kaybolmuyor ve çakışan dosya listesi dönüyor.
- Push sırasında araya başka bir push girmiş, retry ile başarıyla tamamlanıyor.
- Editörde kaydedilmemiş değişiklik varken dosya diskte değişmiş, üstüne yazılmıyor ve uyarı tetikleniyor.

Repo'da test altyapısı yoksa mevcut stack'e en uygun, en hafif olanı kur. Tüm testler, lint ve build geçene kadar düzeltmeye devam et.

## 4. Bitirirken
- README'ye "Senkronizasyon ve çakışmalar" başlıklı kısa bir bölüm ekle: Yayınla'nın arka planda ne yaptığını ve çakışma olduğunda kullanıcıyı ne beklediğini anlatsın.
- Bütün değişiklikleri mevcut branch'e tek bir anlamlı commit olarak at (push yapma).
- Son çıktın Markdown formatında kısa bir rapor olsun: değişen dosyalar, yeni akışın özeti, eklenen testler ve sonuçları, verdiğin kararlar ve gerekçeleri, bilerek kapsam dışında bıraktıkların ve elle test etmem gereken şeyler.
