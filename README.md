# **Takım İsmi**

Takım BlindHire

## 🚀 Kurulum ve Çalıştırma (Hızlı Başlangıç)

Projeyi bilgisayarınızda çalıştırmak için aşağıdaki adımları izleyin:

1. **Gereksinimler:** Sistemin çalışması için `.env` dosyasında `GROQ_API_KEY` ve (varsa) veritabanı ayarlarınızın tanımlı olması gerekir. (Örnek `.env.example` dosyasını kullanabilirsiniz).
2. **Backend (Python/FastAPI):**
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn api.main:app --reload --port 8000
   ```
3. **Frontend (Next.js/React):**
   ```bash
   cd frontend
   npm install
   npx prisma db push  # Veritabanı şemasını eşitlemek için
   npm run dev
   ```
Sistem varsayılan olarak `http://localhost:3000` adresinde ayağa kalkacaktır.


# Ürün İle İlgili Bilgiler

## Takım Elemanları

- Şafak Şenel: Product Owner
- Simge Misli: Scrum Master
- Utku Ceylan: Team Member/Developer
- Bedirhan İhtiyar: Team Member/Developer
- Muhammed Melih Çam: Team Member/Developer

## Ürün İsmi

--BlindHire--

## Ürün Açıklaması

- BlindHire, adayın teknik bilgisini sesli mülakat üzerinden anonim olarak ölçen, proaktif bir işe alım mimarıdır. Mevcut Aday Takip Sistemleri (ATS) "kara delik" olarak adlandırılmakta ve yapay zekayı sadece anahtar kelime filtresi olarak kullanmaktadır. BlindHire, "Conversational AI" temeli üzerine kuruludur. Adaylara gönderilen bir link üzerinden, web tabanlı otonom bir sesli ajan adayla gerçek zamanlı bir teknik veya durumsal mülakat gerçekleştirir. Ajan, adayın sözünü kesmesini anlayabilen (interruptible) ve doğal sohbet akışını sürdürebilen gelişmiş bir duplex mimari kullanır. Mülakat bittiğinde, sistem adayın sesini, cinsiyetini, ismini veya etnik kökenini İK departmanına asla iletmez; sadece teknik yeterliliğe, analitik düşünme yeteneğine ve problem çözme yaklaşımına dair objektif bir karne (scorecard) oluşturur.

## Ürün Özellikleri

- Gerçek zamanlı sesli AI mülakat ajanı (Conversational AI)
- Adayın kimlik bilgilerini gizleyen anonim mülakat sistemi
- Yetkinlik bazlı objektif puanlama ve scorecard oluşturma
- İK uzmanları için yönetim paneli (dashboard)
- Mevcut ATS sistemleri ile webhook entegrasyonu (Greenhouse, Workable vb.)
- Netflix'te ve Prime'da bulunurluk benzeri yetkinlik puanları (teknik bilgi, analitik düşünme, problem çözme)

## Hedef Kitle

- İnsan Kaynakları Yöneticileri
- Teknik İşe Alım Uzmanları (Tech Recruiters)
- CTO'lar ve Teknik Liderler
- DEI (Çeşitlilik, Eşitlik, Kapsayıcılık) odaklı şirketler
- Uzaktan yazılımcı işe alan startup ve orta ölçekli şirketler
- Çok uluslu teknoloji ve kurumsal şirketler

## Trello Sprint Board Linki


🔗 ** https://trello.com/invite/b/6a4a360d11b889f0fa073d57/ATTIedbe914938e656d9613d0f8f7e6db0fcD77147FC/yzvb-bootcamp  **

---

## Sprint 1

### Ürün Ekran Görüntüsü

![Ürün Ekran Görüntüsü](WhatsApp%20Image%202026-07-01%20at%2023.06.13.jpeg)<img width="1902" height="777" alt="Ekran görüntüsü 2026-07-01 230127" src="https://github.com/user-attachments/assets/4cb49f10-3564-41ee-9add-57c2d315610d" />


### Sprint Board & Takım Toplantısı

<img width="1916" height="773" alt="Ekran görüntüsü 2026-07-01 225915" src="https://github.com/user-attachments/assets/1f8c288a-131f-465d-b514-8a29c7d791fe" />


## Sprint 1

