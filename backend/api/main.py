"""
BlindHire Backend API — FastAPI + WebSocket + Paralel Pipeline

Bu modül tüm servisleri (TTS, ASR, LipSync, LLM Orkestratör) birleştirir
ve frontend ile WebSocket üzerinden gerçek zamanlı iletişim sağlar.

Paralel Pipeline Mimarisi:
    LLM stream → cümle tamamlanır → asyncio.create_task(TTS → LipSync) → WS'e gönder
    Her cümle bağımsız bir async görev olarak işlenir, frontend sıraya alıp oynatır.

Çalıştırma:
    cd backend/api
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import sys
import json
import asyncio
import base64
import logging
import time
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# .env dosyasını yükle (backend/api/.env veya proje kökü)
load_dotenv()
# ai_agent .env dosyasını da yükle
_ai_agent_env = Path(__file__).parent.parent.parent / "ai_agent" / ".env"
if _ai_agent_env.exists():
    load_dotenv(_ai_agent_env)

# ai_agent modülünü import edebilmek için sys.path'e ekle
_ai_agent_path = str(Path(__file__).parent.parent.parent / "ai_agent")
if _ai_agent_path not in sys.path:
    sys.path.insert(0, _ai_agent_path)

from tts_service import TTSService
from asr_service import ASRService
from lipsync_service import LipSyncService

# Logging yapılandırması
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("blindhire.api")

# ──────────────────────────────────────────────
#  Servis Singletonları
# ──────────────────────────────────────────────
tts_service: Optional[TTSService] = None
asr_service: Optional[ASRService] = None
lipsync_service: Optional[LipSyncService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Uygulama başlangıcında servisleri ilklendirir."""
    global tts_service, asr_service, lipsync_service

    logger.info("=" * 60)
    logger.info("BlindHire Backend API başlatılıyor...")
    logger.info("=" * 60)

    # TTS servisi
    tts_service = TTSService()
    logger.info("[TTS] edge-tts servisi hazır.")

    # ASR servisi
    try:
        asr_service = ASRService()
        logger.info("[ASR] Groq Whisper servisi hazır.")
    except ValueError as e:
        logger.warning(f"[ASR] Servis başlatılamadı: {e}")
        asr_service = None

    # LipSync servisi
    lipsync_service = LipSyncService()
    logger.info("[LipSync] Wav2Lip servisi hazır.")

    # Karşılama cümlelerini önceden sentezle (prerender)
    logger.info("[Prerender] Sık kullanılan kalıp cümleler sentezleniyor...")
    prerender_texts = [
        "Merhaba, BlindHire otonom teknik tarama sistemine hoş geldiniz.",
        "Mülakatınız için zaman ayırdığınız için teşekkür ederiz. Değerlendirme sürecimiz başlamıştır.",
    ]
    for text in prerender_texts:
        for voice in ["male", "female"]:
            try:
                await tts_service.synthesize(text, voice=voice)
            except Exception as e:
                logger.warning(f"[Prerender] '{text[:40]}...' ({voice}) sentezlenemedi: {e}")

    # Mülakat modelini ve retriever'i önyükle
    logger.info("[Retriever] NLP/Embedding modeli başlatılıyor (Bu işlem birkaç saniye sürebilir)...")
    try:
        from retriever import QuestionRetriever
        QuestionRetriever()
        logger.info("[Retriever] Model başarıyla yüklendi ve hazır!")
    except Exception as e:
        logger.error(f"[Retriever] Model yüklenirken hata oluştu: {e}")

    logger.info("[Prerender] Tamamlandı.")
    logger.info("=" * 60)
    logger.info("BlindHire Backend API hazır! → http://localhost:8000")
    logger.info("=" * 60)

    yield

    logger.info("BlindHire Backend API kapatılıyor...")


# ──────────────────────────────────────────────
#  FastAPI Uygulaması
# ──────────────────────────────────────────────
app = FastAPI(
    title="BlindHire Backend API",
    description="Otonom AI Mülakat Sistemi — TTS, ASR, Lip-Sync, LLM Orkestrasyon",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — Next.js frontend'in erişimine izin ver
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Statik dosyalar (avatar, cache, video)
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


# ──────────────────────────────────────────────
#  Health Check
# ──────────────────────────────────────────────
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "services": {
            "tts": tts_service is not None,
            "asr": asr_service is not None,
            "lipsync": lipsync_service is not None,
        },
    }


