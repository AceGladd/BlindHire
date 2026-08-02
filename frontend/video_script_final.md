# 🎬 BlindHire — Demo Video Anlatım Metni (Final)

> ⏱️ **Süre Hesabı:**  
> • Düz okuma hızı (1x): **~2 dk 05 sn**  
> • Hızlı/Akıcı sunum (1.25x): **~1 dk 42 sn** *(Kesinlikle 2 dakikayı geçmez, 3 dakikalık video sınırı ile %100 uyumlu)*  
> • **Tüm proje bileşenleri ve ekip üyelerinin modülleri dahil edilmiştir.**

---

## 📍 [Giriş Ekranı — Login]
> ⏱️ Düz: ~8 sn · 1.25x: ~6 sn

Ana giriş ekranımızdayız. JWT ve bcrypt güvenlik katmanıyla admin, firma yöneticisi, İK uzmanı ve aday rol bazlı olarak kendi yetkili panellerine yönlendiriliyor.

---

## 📍 [Admin Paneli]
> ⏱️ Düz: ~8 sn · 1.25x: ~6 sn

Admin panelinde sistemdeki tüm firmalar oluşturuluyor ve yönetiliyor, her firmaya yetkili kullanıcılar atanıyor. Tüm ilanlar, başvurular ve kayıtlı kullanıcılar tek merkezden izlenebiliyor.

---

## 📍 [Firma Yönetim Paneli — NeuraNova AI]
> ⏱️ Düz: ~20 sn · 1.25x: ~16 sn

Firma yöneticisi panelinde ilan ve başvuru istatistikleri görülebiliyor. Ayarlar bölümünde İK kullanıcıları tanımlanıyor ve ilanların doğrudan yayına alınma seçeneği yönetiliyor. En kritik kısım başvuru otomasyonu — burada 4 aşamalı karar barajları ayarlanıyor: Yerel ATS puanı, LLM derin CV analiz puanı, AI mülakat puanı ve genel karar skoru. Her barajın altı otomatik ret, üstü otomatik onay, ortası İK incelemesine düşüyor.

---

## 📍 [İK Paneli — Furkan Atıcı]
> ⏱️ Düz: ~12 sn · 1.25x: ~10 sn

İK panelinde yeni ilanlar oluşturuluyor ve başvurular detaylıca inceleniyor. Aday hunisinde başvurular aşamalarına göre sıralanıyor, İK onayına düşen adaylara müdahale ediliyor. CV görüntüleme, ilan düzenleme ve geçmiş başvuru kayıtları da bu panelden takip ediliyor.

---

## 📍 [Kullanıcı Paneli — Profil & Ayarlar]
> ⏱️ Düz: ~12 sn · 1.25x: ~9 sn

Kullanıcı panelinde aday profil bilgilerini doldurup özgeçmiş PDF dosyasını yüklüyor — bu alanlar başvuru için zorunlu. Ayarlar bölümünde tema renkleri sistem geneline ve Nodemailer SMTP şablonlarına yansıyor; ayrıca renk körü modu seçeneği yer alıyor.

---

## 📍 [Başvuru Süreci — Junior Siber Güvenlik Uzmanı]
> ⏱️ Düz: ~20 sn · 1.25x: ~16 sn

İlana tıklayıp başvuru ekranına geçiyoruz. CV yüklendiğinde ilk olarak **Yerel ATS Motoru** devreye giriyor — 132'den fazla Siber Güvenlik ve Yapay Zeka teknik terim eşleştirmesiyle algoritmik puan hesaplanıyor. Ardından **Groq Cloud üzerinde çalışan Llama 3.3 70B Versatile** modeli, özel prompt ile anlamsal CV-ilan uygunluk analizi yaparak derin analiz puanını veriyor. Aday, firma barajlarına göre otomatik ilerliyor veya İK incelemesine ayrılıyor.

---

## 📍 [İK Paneli — Mülakat Daveti]
> ⏱️ Düz: ~7 sn · 1.25x: ~6 sn

İnceleme aşamasında İK paneline dönüyoruz, adayın ATS ve LLM puanlarını doğrulayıp mülakat davetini gönderiyoruz. Adaya Nodemailer üzerinden tek kullanımlık 6 haneli doğrulama kodu ulaştırılıyor.

---

## 📍 [Mail Kutusu — Giriş Kodu]
> ⏱️ Düz: ~4 sn · 1.25x: ~3 sn