### 1. Backlog Düzeni ve Story Seçimleri (Sprint Backlog)
Sprint 1 planlama toplantısında, BlindHire'ın MVP (Minimum Uygulanabilir Ürün) aşaması için en kritik iş kalemleri Trello üzerinde önceliklendirilmiş ve tüm mimarinin modern, tip güvenliği yüksek **TypeScript** tabanında yükselmesine karar verilmiştir:
* **Story 1 (Epic: Computer Vision / Görsel Analiz):** Bir yapay zeka geliştiricisi olarak, aday mülakat esnasındayken kamera üzerinden duygu analizi ve göz takibi (eye tracking) metriklerini toplayabilecek bilgisayarlı görü (Computer Vision) modellerini/kütüphanelerini kurmak ve backend altyapısını hazırlamak istiyorum. (Status: Done | Developer: Utku)
* **Story 2 (Epic: Conversational AI / LLM Senaryoları):** Bir yapay zeka geliştiricisi olarak, adayı karşılayan, mülakat akışını ve soru setlerini yöneten mantıksal LLM senaryolarını ve ilk prompt mühendisliği (Prompt Engineering) yapısını Python ve LangChain altyapısı kullanarak izole bir modül halinde hazırlamak istiyorum. (Status: Done | Developer: Melih)
* **Story 3 (Epic: Audio Analytics & Groq LLM Integration / Ses ve Entegrasyon):** Bir sistem mimarı ve entegratör olarak, adayın ses yüksekliğini, konuşma hızını ve duraksamalarını tarayıcıda JavaScript Web Audio API ile ölçen altyapıyı kurmak; **Groq API** üzerinden **Llama 3.3** modelini bağlamak ve Web Speech API ile sesli tepki mekanizmasını entegre etmek istiyorum. (Status: Done | Developer/Product Owner: Şafak)
* **Story 4 (Epic: Web UI / Frontend):** Bir frontend geliştiricisi olarak, adayın mülakata dahil olacağı web arayüzünün ilk komponent mimarisini, kamera/mikrofon erişim izinlerini ve tip tanımlamalarını (TypeScript Layout) ayağa kaldırmak istiyorum. (Status: Done | Developer: Bedirhan)
* **Story 5 (Epic: Agile Süreç Liderliği, Risk Yönetimi & Çapraz Fonksiyonel Koordinasyon):** Bir Scrum Master olarak, ekibin ilk sprintte dağılmasını önlemek adına GitHub organizasyon altyapısını kurgulamak; Trello sprint panosu üzerinden iş paketlerinin (Frontend, Python/LangChain LLM, Computer Vision, Ses Entegrasyonu) önceliklendirilmesini ve bağımlılık haritalarını (dependency mapping) yönetmek; mentor geri bildirimleri doğrultusunda Slack kanallarında asenkron iletişim disiplini oluşturmak ve teknik ekipler arasındaki entegrasyon blokajlarını proaktif olarak çözmek istiyorum. (Status: Done | Scrum Master: Simge)

### 2. Daily Scrum (Günlük Toplantı Özetleri)
Sprint boyunca Slack kanalları, Whatsapp ve anlık online toplantılar üzerinden iletişim sürdürülmüştür. Hafta sonu teslimine yaklaşırken takım içindeki kritik teknik diyaloglar ve durum özetleri şu şekildedir:
* **Bedirhan (Web UI):** Web sayfası demo olarak hazırlandı, genel bileşen dağıtımı yapıldı ve GitHub reposundaki ana yapı kurgulandı. Mikrofona ve kameraya erişim izinleri frontend arayüzüne başarıyla entegre edildi.
* **Utku (Görsel Analiz):** Kamera tabanlı duygu analizi modeli altyapısı TypeScript uyumlu mimaride ayağa kaldırıldı. Sistem kararlılığını artırmak adına göz takibi modülü üzerinde çalışmalar devam ediyor; ilk aşamada sistemin backend odaklı olarak repoya pushlanması kararlaştırıldı.
* **Melih (LLM/AI Senaryoları):** LLM tarafında adayı karşılayan, basit düzeyde giriş diyaloglarını yöneten prompt mimarisi ve aday havuzu senaryoları tamamlandı. Yerel testleri gerçekleştirilerek repoya pushlanmaya hazır hale getirildi. Ayrıca mülakatı mantıksal aşamalara (Karşılama, Teknik, Senaryo, Kapanış) bölen State Machine  mimarisi ve mülakat bitiminde otonom olarak JSON formatında Değerlendirme Skor Kartı üreten sistem Python LangChain ile başarıyla kodlandı. 
* **Şafak (Ses & Entegrasyon):** Geliştirilen bağımsız modüller (Web UI, LLM ve Görsel modüller) Şafak tarafından başarıyla entegre edildi. Üçüncü parti pahalı API'lar yerine JavaScript **Web Audio API** kullanılarak adayın konuşma hızı ve duraksamaları ölçülebilir hale getirildi. Bu verileri metin analizleriyle birleştirmek üzere **Groq altyapısı üzerinden Llama 3.3** entegrasyonu sağlandı ve **Web Speech API** ile uçtan uca konuşabilen ilk canlı demo ayağa kaldırıldı.
* **Simge (Scrum Master):** Mentorun Slack uyarısı sonrasında kriz yönetimi üstlenerek anında takım içi iletişim kanallarını yeniden yapılandırdı ve asenkron Daily Scrum disiplinini Slack'e taşıdı. Melih'in Python/LangChain ile geliştirdiği izole yapay zeka modülü, Utku'nun bilgisayarlı görü (CV) çıktıları ve Bedirhan'ın frontend mimarisi arasındaki çapraz fonksiyonel (cross-functional) bağımlılıkları yönetti. Şafak'ın entegrasyon sürecinde karşılaştığı blokajları çözerek, ekibin kaynaklarını doğru yönlendirdi ve ilk sprint bitmeden uçtan uca çalışan kararlı bir MVP prototipinin (Increment) başarıyla ortaya çıkmasını sağlayan süreç mimarı oldu.

