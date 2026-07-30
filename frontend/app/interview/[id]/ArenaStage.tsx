"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  LogOut,
  ShieldAlert,
  X,
  Mic,
  MicOff,
  Send,
  Volume2,
  Video,
  UserCircle,
} from "lucide-react";

/* ═══════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════ */
type AiState = "idle" | "listening" | "thinking" | "speaking";
type VoiceGender = "male" | "female";

interface TranscriptEntry {
  sender: "ai" | "user";
  text: string;
}

interface MediaChunk {
  index: number;
  type: "video" | "audio";
  url: string;
}

interface StateConfig {
  readonly label: string;
  readonly color: string;
  readonly glowColor: string;
  readonly ringColor: string;
  readonly bgGlow: string;
  readonly pulseScale: readonly [number, number];
  readonly pulseDuration: number;
  readonly outerRingScale: readonly [number, number];
  readonly outerRingOpacity: readonly [number, number];
  readonly innerShadow: string;
}

const STATE_CONFIG: Record<AiState, StateConfig> = {
  idle: {
    label: "Bağlantı Bekleniyor...",
    color: "rgb(148, 163, 184)",
    glowColor: "rgba(148, 163, 184, 0.1)",
    ringColor: "rgba(148, 163, 184, 0.06)",
    bgGlow: "rgba(148, 163, 184, 0.02)",
    pulseScale: [1, 1.02],
    pulseDuration: 4,
    outerRingScale: [1, 1.2],
    outerRingOpacity: [0.2, 0],
    innerShadow:
      "0 0 40px 8px rgba(148,163,184,0.08), 0 0 80px 30px rgba(148,163,184,0.04)",
  },
  listening: {
    label: "BlindHire Dinliyor...",
    color: "rgb(34, 211, 238)",
    glowColor: "rgba(34, 211, 238, 0.15)",
    ringColor: "rgba(34, 211, 238, 0.08)",
    bgGlow: "rgba(34, 211, 238, 0.04)",
    pulseScale: [1, 1.05],
    pulseDuration: 3,
    outerRingScale: [1, 1.3],
    outerRingOpacity: [0.3, 0],
    innerShadow:
      "0 0 60px 10px rgba(34,211,238,0.12), 0 0 120px 40px rgba(34,211,238,0.06)",
  },
  thinking: {
    label: "BlindHire Düşünüyor...",
    color: "rgb(168, 85, 247)",
    glowColor: "rgba(168, 85, 247, 0.18)",
    ringColor: "rgba(168, 85, 247, 0.1)",
    bgGlow: "rgba(168, 85, 247, 0.04)",
    pulseScale: [0.95, 1.08],
    pulseDuration: 1.2,
    outerRingScale: [1, 1.5],
    outerRingOpacity: [0.4, 0],
    innerShadow:
      "0 0 80px 15px rgba(168,85,247,0.15), 0 0 160px 50px rgba(168,85,247,0.07)",
  },
  speaking: {
    label: "BlindHire Konuşuyor...",
    color: "rgb(52, 211, 153)",
    glowColor: "rgba(52, 211, 153, 0.15)",
    ringColor: "rgba(52, 211, 153, 0.08)",
    bgGlow: "rgba(52, 211, 153, 0.04)",
    pulseScale: [0.97, 1.1],
    pulseDuration: 0.8,
    outerRingScale: [1, 1.4],
    outerRingOpacity: [0.35, 0],
    innerShadow:
      "0 0 70px 12px rgba(52,211,153,0.14), 0 0 140px 45px rgba(52,211,153,0.06)",
  },
} as const;


