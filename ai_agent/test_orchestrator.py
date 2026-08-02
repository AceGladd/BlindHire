import time
import json
import asyncio
from orchestrator import InterviewOrchestrator, InterviewState

async def simulate_interview():
    print("=" * 60)
    print("BLINDHIRE OTONOM MÜLAKAT AJANI SIMÜLASYONU BAŞLIYOR (ASENKRON STREAM + RAG)")
    print("=" * 60)

    try:
        # Orkestratörü başlat
        orchestrator = InterviewOrchestrator()
    except Exception as e:
        print(f"Orkestratör başlatılırken hata oluştu: {e}")
        return

    # Aday cevaplarının, söz kesme (interrupt) ve uç durum (edge case) senaryolarının kurgulanması
    candidate_steps = [
        {"text": "", "interrupted": False, "unfinished": ""},  # Mülakatı başlatır
        {"text": "Merhaba, hazırım, başlayabiliriz.", "interrupted": False, "unfinished": ""},  # Karşılama onaylanır
        
        # EDGE CASE 1: Aday konudan sapıp ajana soru soruyor (off-topic)
        {"text": "Yaklaşık 4 yıldır backend mühendisliği yapıyorum. Bu arada sen bir yapay zeka olarak nasıl tasarlandın, arkada hangi LLM modellerini kullanıyorsun?", "interrupted": False, "unfinished": ""},
        
        # SÖZ KESME (INTERRUPT) SENARYOSU:
        # TECHNICAL_1 aşamasına geçildiğinde ajan soruyu sormaya başladığı an aday araya girer
        {"text": "Lafınızı bölüyorum ama, Python'da decorator yazarken functools.wraps kullanmanın ne gibi bir faydası var? Bunu tam olarak açıklayabilir misiniz?", "interrupted": True, "unfinished": "Sorulacak soru şudur: Python'da decorator nedir? Bir fonksiyonun çalışma süresini ölçen bir decorator'ı argümanlı ve argümansız olarak nasıl yazarsın?"},
        
        # Adayın sözü kesildikten sonra ajan adaya cevap verir ve mülakat durumu TECHNICAL_1'de kalmaya devam eder.
        # Aday şimdi asıl teknik sorunun cevabını veriyor.
        {"text": "Tamam anladım. Python'daki decorator'lar, sarmaladıkları fonksiyonların kodunu değiştirmeden onlara yeni özellikler eklememizi sağlar. @ işareti ile kullanılırlar. wraps ise metadata korumaya yarar.", "interrupted": False, "unfinished": ""},
        
        # EDGE CASE 2: Aday TECHNICAL_2 sorusunu bilmediğini belirterek pas geçmek istiyor (pass)
        {"text": "Maalesef bu konuyu (mikroservislerde senkron/asenkron iletişim ve Kafka) daha önce derinlemesine kullanmadım, pas geçebilir miyiz?", "interrupted": False, "unfinished": ""},
        
        # Normal akış senaryo aşamasıyla devam eder
        {"text": "Öncelikle cProfile ve memory_profiler gibi araçlarla kodun hangi kısmında bellek sızıntısı veya gecikme olduğunu tespit ederim. Sorgu optimizasyonu yapar ve gerekiyorsa verileri asenkron işlerim.", "interrupted": False, "unfinished": ""},
        {"text": "Hayır, bir sorum yok. Her şey çok netti. Teşekkürler.", "interrupted": False, "unfinished": ""}
    ]

    for i, step in enumerate(candidate_steps):
        print(f"\n[AŞAMA]: {orchestrator.current_state.value}")
        
        # Eğer bu aşama için referans sorular seçilmişse debug bilgisini yazdır
        if orchestrator.current_state in orchestrator.selected_questions:
            candidates = orchestrator.selected_questions[orchestrator.current_state]
            ids = ", ".join(f"{q['id']} ({q['category']})" for q in candidates)
            print(f"[DEBUG - RAG]: Referans Sorular: {ids}")

        response = step["text"]
        interrupted = step["interrupted"]
        unfinished = step["unfinished"]

        if response:
            if interrupted:
                print(f"Aday (Araya Girdi / Soz Kesti): {response}")
                print(f"  |- Ajanin yarim kalan sozu: \"{unfinished}...\"")
            else:
                print(f"Aday: {response}")
        else:
            print("Aday: <Mülakatı Başlat>")
        
        # Süreyi ölç
        start_time = time.time()
        
        print("BlindHire: ", end="", flush=True)
        # Asenkron response stream çağrısı
        first_token = True
        async for token in orchestrator.process_input_stream(
            user_text=response,
            interrupted=interrupted,
            unfinished_ai_text=unfinished
        ):
            if first_token:
                first_token_time = time.time() - start_time
                # İlk token'ın gelme süresini (TTFT) ekrana basıyoruz
                print(f"[{first_token_time:.2f}sn] ", end="", flush=True)
                first_token = False
            print(token, end="", flush=True)
        
        duration = time.time() - start_time
        print(f"\n[TOPLAM SÜRE: {duration:.2f}sn]")
        print("-" * 50)
        
        # Rate limit engellemek için kısa bir gecikme ekle
        await asyncio.sleep(2.0)

    print("\n[DEBUG] Mülakat Geçmişi Mesajları:")
    for idx, msg in enumerate(orchestrator.chat_history):
        print(f"  {idx}: {type(msg).__name__} -> {repr(msg.content[:70])}")
        
    print("\n[AŞAMA]: Değerlendirme & Skor Kartı Üretimi")
    # Groq'un ücretsiz katmanındaki 6000 TPM limitinin sıfırlanması için 16 saniye bekliyoruz
    print("Groq API rate limit (TPM) penceresinin sıfırlanması için 16 saniye bekleniyor...")
    await asyncio.sleep(16.0)
    start_time = time.time()
    scorecard = await orchestrator.generate_scorecard_async()
    duration = time.time() - start_time
    print(f"Değerlendirme Süresi: {duration:.2f}sn")
    
    print("\n[ÜRETİLEN SKOR KARTI]:")
    print(json.dumps(scorecard, indent=2, ensure_ascii=False))
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(simulate_interview())
