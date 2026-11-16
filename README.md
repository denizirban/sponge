# Sponge — kişisel hareket molası hatırlatıcısı

Expo SDK 58 ile geliştirilmiş iPhone / Android hareket molası uygulaması. İkon ve maskot olarak kullanıcının sağladığı görsel kullanılıyor.

## Özellikler

- **30 dakika çalışma + 5 dakika hareket molası** (30/45/60 dk çalışma ve 5/10 dk mola seçenekleri)
- Telefon kilitliyken veya uygulama kapalıyken cihazda önceden planlanan yerel bildirimler
- **Gece sessiz modu** (varsayılan **22:00–09:00**, isteğe göre değiştirilebilir veya kapatılabilir)
- Bildirimleri tamamen açma/kapatma, **5 dk erteleme**, bildirime dokunup mola başlatma
- **Mola bitiş bildirimi**: Molayı başlatınca 5/10 dakika sonrasına tek seferlik bildirim planlanır; erken bitirince iptal edilir; gece sessiz saatlerine denk gelirse gönderilmez
- **Mola ekranı**: saniye saniye geri sayım, kaç dakika kaldığı ve tahmini bitiş saati
- Gri-beyaz arayüz, siyah tipografi; yalnızca maskot renkli
- Özel, orijinal kısa kalkma bildirimi melodisi (`assets/sounds/sponge-chime.wav`); bu ses için yeni iOS/Android build gerekir, Expo Go'da ses davranışı farklı olabilir
- Günlük mola ve erteleme sayacı; 8 saniyelik test bildirimi
- Hesap, reklam, internet bağlantısı veya sunucu gerektirmez

## Mac ve iPhone'da hızlı test (Expo Go)

Ön koşul: **Node.js 22.13+** ve iPhone'da **Expo Go (SDK 58)**. İlk test için Apple Developer hesabı veya EAS Build gerekmiyor.

```bash
git clone https://github.com/denizirban/sponge.git
cd sponge
npm install
npx expo install --fix
npx expo start
```

Mac ve telefonun aynı Wi-Fi ağında olsun. Terminalde çıkan QR kodunu iPhone kamerası veya Expo Go ile aç. İlk ekranda **Bildirimler** seçeneğini etkinleştirip izin ver. **Ayarlar → Test bildirimi gönder** ile telefon kilitliyken 8 saniyelik hatırlatmayı dene.

Zaten projeyi klonladıysan:

```bash
cd sponge
git pull
npm install
npx expo install --fix
npx expo start
```

Bağlantı sorunu varsa Expo sunucusunu `npx expo start --tunnel` ile başlatmayı dene.

**Not:** Expo Go, uygulamayı geliştirirken test etmek için uygundur. Sponge'un iPhone ana ekranında bağımsız bir uygulama olarak kalması ve uygulamanın **tamamen kapalı** durumdaki bildirimlerinin nihai doğrulaması için Apple tarafından imzalanmış iOS build gerekir.

## Kişisel iPhone uygulaması oluşturma (EAS)

```bash
npx eas-cli login
npx eas-cli build:configure
npx eas-cli device:create
npx eas-cli build --platform ios --profile preview
```

iOS dahili dağıtım için Apple Developer Program üyeliği ve kayıtlı cihaz gerekir. Alternatif olarak Xcode ile geliştirici cihazına yerel derleme yapılabilir; imzalama koşulları farklıdır.

## Teknik notlar

Bildirimler, cihaz sisteminde **günlük sabit saatlere** planlanır. Varsayılan ayarlarda ilk uyarı 09:30, sonrakiler 10:05, 10:40 ... biçimindedir; gece saatlerine kayıt yapılmaz. Bu, her mola bittikten sonra *dinamik* 30 dakika saymaktan farklıdır. Telefonda gerçek oturma durumu algılanmaz.

Telefonun bildirim izni, Sessiz / Odak modu ve pil/OS kısıtlamaları bildirimin ne zaman gösterileceğini etkileyebilir.

## Komutlar

```bash
npm test
npx expo-doctor@latest
npx expo start
```

Telifli görsel kamuya açık depoda bulunduğunda herkes tarafından görülebilir. Kişisel kullanım için bile gerekli kullanım haklarına dikkat edilmeli.

[Expo Notifications SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/)

## Son değişiklikleri iPhone'da görme

```bash
cd ~/sponge
git pull
npx expo start -c
```

**Expo Go** ile arayüzü ve geri sayımı test edebilirsin. Özel sesin ve tamamen kapalı durumda mola bitiş uyarısının nihai testini ayrı, imzalı iOS build'de yap. Yeni ses bir config plugin ile uygulama paketine eklenir; yalnızca JavaScript güncellemesiyle Expo Go'ya yüklenmez. Bildirimler iOS Sessiz / Odak moduna tabidir. Statü otomatik tamamlandı sayılmaz, kullanıcı doğrular. Mevcut sabit çalışma hatırlatmaları, elle başlatılan molalarla bazen çakışabilir.