function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
export default function ArenaStage({ interviewId }: { interviewId: string }): React.JSX.Element {
  // ── State ──
  const [aiState, setAiState] = useState<AiState>("idle");
  const [timeLeft, setTimeLeft] = useState<number>(1800);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [proctorAlert, setProctorAlert] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [interviewStarted, setInterviewStarted] = useState<boolean>(false);
  const [voiceGender, setVoiceGender] = useState<VoiceGender>("male");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [currentAiText, setCurrentAiText] = useState<string>("");
  const [textInput, setTextInput] = useState<string>("");
  const [interviewState, setInterviewState] = useState<string>("");
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false); // start active by default

  // ── Refs ──
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const proctorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaQueueRef = useRef<MediaChunk[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const transcriptsRef = useRef<Record<number, string>>({});
  const userVolumeBarRef = useRef<HTMLDivElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const ignoreNextAudioRef = useRef<boolean>(false);

  // ── Countdown timer ──
  useEffect(() => {
    if (!interviewStarted) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [interviewStarted]);

  // ── Auto-scroll transcript ──
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // ── Cleanup proctor timeout ──
  useEffect(() => {
    return () => {
      if (proctorTimeout.current) clearTimeout(proctorTimeout.current);
    };
  }, []);

  // ── Media Queue Player ──
  const playNextInQueue = useCallback(() => {
    if (isPlayingRef.current || mediaQueueRef.current.length === 0) return;

    // Sıraya göre sırala
    mediaQueueRef.current.sort((a, b) => a.index - b.index);
    const next = mediaQueueRef.current.shift();
    if (!next) return;

    isPlayingRef.current = true;
    setAiState("speaking");

    if (transcriptsRef.current[next.index]) {
      setCurrentAiText(transcriptsRef.current[next.index]);
    } else {
      setCurrentAiText("");
    }

    if (next.type === "video" && videoRef.current) {
      setVideoSrc(next.url);
      videoRef.current.src = next.url;
      videoRef.current.onended = () => {
        isPlayingRef.current = false;
        if (mediaQueueRef.current.length === 0) {
          setAiState("listening");
        }
        playNextInQueue();
      };
      videoRef.current.onerror = () => {
        isPlayingRef.current = false;
        playNextInQueue();
      };
      videoRef.current.play().catch(() => {
        isPlayingRef.current = false;
        playNextInQueue();
      });
    } else if (audioRef.current) {
      audioRef.current.src = next.url;
      audioRef.current.onended = () => {
        isPlayingRef.current = false;
        if (mediaQueueRef.current.length === 0) {
          setAiState("listening");
        }
        playNextInQueue();
      };
      audioRef.current.onerror = () => {
        isPlayingRef.current = false;
        playNextInQueue();
      };
      audioRef.current.play().catch(() => {
        isPlayingRef.current = false;
        playNextInQueue();
      });
    } else {
      isPlayingRef.current = false;
    }
  }, []);

  // ── WebSocket Connection ──
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return wsRef.current;
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//localhost:8000/ws/interview`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setAiState("idle");
    };

    ws.onclose = () => {
      setIsConnected(false);
      setAiState("idle");
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "state":
            setInterviewState(msg.state);
            break;

          case "thinking":
            setAiState("thinking");
            break;

          case "transcript":
            if (msg.index !== undefined) {
              transcriptsRef.current[msg.index] = msg.text;
            }
            setTranscript((prev) => [
              ...prev,
              { sender: "ai", text: msg.text },
            ]);
            break;

          case "user_transcript":
            setTranscript((prev) => [
              ...prev,
              { sender: "user", text: msg.text },
            ]);
            break;

          case "tts_ready":
            mediaQueueRef.current.push({
              index: msg.index,
              type: "audio",
              url: msg.url,
            });
            playNextInQueue();
            break;

          case "video_ready":
            mediaQueueRef.current = mediaQueueRef.current.filter(
              (item) => !(item.index === msg.index && item.type === "audio")
            );
            mediaQueueRef.current.push({
              index: msg.index,
              type: "video",
              url: msg.url,
            });
            playNextInQueue();
            break;

          case "audio_only":
            playNextInQueue();
            break;

          case "scorecard":
            console.log("[Scorecard]", msg.data);
            break;

          case "completed":
            setIsCompleted(true);
            setAiState("idle");
            break;

          case "error":
            console.error("[WS Error]", msg.message);
            break;
        }
      } catch {
        console.error("WS mesaj parse hatası");
      }
    };

    return ws;
  }, [playNextInQueue]);

  // ── Start Interview ──
  const startInterview = useCallback(() => {
    setInterviewStarted(true);
    setAiState("thinking");

    const attemptStart = () => {
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connectWebSocket();
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "start", voice: voiceGender })
        );
      } else {
        setTimeout(attemptStart, 500);
      }
    };
    attemptStart();
  }, [voiceGender, connectWebSocket]);

  // ── Stop Mic Monitoring ──
  const stopMicMonitoring = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      ignoreNextAudioRef.current = true;
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // ── Trigger Speech Interrupt ──
  const triggerInterrupt = useCallback(() => {
    console.log("[Interrupt] AI interrupted by voice activity");
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    isPlayingRef.current = false;
    mediaQueueRef.current = [];
    setVideoSrc("");

    // Stop current recording chunk to discard it (since it has AI speech/background noise)
    ignoreNextAudioRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      // Start a clean candidate speech chunk
      setTimeout(() => {
        if (micStreamRef.current && !isMicMuted) {
          audioChunksRef.current = [];
          mediaRecorderRef.current?.start();
        }
      }, 150);
    }

    setAiState("listening");

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "text",
          data: "[Aday konuşarak araya girdi]",
          interrupted: true,
          unfinished: currentAiText,
        })
      );
    }
  }, [currentAiText, isMicMuted]);

  // ── Start Mic Monitoring with Web Audio VAD ──
  const startMicMonitoring = useCallback(async () => {
    try {
      if (micStreamRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (ignoreNextAudioRef.current) {
          ignoreNextAudioRef.current = false;
          audioChunksRef.current = [];
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        audioChunksRef.current = [];

        if (audioBlob.size < 50) return;

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({ type: "audio", data: base64 })
            );
            setAiState("thinking");
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Web Audio VAD setup
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let silenceStart = Date.now();
      let speechStart = 0;
      let speakingDetected = false;

      const checkVolume = () => {
        if (!micStreamRef.current || isMicMuted) return;

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        if (userVolumeBarRef.current) {
          userVolumeBarRef.current.style.width = `${Math.min((average / 50) * 100, 100)}%`;
        }

        // If average volume exceeds 18, user is talking
        if (average > 18) {
          silenceStart = Date.now();

          if (isPlayingRef.current || aiState === "speaking") {
            // Hoparlörden gelen AI sesinin mikrofon tarafından duyulup 
            // sürekli interrupt atmasını (yankı döngüsü) engellemek için 
            // sesli interrupt'ı devre dışı bırakıyoruz. Aday "Lafını Böl" butonunu kullanabilir.
            return; 
          }

          if (!speakingDetected) {
            speakingDetected = true;
            speechStart = Date.now();
            setAiState("listening");
          } else {
            // Force stop chunk if continuous speech exceeds 15 seconds
            if (Date.now() - speechStart > 15000) {
              speakingDetected = false;
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
                setTimeout(() => {
                  if (micStreamRef.current && !isMicMuted && mediaRecorderRef.current?.state === "inactive") {
                    audioChunksRef.current = [];
                    mediaRecorderRef.current.start();
                  }
                }, 100);
              }
            }
          }
        } else {
          // Silence detection (5 seconds)
          if (speakingDetected && (Date.now() - silenceStart > 5000)) {
            speakingDetected = false;
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
              mediaRecorderRef.current.stop();
              setTimeout(() => {
                if (micStreamRef.current && !isMicMuted && mediaRecorderRef.current?.state === "inactive") {
                  audioChunksRef.current = [];
                  mediaRecorderRef.current.start();
                }
              }, 100);
            }
          }
        }

        requestAnimationFrame(checkVolume);
      };

      requestAnimationFrame(checkVolume);
    } catch (err) {
      console.error("Mikrofon izleme hatası:", err);
      setIsMicMuted(true);
    }
  }, [isMicMuted, aiState, triggerInterrupt]);

  // ── Effect: Continuous Monitoring Trigger ──
  useEffect(() => {
    if (interviewStarted && !isMicMuted) {
      startMicMonitoring();
    } else {
      stopMicMonitoring();
    }
    return () => {
      stopMicMonitoring();
    };
  }, [interviewStarted, isMicMuted, startMicMonitoring, stopMicMonitoring]);

  // ── Push-to-Talk Controls (when Mic is Muted) ──
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (ignoreNextAudioRef.current) {
          ignoreNextAudioRef.current = false;
          audioChunksRef.current = [];
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        audioChunksRef.current = [];

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({ type: "audio", data: base64 })
            );
            setAiState("thinking");
          }
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setAiState("listening");
    } catch (err) {
      console.error("Mikrofon erişim hatası:", err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  // ── Manual Interrupt Control ──
  const handleManualInterrupt = useCallback(() => {
    console.log("[Interrupt] AI manually interrupted");
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    isPlayingRef.current = false;
    mediaQueueRef.current = [];
    setVideoSrc("");

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      ignoreNextAudioRef.current = true;
      mediaRecorderRef.current.stop();
    }

    setAiState("listening");

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "text",
          data: "[Aday araya girdi]",
          interrupted: true,
          unfinished: currentAiText,
        })
      );
    }

    if (isMicMuted) {
      setTimeout(() => {
        startRecording();
      }, 200);
    }
  }, [currentAiText, isMicMuted, startRecording]);

  // ── Send Text (fallback) ──
  const sendText = useCallback(() => {
    if (!textInput.trim() || !wsRef.current) return;
    if (wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(
      JSON.stringify({ type: "text", data: textInput.trim() })
    );
    setTranscript((prev) => [
      ...prev,
      { sender: "user", text: textInput.trim() },
    ]);
    setTextInput("");
    setAiState("thinking");
  }, [textInput]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      stopMicMonitoring();
    };
  }, [stopMicMonitoring]);

  const config = STATE_CONFIG[aiState];

  /* ═══════════════════════════════════════════════════
     PRE-INTERVIEW: Ses seçimi ve başlatma ekranı
     ═══════════════════════════════════════════════════ */
  if (!interviewStarted) {
    return (
      <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-[#030306]">
        {/* Background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 flex flex-col items-center gap-8"
        >
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-theme-1/20 to-theme-2/20 border border-white/[0.06]">
              <UserCircle className="h-7 w-7 text-theme-1" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white/90">BlindHire</h1>
              <p className="text-xs text-white/30">Otonom Teknik Mülakat Sistemi</p>
            </div>
          </div>

          {/* Card */}
          <div className="w-[420px] rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 backdrop-blur-xl">
            <h2 className="text-center text-lg font-semibold text-white/80 mb-6">
              Mülakata Başlamadan Önce
            </h2>

            {/* Voice Selection */}
            <div className="mb-6">
              <p className="text-sm text-white/40 mb-3">AI Mülakatçı Sesini Seçin</p>
              <div className="grid grid-cols-2 gap-3">
                {(["male", "female"] as VoiceGender[]).map((gender) => (
                  <button
                    key={gender}
                    type="button"
                    onClick={() => setVoiceGender(gender)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-300 ${
                      voiceGender === gender
                        ? "border-theme-1/30 bg-theme-1/[0.08] text-theme-1 shadow-[0_0_15px_rgba(var(--theme-1-rgb),0.1)]"
                        : "border-white/[0.06] bg-white/[0.02] text-white/40 hover:border-white/[0.1] hover:text-white/60"
                    }`}
                  >
                    <Volume2 className="h-6 w-6" />
                    <span className="text-sm font-medium">
                      {gender === "male" ? "Erkek Ses" : "Kadın Ses"}
                    </span>
                    <span className="text-[10px] opacity-60">
                      {gender === "male" ? "Ahmet" : "Emel"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="mb-6 rounded-lg border border-white/[0.04] bg-white/[0.01] p-3 space-y-3">
              <p className="text-[11px] leading-relaxed text-white/40">
                Bu mülakat tamamen anonimdir. İsminizi veya çalıştığınız kurumları paylaşmayınız. 
                Sadece teknik yetkinliğiniz değerlendirilecektir.
              </p>
              <div className="text-[11px] text-white/30">
                <p className="font-semibold text-white/40 mb-1">Mülakat Aşamaları:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Deneyim ve Geçmiş</li>
                  <li>Temel Kavramlar</li>
                  <li>Sistem Tasarımı & Mimari</li>
                  <li>Pratik Senaryo Çözümü</li>
                </ul>
              </div>
              <div className="text-[11px] text-red-400/90 mt-3 border-t border-white/[0.04] pt-3 bg-red-500/[0.02] p-2 rounded-lg">
                <p className="font-semibold text-red-500 mb-1 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Güvenlik ve Gözetim (Proctoring):
                </p>
                <ul className="list-disc pl-4 space-y-0.5 opacity-90">
                  <li>Odadaki farklı sesler ve konuşmalar anlık analiz edilir.</li>
                  <li>Göz takibi (Eye-tracking) ile ekrandan uzaklaşma veya başka yere bakma tespit edilir.</li>
                  <li>Kopya çekme veya dışarıdan yardım alma girişimleri mülakatı sonlandırabilir.</li>
                </ul>
              </div>
            </div>

            {/* Start Button */}
            <button
              type="button"
              onClick={() => {
                connectWebSocket();
                setTimeout(() => startInterview(), 500);
              }}
              className="w-full rounded-xl bg-gradient-to-r from-theme-1 to-theme-2 text-black py-3 text-sm font-bold transition-all duration-300 hover:brightness-110 shadow-lg shadow-theme-1/20"
            >
              Mülakatı Başlat
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════
     INTERVIEW: Ana mülakat ekranı
     ═══════════════════════════════════════════════════ */
  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#030306]">
      {/* Hidden media elements */}
      <audio ref={audioRef} className="hidden" />

      {/* Ambient background glow */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        animate={{ backgroundColor: config.bgGlow }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* ══════════════════════════════════════════════════
          HEADER
         ══════════════════════════════════════════════════ */}
      <header className="relative z-20 flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
        {/* Left — Session label */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                  isConnected ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  isConnected ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
            </span>
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                isConnected ? "text-emerald-400/70" : "text-red-400/70"
              }`}
            >
              {isConnected ? "live" : "offline"}
            </span>
          </div>
          <span className="text-sm font-medium text-white/40">
            BlindHire
          </span>

        </div>

        {/* Center — Timer */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span
            className={`font-mono text-lg font-bold tracking-wider ${
              timeLeft <= 60
                ? "text-red-400 animate-pulse"
                : "text-red-500/70"
            }`}
          >
            {formatTime(timeLeft)}
          </span>
        </div>

        {/* Right — End session */}
        <button
          onClick={() => setShowExitConfirm(true)}
          className="group flex items-center gap-2 rounded-lg border border-red-500/10 px-4 py-2 text-xs font-semibold text-red-400/60 transition-all duration-300 hover:border-red-500/30 hover:bg-red-500/[0.06] hover:text-red-400"
        >
          <LogOut className="h-3.5 w-3.5" />
          Mülakatı Bitir
        </button>
      </header>

      {/* ══════════════════════════════════════════════════
          CENTERPIECE — AI AVATAR / VISUALIZER
         ══════════════════════════════════════════════════ */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        <div className="relative flex flex-col items-center gap-10">
          {/* Avatar / Orb container */}
          <div className="relative">
            {/* Outer expanding rings */}
            <motion.div
              className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ border: `1.5px solid ${config.ringColor}` }}
              animate={{
                scale: config.outerRingScale as unknown as number[],
                opacity: config.outerRingOpacity as unknown as number[],
              }}
              transition={{
                duration: config.pulseDuration * 1.5,
                repeat: Infinity,
                ease: "easeOut",
              }}
              key={`ring1-${aiState}`}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ border: `1px solid ${config.ringColor}` }}
              animate={{
                scale: config.outerRingScale as unknown as number[],
                opacity: config.outerRingOpacity as unknown as number[],
              }}
              transition={{
                duration: config.pulseDuration * 1.5,
                repeat: Infinity,
                ease: "easeOut",
                delay: config.pulseDuration * 0.5,
              }}
              key={`ring2-${aiState}`}
            />

            {/* Third ring for thinking state */}
            {aiState === "thinking" && (
              <motion.div
                className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ border: `1px solid ${config.ringColor}` }}
                animate={{ scale: [1, 1.6], opacity: [0.3, 0] }}
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: 0.3,
                }}
              />
            )}

            {/* Main orb with avatar */}
            <motion.div
              className="relative h-52 w-52 rounded-full overflow-hidden"
              animate={{
                scale: config.pulseScale as unknown as number[],
                boxShadow: config.innerShadow,
              }}
              transition={{
                scale: {
                  duration: config.pulseDuration,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                },
                boxShadow: { duration: 1.2, ease: "easeInOut" },
              }}
              key={`orb-${aiState}`}
            >
              {/* AI Avatar Video (Lip-Sync) */}
              <video
                ref={videoRef}
                playsInline
                className={`absolute inset-0 h-full w-full object-cover rounded-full ${
                  videoSrc && aiState === "speaking" ? "block" : "hidden"
                }`}
              />

              {/* Static Avatar Image Fallback */}
              <img
                src={`/static/avatar_${voiceGender}.png`}
                alt="AI Avatar"
                className={`absolute inset-0 h-full w-full object-cover rounded-full ${
                  videoSrc && aiState === "speaking" ? "hidden" : "block"
                }`}
                style={{
                  filter:
                    aiState === "thinking"
                      ? "brightness(0.7) saturate(0.8)"
                      : "brightness(0.9)",
                }}
              />

              {/* Gradient overlay */}
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{
                  background: `radial-gradient(circle at 40% 35%, ${config.glowColor} 0%, transparent 60%)`,
                }}
                transition={{ duration: 1, ease: "easeInOut" }}
              />

              {/* Spinning highlight for thinking */}
              {aiState === "thinking" && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      "conic-gradient(from 0deg, transparent 0%, rgba(168,85,247,0.15) 25%, transparent 50%)",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              )}

              {/* Waveform bars for speaking */}
              {aiState === "speaking" && (
                <div className="absolute inset-0 flex items-end justify-center gap-[4px] pb-4">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-[3px] rounded-full bg-emerald-400/60"
                      animate={{
                        height: [
                          "8px",
                          `${14 + Math.random() * 24}px`,
                          "8px",
                        ],
                      }}
                      transition={{
                        duration: 0.5 + Math.random() * 0.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.06,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Center dot for listening */}
              {aiState === "listening" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    className="rounded-full bg-cyan-400/30"
                    animate={{
                      width: ["8px", "14px", "8px"],
                      height: ["8px", "14px", "8px"],
                      opacity: [0.3, 0.7, 0.3],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              )}
            </motion.div>
          </div>

          {/* State label */}
          <AnimatePresence mode="wait">
            <motion.p
              key={aiState}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="text-sm font-medium tracking-wide"
              style={{ color: config.color, opacity: 0.7 }}
            >
              {config.label}
            </motion.p>
          </AnimatePresence>

          {/* Current AI text and Interrupt button */}
          <AnimatePresence>
            {showTranscript && aiState === "speaking" && currentAiText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 max-w-lg"
              >
                <div className="rounded-xl border border-theme-1/10 bg-black/60 px-5 py-3 backdrop-blur-xl">
                  <p className="text-center text-sm font-medium tracking-wide leading-relaxed text-white/90">
                    {currentAiText}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          BOTTOM BAR
         ══════════════════════════════════════════════════ */}
        {/* Bottom controls */}
        <div className="flex items-center justify-center gap-3 border-t border-white/[0.04] px-6 py-4">
          {/* Transcript toggle */}
          <button
            type="button"
            onClick={() => setShowTranscript((prev) => !prev)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all duration-300 ${
              showTranscript
                ? "border border-theme-1/40 bg-theme-1/[0.15] text-theme-1 shadow-[0_0_15px_rgba(var(--theme-1-rgb),0.2)]"
                : "border border-white/[0.06] bg-white/[0.02] text-white/30 hover:border-white/[0.1] hover:bg-white/[0.04] hover:text-white/50"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Transkript
          </button>

          {/* User volume visualizer */}
          <div className="flex h-[38px] flex-1 items-center rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 max-w-sm">
            <div className="flex items-center gap-3 w-full">
              <Mic className="h-4 w-4 text-white/30" />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  ref={userVolumeBarRef}
                  className="h-full bg-gradient-to-r from-theme-1 to-theme-2 transition-all duration-75"
                  style={{ width: "0%" }}
                />
              </div>
            </div>
          </div>
        </div>

      {/* ══════════════════════════════════════════════════
          PROCTOR ALERT OVERLAY
         ══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {proctorAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="fixed left-1/2 top-6 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2"
          >
            <div className="relative overflow-hidden rounded-xl border border-red-500/20 bg-red-950/80 px-5 py-4 shadow-2xl shadow-red-500/10 backdrop-blur-xl">
              <motion.div
                className="absolute left-0 top-0 h-[2px] bg-gradient-to-r from-red-500 via-orange-500 to-red-500"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 3, ease: "linear" }}
              />
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15">
                  <ShieldAlert className="h-4 w-4 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-red-400">
                    ⚠️ Uyarı: Şüpheli Davranış Algılandı
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-red-300/60">
                    Lütfen ekrana odaklanın. Şüpheli göz teması kaybı algılandı.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setProctorAlert(false)}
                  className="shrink-0 rounded-md p-1 text-red-400/40 transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════
          EXIT CONFIRM OVERLAY
         ══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                  <LogOut className="h-5 w-5 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">Mülakatı Bitir</h3>
              </div>
              <p className="mb-6 text-sm text-white/60">
                Mülakatı bitirmek istediğinize emin misiniz? Bu işlem geri alınamaz ve mülakat anında sonlandırılır.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5 transition-all"
                >
                  İptal
                </button>
                <button
                  onClick={() => window.location.href = "/"}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Evet, Çıkış Yap
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════
          COMPLETED OVERLAY
         ══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isCompleted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-[400px] rounded-2xl border border-white/[0.08] bg-[#0a0a12] p-8 text-center"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <svg
                  className="h-8 w-8 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white/90 mb-2">
                Mülakat Tamamlandı
              </h3>
              <p className="text-sm text-white/40 mb-6">
                Katılımınız için teşekkür ederiz. Değerlendirme süreciniz
                başlamıştır.
              </p>
              <Link
                href="/"
                className="inline-block rounded-xl bg-gradient-to-r from-theme-1 to-theme-2 px-8 py-3 text-sm font-bold text-black transition-all hover:brightness-110 shadow-lg shadow-theme-1/20"
              >
                Ana Sayfaya Dön
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