### 3. Sprint Board SS
<img width="1913" height="768" alt="Ekran görüntüsü 2026-07-05 185910" src="https://github.com/user-attachments/assets/3b67356b-4115-4dc2-87a1-184879d81d99" />
<img width="1911" height="870" alt="Ekran görüntüsü 2026-07-05 185926" src="https://github.com/user-attachments/assets/ddf10e3a-d2b5-4169-8975-8558672ed75d" />

### 4. Ürün Durumu SS (Product Increment)

<img width="1902" height="777" alt="Ekran görüntüsü 2026-07-01 230127" src="https://github.com/user-attachments/assets/fe6245e0-dde1-48cc-9ea0-d1077ebf65b6" />
<img width="1912" height="782" alt="Ekran görüntüsü 2026-07-01 230146" src="https://github.com/user-attachments/assets/80ed766b-754f-4025-bb34-548354b17b14" />

<img width="672" height="651" alt="Ekran görüntüsü 2026-07-05 174211" src="https://github.com/user-attachments/assets/a1719903-4f43-4202-8f35-36de400c1e51" />

<img width="1297" height="642" alt="Ekran görüntüsü 2026-07-05 174244" src="https://github.com/user-attachments/assets/a6190e84-70f2-4de8-9d55-04d0d93f1b7a" />
<img width="1287" height="635" alt="Ekran görüntüsü 2026-07-05 174311" src="https://github.com/user-attachments/assets/03b9f622-7388-48a2-850a-151d8bed873d" />
<img width="710" height="637" alt="Ekran görüntüsü 2026-07-05 174334" src="https://github.com/user-attachments/assets/c5b62379-60fd-4282-bdf0-3b3e1df89ce4" />


### 5. Sprint Review (Sprint Değerlendirmesi)
* **Ne Hedeflendi?** İlk sprint için temel hedefimiz; projenin vizyonunu netleştirmek, tamamen TypeScript tabanlı ortak bir kod tabanı oluşturmak ve modüllerin (LLM, Görsel, Ses, Web) bağımsız prototiplerini üretmekti.
* **Ne Elde Edildi?** Hedeflerimizin üzerine çıkıldı! Bağımsız modüller üretilmekle kalınmadı; takım içi güçlü entegrasyon sayesinde **JavaScript Web Audio/Speech API + Groq Llama 3.3** kombinasyonu kullanılarak %100 ücretsiz, sıfır maliyetli ve ultra düşük gecikmeli bir ses/metin analizi altyapısı kuruldu. Frontend ve backend katmanları birleştirilerek **uçtan uca çalışan, sesli tepki verebilen ilk BlindHire MVP demosu** başarıyla ayağa kaldırıldı.

### 6. Sprint Retrospective (Sprint Özeleştirisi)
* **Neleri İyi Yaptık)**
    * Görev dağılımını uzmanlık alanlarımıza göre (Melih-LLM Senaryoları, Şafak-Ses/Entegrasyon, Utku-Görsel, Bedirhan-Web) çok net ayırdık ve herkes kendi modülünü başarıyla ayağa kaldırdı.
    * Harici ses API'lerinin maliyet/zaman bariyerini Web Audio API ve Groq/Llama 3.3 kullanarak çok zekice ve hızlı bir mimariyle aştık.
    * İlk sprint bitmeden uçtan uca konuşabilen, veri analiz edebilen canlı bir demo üretmeyi başardık.
* **Neleri Geliştirmeliyiz? **
    * Takım üyelerinin yerelde tamamladığı kod bloklarını ana repoya pushlama ve birleştirme (merge) zamanlamalarını biraz daha erkene çekmeliyiz.
    * Bootcamp mentorlarımızın geri bildirimlerini dikkate alarak, sonraki sprintte Slack kanallarındaki anlık durum güncellemelerini ve asenkron Daily paylaşımlarını daha sıkı bir disipline oturtmalıyız.
 
## Sprint 2

### 1. Backlog Düzeni ve Story Seçimleri (Sprint Backlog)