# ──────────────────────────────────────────────
#  WebSocket: Mülakat Oturumu
# ──────────────────────────────────────────────
@app.websocket("/ws/interview")
async def websocket_interview(ws: WebSocket):
    """
    Mülakat WebSocket endpoint'i.
    
    Frontend → Backend mesaj formatları:
        {"type": "start", "voice": "male"|"female"}      → Mülakatı başlat
        {"type": "audio", "data": "<base64>"}             → Aday ses kaydı
        {"type": "text", "data": "aday metni"}            → Aday metin girişi (fallback)
        {"type": "interrupt", "data": "<base64>",          → Söz kesme
         "unfinished": "yarım kalan metin"}

    Backend → Frontend mesaj formatları:
        {"type": "state", "state": "WELCOME"}             → Mülakat durumu
        {"type": "transcript", "text": "..."}             → AI yanıt metni (cümle bazlı)
        {"type": "tts_ready", "url": "/static/...mp3"}    → TTS ses dosyası hazır
        {"type": "video_ready", "url": "/static/...mp4"}  → Lip-sync video hazır
        {"type": "audio_only", "url": "/static/...mp3"}   → Fallback: sadece ses
        {"type": "thinking"}                              → AI düşünüyor
        {"type": "scorecard", "data": {...}}               → Mülakat skor kartı
        {"type": "error", "message": "..."}               → Hata mesajı
        {"type": "completed"}                             → Mülakat tamamlandı
    """
    await ws.accept()
    logger.info("[WS] Yeni mülakat bağlantısı kuruldu.")

    orchestrator = None
    voice_preference = "male"
    sentence_queue: asyncio.Queue = asyncio.Queue()

    try:
        while True:
            raw = await ws.receive_text()

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "Geçersiz JSON formatı."})
                continue

            msg_type = msg.get("type", "")

            # ────────────────────────────────
            #  START: Mülakatı başlat
            # ────────────────────────────────
            if msg_type == "start":
                # Savunma amaçlı: bu bağlantıda mülakat zaten başlatılmışsa (örn.
                # frontend'den yanlışlıkla iki kez "start" gönderilmesi durumunda),
                # orkestratörü sıfırdan oluşturup mevcut konuşmayı kaybetmek yerine
                # mevcut durumu aynen koru ve isteği sessizce yok say.
                if orchestrator is not None:
                    logger.warning("[WS] Mülakat zaten başlatılmış, tekrarlanan 'start' mesajı yok sayıldı.")
                    continue

                voice_preference = msg.get("voice", "male")
                logger.info(f"[WS] Mülakat başlatılıyor (ses: {voice_preference})...")

                try:
                    from orchestrator import InterviewOrchestrator
                    orchestrator = InterviewOrchestrator()
                    logger.info("[WS] Orkestratör başarıyla ilklendi.")
                except Exception as e:
                    logger.error(f"[WS] Orkestratör başlatılamadı: {e}")
                    await ws.send_json({"type": "error", "message": f"Orkestratör başlatılamadı: {e}"})
                    continue

                # Durum bilgisi gönder
                await ws.send_json({"type": "state", "state": orchestrator.current_state.value})
                await ws.send_json({"type": "thinking"})

                # Karşılama mesajını stream et ve paralel pipeline'a gönder
                await _stream_and_pipeline(
                    ws=ws,
                    orchestrator=orchestrator,
                    user_text="",
                    voice=voice_preference,
                    interrupted=False,
                    unfinished_ai_text="",
                )

            # ────────────────────────────────
            #  AUDIO: Aday ses kaydı (ASR)
            # ────────────────────────────────
            elif msg_type == "audio":
                if not orchestrator:
                    await ws.send_json({"type": "error", "message": "Mülakat henüz başlatılmadı."})
                    continue

                if not asr_service:
                    await ws.send_json({"type": "error", "message": "ASR servisi kullanılamıyor."})
                    continue

                audio_b64 = msg.get("data", "")
                if not audio_b64:
                    await ws.send_json({"type": "error", "message": "Ses verisi boş."})
                    continue

                try:
                    audio_bytes = base64.b64decode(audio_b64)
                except Exception:
                    await ws.send_json({"type": "error", "message": "Base64 çözümleme hatası."})
                    continue

                # ASR ile metne çevir
                await ws.send_json({"type": "thinking"})
                try:
                    transcript = await asr_service.transcribe(audio_bytes)
                    logger.info(f"[ASR] Transkript: {transcript[:80]}...")
                except Exception as e:
                    logger.error(f"[ASR] Transkripsiyon hatası: {e}")
                    await ws.send_json({"type": "error", "message": f"Ses tanıma hatası: {e}"})
                    continue

                if not transcript.strip():
                    await ws.send_json({"type": "error", "message": "Ses algılanamadı, lütfen tekrar deneyin."})
                    continue

                # Adayın söylediğini frontend'e gönder
                await ws.send_json({"type": "user_transcript", "text": transcript})

                # Durum bilgisi
                await ws.send_json({"type": "state", "state": orchestrator.current_state.value})

                # Orkestratöre gönder ve paralel pipeline'ı başlat
                interrupted = msg.get("interrupted", False)
                unfinished = msg.get("unfinished", "")

                await _stream_and_pipeline(
                    ws=ws,
                    orchestrator=orchestrator,
                    user_text=transcript,
                    voice=voice_preference,
                    interrupted=interrupted,
                    unfinished_ai_text=unfinished,
                )

            # ────────────────────────────────
            #  TEXT: Aday metin girişi (fallback)
            # ────────────────────────────────
            elif msg_type == "text":
                if not orchestrator:
                    await ws.send_json({"type": "error", "message": "Mülakat henüz başlatılmadı."})
                    continue

                user_text = msg.get("data", "").strip()
                if not user_text:
                    continue

                await ws.send_json({"type": "state", "state": orchestrator.current_state.value})
                await ws.send_json({"type": "thinking"})

                interrupted = msg.get("interrupted", False)
                unfinished = msg.get("unfinished", "")

                await _stream_and_pipeline(
                    ws=ws,
                    orchestrator=orchestrator,
                    user_text=user_text,
                    voice=voice_preference,
                    interrupted=interrupted,
                    unfinished_ai_text=unfinished,
                )

            # ────────────────────────────────
            #  SCORECARD: Skor kartı talep et
            # ────────────────────────────────
            elif msg_type == "scorecard":
                if not orchestrator:
                    await ws.send_json({"type": "error", "message": "Mülakat henüz başlatılmadı."})
                    continue

                logger.info("[WS] Skor kartı üretiliyor...")
                await ws.send_json({"type": "thinking"})

                try:
                    scorecard = await orchestrator.generate_scorecard_async()
                    await ws.send_json({"type": "scorecard", "data": scorecard})
                    logger.info(f"[WS] Skor kartı gönderildi: {scorecard.get('technical_score', 'N/A')}/10")
                except Exception as e:
                    logger.error(f"[WS] Skor kartı hatası: {e}")
                    await ws.send_json({"type": "error", "message": f"Skor kartı üretilemedi: {e}"})

            else:
                await ws.send_json({"type": "error", "message": f"Bilinmeyen mesaj tipi: {msg_type}"})

    except WebSocketDisconnect:
        logger.info("[WS] Mülakat bağlantısı kapandı.")
    except Exception as e:
        logger.error(f"[WS] Beklenmeyen hata: {e}")
        try:
            await ws.send_json({"type": "error", "message": f"Sunucu hatası: {e}"})
        except Exception:
            pass