Mail kutusuna gelen doğrulama kodunu alarak mülakat oturumuna giriş yapıyoruz.

---

## 📍 [AI Video Mülakat]
> ⏱️ Düz: ~28 sn · 1.25x: ~22 sn

Mülakat ekranında yapay zeka mülakatçı adayı karşılıyor. Sorular, **FAISS Vektör İndeksi ve Sentence Transformers** RAG mimarisiyle ilana özel seçiliyor. Mülakatçı canlı diyalog motoru olarak **Google Gemini 3.6 Flash Lite** modelini kullanıyor; adayın konuşması **Groq Whisper** ile metne dönüştürülüyor, sesli yanıtlar **Edge-TTS** ile sentezleniyor. Eşzamanlı olarak kamera üzerinden **OpenCV Haar Cascade** algoritmalarıyla yüz tespiti, mimik takibi ve göz kaçırma kontrolü yapılarak nihai mülakat puanı hesaplanıyor ve otomasyon kararına iletiliyor.

---

> [!TIP]
> **Sunum İpucu:** Ekran geçişlerinde 1 saniyelik doğal duraksama verin (duraksamalar yukarıdaki süre hesabına dahildir).

---

## 📊 Ekip & Modül Süre Haritası

| Bölüm / Panel | Sorumlu İşlev | Düz Okuma (1x) | Hızlı Sunum (1.25x) |
|---|---|---|---|
| 📍 Giriş Ekranı — Login | Auth & Güvenlik (JWT, bcrypt) | 8 sn | 6 sn |
| 📍 Admin Paneli | Firma & Kullanıcı Yönetimi | 8 sn | 6 sn |
| 📍 Firma Yönetim Paneli | İK & 4 Aşamalı Otomasyon Barajları | 20 sn | 16 sn |
| 📍 İK Paneli (Furkan Atıcı) | İlan Yönetimi & Aday Hunisi | 12 sn | 10 sn |
| 📍 Kullanıcı Paneli | Profil, CV Yükleme & Erişilebilirlik | 12 sn | 9 sn |
| 📍 Başvuru Süreci | ATS (132+ Terim) + Groq Llama-3.3 70B | 20 sn | 16 sn |
| 📍 İK — Mülakat Daveti | Puan Doğrulama & Otomatik Davet | 7 sn | 6 sn |
| 📍 Mail Kutusu | Nodemailer OTP E-posta Servisi | 4 sn | 3 sn |
| 📍 AI Video Mülakat | **Gemini 3.6 Flash Lite** + Groq Whisper + OpenCV + FAISS | 28 sn | 22 sn |
| *Bölüm Geçiş Duraksamaları* | 8 × 1 saniye mola | 8 sn | 8 sn |
| **TOPLAM SUNUM SÜRESİ** | | **~2 dk 05 sn** | **~1 dk 42 sn** |

---

## 🛠️ Proje Teknolojileri Özeti (Jüri Sunumu İçin)

- **Frontend & UI:** Next.js 14, TypeScript, Tailwind CSS, Framer Motion, Lucide Icons.
- **Backend & Sunucu:** FastAPI (Python), Node.js / Next.js API Routes, WebSocket.
- **Güvenlik & Auth:** JWT Token, bcrypt şifreleme, Rol Tabanlı Erişim (RBAC).
- **Yerel ATS Motoru:** 132+ Alan Bazlı Sözlük (Siber Güvenlik & AI/ML), Algoritmik Gramer & Kelime Uyum Analizi.
- **Derin CV Analiz LLM:** Groq Cloud — `llama-3.3-70b-versatile`.
- **Mülakat Diyalog LLM:** **Google Gemini 3.6 Flash Lite** (`gemini-3.6-flash-lite` / `gemini-2.5-flash`).
- **Ses İşleme (STT & TTS):** Groq Async Whisper (`whisper-large-v3-turbo`) & Edge-TTS.
- **RAG & Vektör Veritabanı:** FAISS Vektör İndeksi & Sentence Transformers (`all-MiniLM-L6-v2`).
- **Görüntü İşleme & Proctoring:** OpenCV Haar Cascade (Gerçek zamanlı yüz algılama, göz kaçırma ve odağı koruma takibi).
- **E-posta & İletişim Servisi:** Nodemailer SMTP (OTP Kod & Mülakat Davetleri).