Sprint 2 planlama toplantısında, BlindHire platformunun prototip aşamasından çıkıp endüstriyel standartlarda bir yapay zeka ürününe evrilmesi hedeflenmiştir. Takım, otonom karar mekanizmaları, gelişmiş bilgisayarlı görü algoritmaları ve gerçek zamanlı senkronizasyon yetenekleri üzerinde yoğunlaşarak Trello üzerinde şu iş kalemlerini önceliklendirmiştir:

* **Story 1 (Epic: Computer Vision / Gelişmiş Görsel Analiz & Backend Entegrasyonu):** Bir yapay zeka geliştiricisi olarak, kamera tabanlı odak analizi modelinin doğruluğunu artırmak, adayın ekrana bakıp bakmadığını ve anlık göz hareketlerini (eye-tracking navigation) daha hassas algılayacak algoritmaları optimize etmek ve bu analiz çıktılarını backend katmanına yapılandırılmış veri (Structured JSON Logs) olarak aktarmak istiyorum. (Status: Done | Developer: Utku)
* **Story 2 (Epic: Conversational AI / Bilgi Tabanlı RAG & Söz Kesme Mimarisi):** Bir yapay zeka geliştiricisi olarak, LLM motorunun otonom karar verme ve objektif puanlama yeteneklerini artırmak için RAG (Retrieval-Augmented Generation) mimarisine geçiş yapmak, ajanın halüsinasyon (uydurma soru/cevap) üretmesini engellemek ve adayın konuşmayı kesmesi (interrupt) durumunda ajanın doğal, akıcı tepkiler verebileceği ses uyumlu altyapıyı Python/LangChain ile kurmak istiyorum. (Status: Done | Developer: Melih)
* **Story 3 (Epic: Ses ve Görü Senkronizasyonu & Lip-Sync Optimizasyonu):** Bir sistem mimarı ve entegratör olarak, adayın konuşma akışı ile yapay zeka ajanının sesli yanıtları arasındaki ağ gecikmelerini (latency) minimize edecek senkronizasyon düzenlemelerini yapmak ve ajan yanıt verirken yapay zekanın görsel bileşenleri ile ses çıktısını eş zamanlı yürüten dudak senkronizasyonu (Lip-sync) matematiksel motorunu entegre etmek istiyorum. (Status: Done | Developer/Product Owner: Şafak)
* **Story 4 (Epic: Web UI / Gelişmiş İK ve Aday Panelleri & Entegrasyon):** Bir frontend geliştiricisi olarak, mülakat bitiminde üretilen otonom Değerlendirme Skor Kartı (CV Scoring) ekranını zengin görsel bileşenlerle frontend arayüzüne taşımak, adaylara otomatik mülakat davetiyesi ve İK ekiplerine sonuç bildirim raporları ileten e-posta entegrasyonu (Mail Integration) altyapısını kurmak birtakım kullanıcı deneyimi iyileştirmeleri yapmak istiyorum. (Status: Done | Developer: Bedirhan)
* **Story 5 (Epic: Süreç Çevikliği, Blokaj Kaldırma & Çapraz Fonksiyonel Risk Yönetimi):** Bir Scrum Master olarak, Sprint 1 aksiyon planına sadık kalarak takımı yönlendirmek, Trello panosundaki yeni mimari iş paketlerinin bağımlılıklarını (Melih'in RAG veri setleri ile Utku'nun backend log mekanizması) haritalandırmak, takımın anlık koordine olduğu WhatsApp kanalı ile dokümantasyon takibinin yapıldığı Slack kanalları arasındaki asenkron iletişim akışını ve Daily Scrum disiplinini sağlamak; modüllerin birleştirilmesi esnasında ortaya çıkan entegrasyon krizlerini proaktif olarak çözmek istiyorum. (Status: Done | Scrum Master: Simge)

---

### 2. Daily Scrum (Günlük Toplantı Özetleri)
<img width="1917" height="952" alt="Ekran görüntüsü 2026-07-17 212603" src="https://github.com/user-attachments/assets/f826097f-b081-4aa3-8af1-7549ed6524fa" />

Sprint 2 boyunca iletişim kanalları en yüksek verimlilikte kullanılmış, operasyonel olarak ağırlıklı tercih edilen WhatsApp grupları ile resmi dökümantasyon kanalı olan Slack senkronize bir şekilde işletilmiştir. Kritik aşamalardaki teknik durum özetleri şu şekildedir:

* **Bedirhan (Web UI & Entegrasyon):** Yapay zeka ajanının ürettiği karmaşık metrikleri içeren "CV Scoring" (Aday Değerlendirme Karnesi) ekranını kullanıcı dostu, dinamik grafiklerle frontend arayüzünde inşa etti. Aday mülakat döngüsünün tetiklenmesi ve İK bilgilendirmeleri için e-posta servis şablonlarını (Mail Integration) sisteme başarıyla gömdü.
* **Utku (Görsel Analiz):** Göz algılama ve ekrana odaklanma (attention tracking) modelinin doğruluk oranını (accuracy) geometrik yüz haritalandırma teknikleriyle en üst seviyeye çıkardı. Adayın ekrandan uzaklaştığı veya odağını kaybettiği anları yakalayan modeli optimize ederek, bu verileri Şafak'ın entegrasyon katmanına besleyecek gerçek zamanlı backend veri çıktısını (Structured JSON output) başarıyla hazırladı.
* **Melih (LLM/AI & RAG Mimarisi):** Teknik mülakatların objektif değerlendirilmesi adına LangChain üzerinde RAG (Retrieval-Augmented Generation) mimarisini kurdu; böylece LLM ajanının önceden belirlenmiş teknik veri setlerine ve bilgi tabanına %100 bağlı kalarak uydurma cevaplar vermesini engelledi. Ayrıca ses modülüyle tam uyumlu çalışan, aday araya girdiğinde veya söz kestiğinde (interrupt) ajanın konuşmayı doğal bir şekilde durdurup adayı dinlemesini sağlayan otonom karar mekanizmasını Python altyapısında tamamladı.
* **Şafak (Ses & Entegrasyon):** Utku'nun geliştirdiği gelişmiş görsel analiz logları ile Melih'in bilgi tabanlı RAG motorunu ana entegrasyon hattında birleştirdi. Ajanın ses yanıt hızıyla eş zamanlı çalışan matematiksel dudak senkronizasyonu (Lip-sync) motorunu entegre ederek tarayıcı tabanlı yapay zeka avatarının tamamen doğal görünmesini sağladı; veri iletimindeki senkronizasyon kaymalarını sıfıra indirdi.
* **Simge (Scrum Master):** Takımın operasyonel olarak ağırlıklı kullandığı WhatsApp grupları ile resmi dökümantasyon kanalı olan Slack üzerindeki bilgi akışını senkronize ederek anlık iletişim kopukluklarını engelledi. Melih'in RAG mimarisine geçerken ihtiyaç duyduğu teknik veri kümesi entegrasyonu ile Şafak'ın dudak senkronizasyonu geliştirirken yaşadığı tarayıcı tabanlı gecikme (latency) krizlerinde araya girerek blokajları (blockers) çözdü. Çapraz fonksiyonel (cross-functional) ekiplerin kod birleştirme (merge) takvimini optimize ederek, kritik teslim öncesinde tüm teknik riskleri bertaraf etti ve sprint hedeflerine tam zamanında ulaşılmasını sağlayan stratejik lider oldu.

---

### 3. Sprint Board SS
<img width="1597" height="817" alt="Ekran görüntüsü 2026-07-19 174255" src="https://github.com/user-attachments/assets/48ecc86e-3e77-414a-a163-4285c4d98096" />
<img width="1911" height="790" alt="Ekran görüntüsü 2026-07-19 173941" src="https://github.com/user-attachments/assets/384d1c21-2a33-41da-8e63-e46c06b5e861" />


