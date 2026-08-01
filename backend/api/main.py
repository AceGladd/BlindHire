"""
BlindHire Backend API — FastAPI + WebSocket + Paralel Pipeline

Bu modül TTS, ASR ve LLM Orkestratörü birleştirir.
Avatar senkronizasyonu artık frontend'de yerel video döngüsü ile yapılır.
LipSync (Wav2Lip) tamamen kaldırılmıştır.

Pipeline:
    LLM stream → cümle tamamlanır → asyncio.create_task(TTS) → WS'e gönder
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

# .env dosyalarını yükle (backend/api/.env, backend/.env veya proje kökü)
load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv(Path(__file__).parent.parent.parent / ".env")

# ai_agent modülünü import edebilmek için sys.path'e ekle
_ai_agent_path = str(Path(__file__).parent.parent.parent / "ai_agent")
if _ai_agent_path not in sys.path:
    sys.path.insert(0, _ai_agent_path)

from api.tts_service import TTSService
from api.asr_service import ASRService

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Uygulama başlangıcında servisleri ilklendirir."""
    global tts_service, asr_service

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
    description="Otonom AI Mülakat Sistemi — TTS, ASR, LLM Orkestrasyon",
    version="3.0.0",
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

# Statik dosyalar (tts cache)
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

    Backend → Frontend mesaj formatları:
        {"type": "state", "state": "WELCOME"}             → Mülakat durumu
        {"type": "transcript", "text": "...", "index": N} → AI yanıt metni (cümle bazlı)
        {"type": "tts_ready",
         "url": "/static/...mp3",
         "index": N,
         "isAiSpeaking": true}                            → TTS ses dosyası hazır, avatar konuşuyor
        {"type": "tts_done",
         "index": N,
         "isAiSpeaking": false}                           → Bu yanıt turundaki son cümle bitti
        {"type": "user_transcript", "text": "..."}        → Adayın konuşması metne çevrildi
        {"type": "thinking"}                              → AI düşünüyor
        {"type": "scorecard", "data": {...}}               → Mülakat skor kartı
        {"type": "error", "message": "..."}               → Hata mesajı
        {"type": "completed"}                             → Mülakat tamamlandı
    """
    await ws.accept()
    logger.info("[WS] Yeni mülakat bağlantısı kuruldu.")

    orchestrator = None
    voice_preference = "male"
    face_service = None

    try:
        from api.face_analysis_service import FaceAnalysisService
        face_service = FaceAnalysisService()
    except Exception as e:
        logger.warning(f"[WS] FaceAnalysisService başlatılamadı: {e}")

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
            #  FRAME: Yüz & Göz Analizi Karesi
            # ────────────────────────────────
            if msg_type == "frame":
                if face_service and face_service.enabled:
                    img_data = msg.get("data", "")
                    if img_data:
                        analysis_res = await asyncio.to_thread(face_service.process_frame, img_data)
                        warning = analysis_res.get("warning")
                        if warning:
                            logger.info(f"[PROCTOR] Nazik Uyarı Tetiklendi: {warning['message']}")
                            await ws.send_json({
                                "type": "proctor_warning",
                                "message": warning["message"],
                                "code": warning.get("code", "WARNING")
                            })

            # ────────────────────────────────
            #  START: Mülakatı başlat
            # ────────────────────────────────
            elif msg_type == "start":
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

                # Karşılama mesajını stream et ve TTS pipeline'a gönder
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

                # Orkestratöre gönder ve pipeline'ı başlat
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
                    facial_metrics = face_service.get_session_metrics() if face_service else None
                    scorecard = await orchestrator.generate_scorecard_async(facial_metrics=facial_metrics)
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
#  Paralel Pipeline: LLM Stream → TTS
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
    her cümle için paralel TTS görevi başlatır.
    Avatar senkronizasyonu isAiSpeaking flag'i ile frontend tarafından yönetilir.

    Pipeline:
        LLM token stream → cümle biriktir → TTS async task → WS'e gönder
    """
    import re

    sentence_index = 0
    pending_tasks: list[asyncio.Task] = []

    try:
        full_response = ""
        buffer = ""

        async for token in orchestrator.process_input_stream(
            user_text=user_text,
            interrupted=interrupted,
            unfinished_ai_text=unfinished_ai_text,
        ):
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

                    # Paralel TTS görevini başlat
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

        # Bu tur bitti — avatar dinleme moduna geçiyor
        # Frontend'in audio.onended event'i zaten bunu tetikler;
        # bu mesaj ise ek bir güvence katmanıdır.
        await ws.send_json({
            "type": "tts_done",
            "isAiSpeaking": False,
        })

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
    Tek bir cümle için TTS pipeline'ını çalıştırır.
    
    1. edge-tts ile ses sentezlenir
    2. TTS hazır olduğunda isAiSpeaking=true ile birlikte frontend'e gönderilir
       → Frontend bu flag'i alınca speaking.mp4 döngüsüne geçer
    """
    start_time = time.time()

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

    # TTS hazır — avatar konuşuyor sinyali ile birlikte gönder
    await ws.send_json({
        "type": "tts_ready",
        "url": audio_url,
        "index": index,
        "isAiSpeaking": True,
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