# ──────────────────────────────────────────────
#  Paralel Pipeline: LLM Stream → TTS → LipSync
# ──────────────────────────────────────────────
async def _stream_and_pipeline(
    ws: WebSocket,
    orchestrator,
    user_text: str,
    voice: str,
    interrupted: bool = False,
    unfinished_ai_text: str = "",
):
    """
    Orkestratörden gelen yanıtı cümle bazlı stream eder,
    her cümle için paralel olarak TTS ve LipSync görevleri başlatır.

    Pipeline:
        LLM token stream → cümle biriktir → [TTS → LipSync] async task → WS'e gönder
    """
    import re

    sentence_index = 0
    pending_tasks: list[asyncio.Task] = []
    turn_start = time.time()
    first_token_time: Optional[float] = None

    try:
        full_response = ""
        buffer = ""

        async for token in orchestrator.process_input_stream(
            user_text=user_text,
            interrupted=interrupted,
            unfinished_ai_text=unfinished_ai_text,
        ):
            if first_token_time is None:
                first_token_time = time.time() - turn_start
            full_response += token
            buffer += token

            # Cümle sınırı kontrolü: nokta, ünlem, soru işareti veya yeni satır
            sentences = re.split(r'(?<=[.!?\n])\s*', buffer)

            if len(sentences) > 1:
                # Son parça henüz tamamlanmamış olabilir, buffer'da tut
                complete_sentences = sentences[:-1]
                buffer = sentences[-1]

                for sentence in complete_sentences:
                    sentence = sentence.strip()
                    if not sentence:
                        continue

                    # Transkript olarak frontend'e gönder
                    await ws.send_json({
                        "type": "transcript",
                        "text": sentence,
                        "index": sentence_index,
                    })

                    # Paralel TTS + LipSync görevini başlat
                    task = asyncio.create_task(
                        _process_sentence(
                            ws=ws,
                            sentence=sentence,
                            index=sentence_index,
                            voice=voice,
                        )
                    )
                    pending_tasks.append(task)
                    sentence_index += 1

        # Buffer'da kalan son cümle
        if buffer.strip():
            await ws.send_json({
                "type": "transcript",
                "text": buffer.strip(),
                "index": sentence_index,
            })

            task = asyncio.create_task(
                _process_sentence(
                    ws=ws,
                    sentence=buffer.strip(),
                    index=sentence_index,
                    voice=voice,
                )
            )
            pending_tasks.append(task)

        # Tüm paralel görevlerin tamamlanmasını bekle
        if pending_tasks:
            await asyncio.gather(*pending_tasks, return_exceptions=True)

        # DEBUG: aday mesajı + modelin tam yanıtını + yanıt sürelerini sırasıyla tek
        # satırda kaydet (canlı test/hata ayıklama için geçici log — pushlanmayacak).
        # İlk-token-süresi = LLM'in ilk kelimeyi üretmesine kadar geçen süre (algılanan
        # gecikme). Toplam-süre = TTS/LipSync dahil tüm işlem pipeline'ının süresi.
        total_time = time.time() - turn_start
        ilk_token_str = f"{first_token_time:.2f}sn" if first_token_time is not None else "N/A"
        logger.info(
            f"[TRANSKRIPT] Aday: {user_text!r} || BlindHire: {full_response!r} || "
            f"Sonraki-Durum: {orchestrator.current_state.value} || "
            f"İlk-Token: {ilk_token_str} || Toplam-Süre: {total_time:.2f}sn"
        )

        # Yeni durum bilgisi gönder
        await ws.send_json({"type": "state", "state": orchestrator.current_state.value})

        # Mülakat tamamlandıysa bildir
        from orchestrator import InterviewState
        if orchestrator.current_state == InterviewState.COMPLETED:
            await ws.send_json({"type": "completed"})

    except Exception as e:
        logger.error(f"[Pipeline] Hata: {e}")
        await ws.send_json({"type": "error", "message": f"Pipeline hatası: {e}"})