### 4. Ürün Durumu SS (Product Increment)
<img width="1302" height="837" alt="WhatsApp Image 2026-07-19 at 19 57 00 (3)" src="https://github.com/user-attachments/assets/7e80e6d1-9385-45b8-a405-621b0b58828c" />
<img width="1540" height="974" alt="WhatsApp Image 2026-07-19 at 20 01 04" src="https://github.com/user-attachments/assets/77a6c189-b246-4826-b795-7094a33b3414" />
<img width="1539" height="1064" alt="WhatsApp Image 2026-07-19 at 20 01 05" src="https://github.com/user-attachments/assets/8bf566a9-dc3b-4c2c-b7ea-309a58a506d2" />
<img width="1545" height="1065" alt="WhatsApp Image 2026-07-19 at 20 01 05 (1)" src="https://github.com/user-attachments/assets/52d76cf6-737f-4b11-ac8b-30431a839ea2" />
<img width="1533" height="1163" alt="WhatsApp Image 2026-07-19 at 20 01 05 (2)" src="https://github.com/user-attachments/assets/0ec9163f-3a05-4330-a353-1531a58a7d94" />
<img width="1098" height="1140" alt="WhatsApp Image 2026-07-19 at 20 01 05 (3)" src="https://github.com/user-attachments/assets/03e535ac-29b8-421d-9437-bf439ad54e0f" />
<img width="846" height="509" alt="WhatsApp Image 2026-07-19 at 20 11 03" src="https://github.com/user-attachments/assets/771f58e4-ed52-4c70-b7fb-4eb7e52c6aab" />
<img width="1242" height="881" alt="WhatsApp Image 2026-07-19 at 19 56 58" src="https://github.com/user-attachments/assets/bc13e325-5ce3-417f-a39c-19d68629408f" />
<img width="1246" height="881" alt="WhatsApp Image 2026-07-19 at 19 56 58 (1)" src="https://github.com/user-attachments/assets/dc75d2c3-2579-466d-ae1c-78990b5e2541" />
<img width="1253" height="882" alt="WhatsApp Image 2026-07-19 at 19 56 59" src="https://github.com/user-attachments/assets/8a5edac9-2cce-4de6-b9c3-88939159e4f1" />
<img width="1245" height="880" alt="WhatsApp Image 2026-07-19 at 19 56 59 (1)" src="https://github.com/user-attachments/assets/18ced88e-968c-4a6a-8018-a2c9f82a967f" />
<img width="861" height="852" alt="WhatsApp Image 2026-07-19 at 19 56 59 (2)" src="https://github.com/user-attachments/assets/ee6d5e82-e913-4cd5-9bcb-55d72b78ff15" />
<img width="1211" height="966" alt="WhatsApp Image 2026-07-19 at 19 56 59 (3)" src="https://github.com/user-attachments/assets/0d85b4ba-a051-4379-b365-0f811fa7f1d8" />
<img width="1598" height="829" alt="WhatsApp Image 2026-07-19 at 19 56 59 (4)" src="https://github.com/user-attachments/assets/28ece7ef-e5e8-48c1-8665-80b8c74b56e4" />
<img width="1600" height="905" alt="WhatsApp Image 2026-07-19 at 19 57 00" src="https://github.com/user-attachments/assets/a983fef7-a576-4238-99b4-3a8c19beb46b" />
<img width="1466" height="848" alt="WhatsApp Image 2026-07-19 at 19 57 00 (1)" src="https://github.com/user-attachments/assets/7c4235b1-7a24-4896-965d-de833e1261ed" />
<img width="1447" height="822" alt="WhatsApp Image 2026-07-19 at 19 57 00 (2)" src="https://github.com/user-attachments/assets/cde18ac7-e593-4522-9085-73b12ce6881b" />

### 5. Sprint Review (Sprint Değerlendirmesi)

* **Ne Hedeflendi?** İkinci sprint için temel hedefimiz; yapay zeka ajanımızın uydurma cevaplar vermesini engelleyecek bir bilgi tabanı (RAG) kurmak, göz takibi modelinin kararlılığını artırarak backend bağlantısını kurmak, mülakat sonu karnesini görselleştirmek ve ajanın ses-dudak senkronizasyonunu kusursuzlaştırmaktı.
* **Ne Elde Edildi?** Planlanan tüm hedeflere eksiksiz ulaşıldı! BlindHire artık sadece konuşan bir yapay zeka değil; RAG mimarisi sayesinde kurumsal veri setlerine göre mülakat yapan, adayın sözünü kesmesini algılayabilen, dudak senkronizasyonuna sahip ve mülakat sonunda İK'ya otomatik mail ile detaylı karne sunabilen tam donanımlı bir B2B SaaS platformu haline geldi.

---

### 6. Sprint Retrospective (Sprint Özeleştirisi)

* **Neleri İyi Yaptık?**
  * Ağırlıklı olarak WhatsApp üzerinden yürüttüğümüz hızlı anlık mesajlaşma dinamizmini, Slack'teki resmi takiplere başarıyla yansıttık; böylece çift kanallı iletişimi verimli kullandık.
  * Modüller arası bağımlılıkları (RAG, CV Backend Logları, Lip-Sync) çok doğru analiz ederek entegrasyon sürecini son güne bırakmadan kademeli olarak tamamladık.
  * Platforma RAG ve otonom söz kesme yönetimi gibi ileri düzey AI yetenekleri ekleyerek projenin teknik değerini katladık.
* **Neleri Geliştirmeliyiz?**
  * RAG mimarisi için teknik veri setlerini hazırlarken harcadığımız zamanı optimize etmek adına sonraki aşamalarda veri toplama süreçlerini otomatikleştirmeliyiz.
  * Çoklu yapay zeka modelleri (CV + RAG LLM + Audio API) aynı anda çalıştığı için tarayıcı üzerindeki yükü hafifletecek performans optimizasyonlarına odaklanmalıyız.

