# KALK. — kişisel hareket molası hatırlatıcısı

Expo SDK 58 ile hazırlanmış, **30 dakika odak + 5 dakika hareket** döngüsünü hatırlatan bir iOS/Android uygulaması. Kullanıcının verdiği görsel kişisel kullanım için ikon ve maskot olarak yer alır.

## Özellikler

- Telefon kilitliyken veya uygulama kapalıyken *önceden planlanan yerel bildirimler* (internet/sunucu gerektirmez)
- Varsayılan gece sessiz modu **22:00–09:00**; ayarlardan aç/kapat ve saatlerini değiştir
- Bildirimleri tümden aç/kapat; devre dışı bırakınca cihazdaki planlı bildirimler iptal edilir
- 30/45/60 dakika çalışma ve 5/10 dakika mola
- Bildirimde **Molayı başlat** ve **5 dk ertele** eylemleri (uygulamayı açar)
- Molayı manuel bitirme, günlük tamamlanan ve ertelenen sayaçları
- Test bildirimi (8 saniye)
- Hesap, sunucu, reklam ve web bağlantısı gerekmez

## Çalıştırma

Ön koşul: Node.js **22.13+**. iPhone üzerinde Expo SDK 58 için **özel bir iOS derlemesi (development build veya standalone build)** gerekir.

```bash
cd sponge
npm install
npx expo install --fix
npx expo start
```

**Önemli:** iOS App Store’daki Expo Go sürümü SDK 54 ile sınırlıdır; bu SDK 58 projesini iPhone’da Expo Go ile açamazsın. Kilit ekranı ve kapalı uygulama bildirimlerini kendi yüklediğin native build üzerinde test et.

## iPhone'a kişisel kurulum

1. `npm install` ve `npx expo install --fix` çalıştır.
2. Expo hesabınla `npx eas-cli login` yap.
3. `npx eas-cli build:configure` çalıştır; ardından `npx eas-cli build --platform ios --profile preview` ile dahili bir iOS build iste. iOS cihaz kaydı/dağıtımı için Apple imzalama şartları geçerlidir (çoğunlukla Apple Developer hesabı gerekir). Alternatif olarak Mac'te Xcode ile geliştirme derlemesi kurulabilir.
4. Telefonda bildirim izni ver, **Bildirimler** seçeneğini aç.
5. Ayarlardan **Test bildirimi gönder**'e basıp telefonu kilitle. 8 saniye içinde test bildiriminin göründüğünü kontrol et.

Android için `npx eas-cli build --platform android --profile preview` Android APK oluşturur.

## Teknik mantık

Günlük bildirimler cihazın sistemine `DAILY` trigger ile kaydedilir. Gece sessiz modu açıkken **22:00 ile 09:00 arasında hiçbir zaman tetiklenmezler**: uygulamanın arka planda çalışmasına ihtiyaç yoktur.

Örnek: 09:00'da çalışma başlar; 09:30, 10:05, 10:40, ... saatleri planlanır. Bu, her gün **sabit bir çalışma programıdır**. Uygulama gerçek oturma pozisyonunu algılamaz; kullanıcının mola yaptığını kendisi doğrulaması gerekir. Erteleme tek seferlik ayrı bir yerel bildirim oluşturur. Bildirimler cihazın Odak/Rahatsız Etme ayarlarına, izinlerine ve Android pil politikalarına tabidir; saniye/dakika hassasiyetinde kesin teslim garantisi yoktur.

**Sınır:** Bildirim zamanlaması günlük sabit saatlere dayanır. Her mola sonrası o andan itibaren dinamik olarak 30 dakika başlatma, uygulama tamamen kapalıyken işletim sisteminin arka plan sınırlamaları nedeniyle güvenilir biçimde yapılamaz. Bu MVP bu yüzden sabit gün içi program kullanır.

## Komutlar

```bash
npm test               # Zamanlama mantığı birim testleri
npm run start           # Expo geliştirici sunucusu
npm run build:android   # EAS Android APK (eas-cli gerekli)
npm run build:ios       # EAS iOS dahili dağıtım (eas-cli gerekli)
```

## Kaynak ve telif

Maskot/ikon kullanıcı tarafından sağlanan görseldir. Bu GitHub deposu herkese açıksa görsel de herkese açık olur; özel kullanım için de telif durumuna dikkat edilmelidir. Kamuya açık ürün veya ticari dağıtım için gerekli kullanım hakları ayrıca değerlendirilmelidir.

Expo Notifications: https://docs.expo.dev/versions/v58.0.0/sdk/notifications/