async def _process_sentence(
    ws: WebSocket,
    sentence: str,
    index: int,
    voice: str,
):
    """
    Tek bir cümle için TTS → LipSync pipeline'ını çalıştırır.
    
    1. edge-tts ile ses sentezlenir
    2. Wav2Lip ile lip-sync video üretilir
    3. Sonuç WebSocket üzerinden frontend'e gönderilir
    """
    start_time = time.time()

    # ── Adım 1: TTS ──
    try:
        audio_path = await tts_service.synthesize(sentence, voice=voice)
        audio_url = tts_service.get_relative_url(audio_path)
        tts_duration = time.time() - start_time
        logger.info(f"[TTS] Cümle #{index} sentezlendi ({tts_duration:.2f}sn): {sentence[:50]}...")
    except Exception as e:
        logger.error(f"[TTS] Cümle #{index} sentez hatası: {e}")
        await ws.send_json({
            "type": "error",
            "message": f"TTS hatası: {e}",
            "index": index,
        })
        return

    # TTS hazır — frontend'e ses URL'sini gönder (video gelmese bile ses çalabilsin)
    await ws.send_json({
        "type": "tts_ready",
        "url": audio_url,
        "index": index,
    })

    # ── Adım 2: Lip-Sync ──
    try:
        video_path = await lipsync_service.generate(
            audio_path=audio_path,
            gender=voice,
        )
        lipsync_duration = time.time() - start_time - tts_duration

        if video_path:
            video_url = lipsync_service.get_relative_url(video_path)
            logger.info(f"[LipSync] Cümle #{index} video üretildi ({lipsync_duration:.2f}sn)")
            await ws.send_json({
                "type": "video_ready",
                "url": video_url,
                "index": index,
            })
        else:
            # Fallback: audio-only mod
            logger.info(f"[LipSync] Cümle #{index} fallback — audio-only mod.")
            await ws.send_json({
                "type": "audio_only",
                "url": audio_url,
                "index": index,
            })

    except Exception as e:
        logger.warning(f"[LipSync] Cümle #{index} lip-sync hatası: {e} — audio-only moda geçiliyor.")
        await ws.send_json({
            "type": "audio_only",
            "url": audio_url,
            "index": index,
        })


# ──────────────────────────────────────────────
#  Doğrudan çalıştırma
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