* **Aksiyon Planı (Sprint 3 Hedefleri):**
  * **Yerel Optimizasyon ve Refactoring:** Birden fazla ağır modelin (Göz takibi, RAG motoru ve ses API'leri) yerel makinede (local environment) çalışırken yarattığı tarayıcı yükünü hafifletmek adına performans ve bellek optimizasyonlarını gerçekleştirmek.
  * **Yapay Zeka Çeşitliliği (DEI):** Mülakat değerlendirmelerinde yapay zekanın tarafsızlığını (bias check) ölçen algoritmaları devreye almak.


 ## Sprint 3 (Final Sprint)

### 1. Backlog Düzeni ve Story Seçimleri (Sprint Backlog)

Sprint 3 (Final Sprint) planlama toplantısında, BlindHire platformunun tüm modüllerinin (LLM/RAG, Computer Vision, Ses ve Frontend) uçtan uca entegre edilmesi, sistem kararlılığının artırılması, halüsinasyon ve bug fix (hata giderme) süreçlerinin tamamlanması ve platformun nihai sunuma eksiksiz hazırlanması hedeflenmiştir. Trello üzerinde şu iş kalemleri önceliklendirilmiştir:

* **Story 1 (Epic: Computer Vision / Model Entegrasyonu & Hata İyileştirme):** Bir yapay zeka geliştiricisi olarak, göz ve odağı takip eden bilgisayarlı görü modelinin frontend ve backend ile olan son entegrasyon kanallarını tamamlamak, test aşamasında tespit edilen görüntü işleme bug'larını gidermek ve model kararlılığını en üst seviyeye çıkarmak istiyorum. (Status: Done | Developer: Utku)
* **Story 2 (Epic: Conversational AI / Halüsinasyon Önleme & Bug Fixing):** Bir yapay zeka geliştiricisi olarak, RAG mimarisi üzerinden çalışan LLM ajanının kenar durumlarda (edge cases) ürettiği halüsinasyonları ve mantıksal hataları gidermek, prompt sınırlandırmalarını sıkılaştırmak ve mülakat diyalog akışındaki AI bug'larını tamamen temizlemek istiyorum. (Status: Done | Developer: Melih)
* **Story 3 (Epic: Ses & Entegrasyon / Uçtan Uca Test & Sistem Kararlılığı):** Bir sistem mimarı ve entegratör olarak, ses, metin ve görüntü işleme modüllerinin bir arada çalıştığı bütünleşik mimariyi kapsamlı stres ve entegrasyon testlerine tabi tutmak, ses iletimi ve yanıt gecikmelerindeki (latency) entegrasyon bug'larını çözmek istiyorum. (Status: Done | Developer/Product Owner: Şafak)
* **Story 4 (Epic: Web UI / Model Bağlantıları, Performans Optimizasyonu & Test):** Bir frontend geliştiricisi olarak, arayüz bileşenlerini canlı çalışan yapay zeka ve görüntü işleme modellerine bağlamak, tarayıcı üzerindeki işlem yükünü hafifletecek performans ve bellek optimizasyonlarını gerçekleştirmek ve uçtan uca kullanıcı kabul testlerini (UAT) yürütmek istiyorum. (Status: Done | Developer: Bedirhan)
* **Story 5 (Epic: Süreç Liderliği, Final Kapanışı & Sunum Hazırlık Koordinasyonu):** Bir Scrum Master olarak, son sprintte ekibin test ve bug fix süreçlerindeki odaklanmasını korumak, modül entegrasyonlarında ortaya çıkan krizleri proaktif olarak çözmek, WhatsApp ve Slack kanallarındaki son kontrol akışını yönetmek ve projenin final jüri teslimi öncesinde tüm Agile sürecini eksiksiz şekilde kapatmak istiyorum. (Status: Done | Scrum Master: Simge)

---

### 2. Daily Scrum (Günlük Toplantı Özetleri)
<img width="1917" height="877" alt="Ekran görüntüsü 2026-07-29 213929" src="https://github.com/user-attachments/assets/367a9cb1-86c4-4a1c-ba19-0d7cf08d0c80" />

Final sprinti boyunca yoğun bir test ve bug fix maratonu yürütülmüş, anlık teknik krizler WhatsApp üzerinden çözülürken, resmi süreç takibi ve raporlamalar Slack üzerinden sürdürülmüştür. Kritik aşamalardaki teknik durum özetleri şu şekildedir:

* **Bedirhan (Web UI & Entegrasyon):** Utku'nun görüntü işleme modelini ve Melih'in LLM motorunu frontend arayüzüne tamamen bağladı. Çoklu modellerin aynı anda çalışmasından kaynaklanan tarayıcı kasma/yavaşlama sorunlarını bellek optimizasyonuyla çözerek akıcı bir kullanıcı deneyimi sağladı. Uçtan uca testleri tamamladı.
* **Utku (Görsel Analiz):** Görüntü işleme modelinin frontend ve backend ile iletişim kurduğu veri hatlarındaki entegrasyon bug'larını temizledi. Modelin adayın odağını anlık kaybetmesi durumunda oluşan yanlış alarm çıktılarını optimize ederek kararlı ve doğru veri üreten nihai görsel analiz modülünü teslim etti.
* **Melih (LLM/AI & RAG Mimarisi):** Mülakat esnasında LLM ajanının RAG veri seti dışına çıkıp uydurma yanıtlar vermesine (halüsinasyon) yol açan prompt ve kural açıklarını kapattı. Mülakat senaryolarında karşılaşılan mantıksal hataları ve diyalog blokajlarını düzelterek tutarlı, profesyonel bir mülakat ajanı elde etti.
* **Şafak (Ses & Entegrasyon):** Bütünleşik sistem üzerinde kapsamlı entegrasyon ve stres testleri yürüttü. Ses girdi/çıktıları ile LLM yanıtları arasında yaşanan anlık senkronizasyon kopmalarını ve ağ gecikmelerini çözerek sistemin uçtan uca donmadan ve kesintisiz çalışmasını garantiledi.
* **Simge (Scrum Master):** Final sprintindeki yüksek temposunda takım içi motivasyonu ve iletişimi en üst düzeyde tuttu. Modellerin bağlanması esnasında Bedirhan, Utku ve Melih arasında yaşanan entegrasyon krizlerinde araya girerek blokajları (blockers) anında kaldırdı. WhatsApp/Slack çift kanallı koordinasyonuyla test süreçlerini ivmelendirdi ve BlindHire projesinin tüm Agile süreçlerini başarıyla tamamlayıp jüri teslimine eksiksiz hazırladı.

---

### 3. Sprint Board SS

<img width="1919" height="877" alt="image" src="https://github.com/user-attachments/assets/2960e8c6-92a4-4d45-8721-45ff50621279" />


---

### 4. Ürün Durumu SS (Product Increment)

<img width="1175" height="623" alt="image" src="https://github.com/user-attachments/assets/1dd2cf88-7e58-45af-be6e-64cbf0eb8ad8" />

<img width="1160" height="603" alt="image" src="https://github.com/user-attachments/assets/24e551be-6ab1-48c9-b2f1-7cb3053d1a0f" />

<img width="1167" height="602" alt="image" src="https://github.com/user-attachments/assets/5dd879c7-4cd8-4ff5-8acb-d1ae25cc1e0e" />

<img width="1172" height="595" alt="image" src="https://github.com/user-attachments/assets/dcb5831c-e0d1-451d-8765-1ef5e6341120" />

<img width="1152" height="606" alt="image" src="https://github.com/user-attachments/assets/e2d5bb65-3547-4462-bc5f-c8d53f6e75b4" />

<img width="1168" height="601" alt="image" src="https://github.com/user-attachments/assets/e06a1254-1da7-41ec-88ce-09c556ee0bb1" />

<img width="1167" height="596" alt="image" src="https://github.com/user-attachments/assets/f97aaa66-e148-4fec-b1b1-9219e73e9043" />

---

### 5. Sprint Review (Sprint Değerlendirmesi)

* **Ne Hedeflendi?** Final sprintindeki temel hedefimiz; geliştirilen tüm modülleri (RAG LLM, Görüntü İşleme, Ses, Frontend) birbirine bağlamak, halüsinasyonları ve bug'ları temizlemek, tarayıcı performansını optimize etmek ve uçtan uca sorunsuz çalışan bir yayın sürümü elde etmekti.
* **Ne Elde Edildi?** Proje hedeflerinin %100'üne ulaşıldı! BlindHire; otonom sesli/görsel analiz yapabilen, RAG mimarisiyle halüsinasyonsuz mülakat yürüten, performans optimizasyonu yapılmış ve testleri tamamlanmış, üretime/sunuma hazır kararlı bir yapay zeka platformu olarak tamamlandı.

---

### 6. Sprint Retrospective (Sprint Özeleştirisi)

* **Neleri İyi Yaptık?**
  * Tüm ekibin ortak gayreti ve Scrum Master'ımızın kriz yönetimi sayesinde test ve bug fix sürecini çok hızlı yönettik.
  * Bağımsız modüllerin birleştirilmesi aşamasında yaşanan performans ve uyum sorunlarını ertelemeden anında çözdük.
  * Başlangıçta belirlediğimiz MVP vizyonunun ötesine geçerek RAG, Lip-Sync, Göz Takibi ve Otomatik Skorlama içeren tam teşekküllü bir B2B SaaS ürünü ortaya çıkardık.
* **Neleri Geliştirmeliyiz?**
  * Gelecek versiyonlarda (Post-MVP), test otomasyonu süreçlerini daha erken sprintlerde kurgulayarak manuel test yükünü azaltabiliriz.
* **Aksiyon Planı (Gelecek & Yaygınlaştırma Visyonu):**
  * Proje jüriye sunularak bootcamp süreci başarıyla tamamlanacak.
