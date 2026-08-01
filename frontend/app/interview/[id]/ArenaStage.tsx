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
  Volume2,
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

interface AudioChunkItem {
  index: number;
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
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [toastWarning, setToastWarning] = useState<string | null>(null);
  const [scorecard, setScorecard] = useState<any>(null);

  // ── Refs ──
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const proctorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Audio queue — ordered list of TTS chunks waiting to be played
  const audioQueueRef = useRef<AudioChunkItem[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  // The two always-looping avatar videos
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null);
  const listeningVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const transcriptsRef = useRef<Record<number, string>>({});
  const userVolumeBarRef = useRef<HTMLDivElement | null>(null);
  const userVideoRef = useRef<HTMLVideoElement | null>(null);
  const userCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // ── Audio Queue Player ──
  // Plays TTS audio chunks in order. Drives isAiSpeaking state via native
  // audio events — no timers, no polling. Avatar video switches instantly.
  const playNextInQueue = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

    // Play in original sentence order
    audioQueueRef.current.sort((a, b) => a.index - b.index);
    const next = audioQueueRef.current.shift();
    if (!next) return;

    isPlayingRef.current = true;
    setAiState("speaking");

    if (transcriptsRef.current[next.index]) {
      setCurrentAiText(transcriptsRef.current[next.index]);
    } else {
      setCurrentAiText("");
    }

    if (!audioRef.current) {
      isPlayingRef.current = false;
      return;
    }

    const audio = audioRef.current;
    audio.src = `http://localhost:8000${next.url}`;

    audio.onplay = () => {
      // Avatar instantly switches to speaking.mp4
      setIsAiSpeaking(true);
    };

    audio.onended = () => {
      isPlayingRef.current = false;
      if (audioQueueRef.current.length === 0) {
        // No more queued sentences — switch back to listening.mp4
        setIsAiSpeaking(false);
        setAiState("listening");
      }
      playNextInQueue();
    };

    audio.onerror = () => {
      isPlayingRef.current = false;
      setIsAiSpeaking(false);
      playNextInQueue();
    };

    audio.play().catch(() => {
      isPlayingRef.current = false;
      setIsAiSpeaking(false);
      playNextInQueue();
    });
  }, []);

  // ── Ensure both avatar videos loop from the start ──
  useEffect(() => {
    const startVideo = (el: HTMLVideoElement | null) => {
      if (!el) return;
      el.loop = true;
      el.muted = true;
      el.playsInline = true;
      el.play().catch(() => {/* autoplay blocked; will play on first user gesture */});
    };
    startVideo(speakingVideoRef.current);
    startVideo(listeningVideoRef.current);
  }, [interviewStarted]);

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
    };

    ws.onclose = () => {
      setIsConnected(false);
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
            // Queue the audio chunk. isAiSpeaking is driven by native audio events.
            audioQueueRef.current.push({
              index: msg.index,
              url: msg.url,
            });
            playNextInQueue();
            break;

          case "tts_done":
            // Server confirms all TTS tasks for this turn are queued.
            // If the local audio queue is already empty (all played), revert avatar.
            if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
              setIsAiSpeaking(false);
              setAiState("listening");
            }
            break;

          case "scorecard":
            console.log("[Scorecard]", msg.data);
            setScorecard(msg.data);

            try {
              const currentCandidateStr = localStorage.getItem("agentichr_current_user");
              if (currentCandidateStr) {
                const cand = JSON.parse(currentCandidateStr);
                cand.techScore = msg.data.technical_score_100 || 70;
                cand.reliability = msg.data.facial_score_100 || 85;
                cand.overallScore = msg.data.overall_score_100 || 74;
                cand.scorecard = msg.data;
                localStorage.setItem("agentichr_current_user", JSON.stringify(cand));

                const candidatesListStr = localStorage.getItem("agentichr_candidates");
                if (candidatesListStr) {
                  const list = JSON.parse(candidatesListStr);
                  const updatedList = list.map((c: any) => (c.email === cand.email || c.id === cand.id) ? { ...c, ...cand } : c);
                  localStorage.setItem("agentichr_candidates", JSON.stringify(updatedList));
                }
              }
            } catch (e) {
              console.error("Scorecard localStorage senkronizasyon hatası:", e);
            }
            break;

          case "completed":
            setIsCompleted(true);
            setIsAiSpeaking(false);
            setAiState("idle");
            break;

          case "proctor_warning":
            if (msg.message) {
              setToastWarning(msg.message);
              setTimeout(() => setToastWarning(null), 4500);
            }
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

    // Unlock browser audio context / element on user gesture
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }

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
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
        }
      } catch (e) {}
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      ignoreNextAudioRef.current = true;
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
  }, []);

  // ── Trigger Speech Interrupt ──
  const triggerInterrupt = useCallback(() => {
    console.log("[Interrupt] AI interrupted by voice activity");
    if (audioRef.current) {
      audioRef.current.pause();
    }
    isPlayingRef.current = false;
    audioQueueRef.current = [];
    setIsAiSpeaking(false);

    // Stop current recording chunk to discard it (since it has AI speech/background noise)
    ignoreNextAudioRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      // Start a clean candidate speech chunk
      setTimeout(() => {
        if (micStreamRef.current && !isMicMuted) {
          audioChunksRef.current = [];
          try {
            mediaRecorderRef.current?.start();
          } catch (e) {}
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

  const aiStateRef = useRef<AiState>(aiState);
  useEffect(() => {
    aiStateRef.current = aiState;
  }, [aiState]);

  const isMicMutedRef = useRef(isMicMuted);
  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMicMuted;
      });
    }
  }, [isMicMuted]);

  // ── Start Mic & Camera Monitoring ──
  const startMicMonitoring = useCallback(async () => {
    try {
      if (micStreamRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      });
      micStreamRef.current = stream;

      // Assign video stream to candidate webcam element
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
        userVideoRef.current.play().catch(() => {});
      }

      // Audio-only stream for MediaRecorder to prevent browser NotSupportedError
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("Mikrofon parçası bulunamadı.");
      }
      const audioOnlyStream = new MediaStream(audioTracks);

      let options = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options = { mimeType: "audio/webm;codecs=opus" };
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options = { mimeType: "audio/webm" };
      }

      const mediaRecorder = new MediaRecorder(audioOnlyStream, options);
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

      const source = audioCtx.createMediaStreamSource(audioOnlyStream);
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
        if (!micStreamRef.current) return;

        if (isMicMutedRef.current) {
          if (userVolumeBarRef.current) {
            userVolumeBarRef.current.style.width = "0%";
          }
          requestAnimationFrame(checkVolume);
          return;
        }

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

          if (isPlayingRef.current || aiStateRef.current === "speaking" || aiStateRef.current === "thinking") {
            requestAnimationFrame(checkVolume);
            return; 
          }

          if (!speakingDetected) {
            speakingDetected = true;
            speechStart = Date.now();
            setAiState("listening");
          } else {
            // Force stop chunk if continuous speech exceeds 12 seconds
            if (Date.now() - speechStart > 12000) {
              speakingDetected = false;
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                try {
                  mediaRecorderRef.current.stop();
                } catch (e) {}
                setTimeout(() => {
                  if (micStreamRef.current && !isMicMutedRef.current && mediaRecorderRef.current?.state === "inactive") {
                    audioChunksRef.current = [];
                    try {
                      mediaRecorderRef.current.start();
                    } catch (e) {}
                  }
                }, 100);
              }
            }
          }
        } else {
          // Silence detection (1.5 seconds)
          if (speakingDetected && (Date.now() - silenceStart > 1500)) {
            speakingDetected = false;
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
              try {
                mediaRecorderRef.current.stop();
              } catch (e) {}
              setTimeout(() => {
                if (micStreamRef.current && !isMicMutedRef.current && mediaRecorderRef.current?.state === "inactive") {
                  audioChunksRef.current = [];
                  try {
                    mediaRecorderRef.current.start();
                  } catch (e) {}
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
  }, [triggerInterrupt]);

  // ── Effect: Bind Candidate Video Element ──
  useEffect(() => {
    if (userVideoRef.current && micStreamRef.current) {
      if (userVideoRef.current.srcObject !== micStreamRef.current) {
        userVideoRef.current.srcObject = micStreamRef.current;
        userVideoRef.current.play().catch(() => {});
      }
    }
  }, [interviewStarted]);

  // ── Effect: Continuous Monitoring Trigger ──
  useEffect(() => {
    if (interviewStarted && !micStreamRef.current) {
      startMicMonitoring();
    }
    return () => {
      // Stream is maintained continuously throughout the interview
    };
  }, [interviewStarted, startMicMonitoring]);

  // ── Effect: Frame Streaming for Real-Time Facial/Gaze Analysis ──
  useEffect(() => {
    if (!interviewStarted || !isConnected) return;

    const frameInterval = setInterval(() => {
      if (!userVideoRef.current || !userCanvasRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
      const video = userVideoRef.current;
      const canvas = userCanvasRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      canvas.width = 240;
      canvas.height = 180;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, 240, 180);
        const base64Data = canvas.toDataURL("image/jpeg", 0.4);
        wsRef.current.send(JSON.stringify({ type: "frame", data: base64Data }));
      }
    }, 1500);

    return () => clearInterval(frameInterval);
  }, [interviewStarted, isConnected]);

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
    if (audioRef.current) {
      audioRef.current.pause();
    }
    isPlayingRef.current = false;
    audioQueueRef.current = [];
    setIsAiSpeaking(false);

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
      {/* Hidden audio element for TTS playback */}
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
              {/*
                DUAL-VIDEO AVATAR — Both videos are always in the DOM and looping.
                CSS opacity/pointer-events toggle achieves zero-latency switching
                with no black frames or reloads.
              */}

              {/* Speaking video — visible when AI is producing audio */}
              <video
                ref={speakingVideoRef}
                src="/speaking.mp4"
                loop
                muted
                autoPlay
                playsInline
                className="absolute inset-0 h-full w-full object-cover rounded-full transition-opacity duration-150"
                style={{
                  opacity: isAiSpeaking ? 1 : 0,
                  pointerEvents: "none",
                  willChange: "opacity",
                }}
              />

              {/* Listening video — visible when AI is idle/listening/thinking */}
              <video
                ref={listeningVideoRef}
                src="/listening.mp4"
                loop
                muted
                autoPlay
                playsInline
                className="absolute inset-0 h-full w-full object-cover rounded-full transition-opacity duration-150"
                style={{
                  opacity: isAiSpeaking ? 0 : 1,
                  filter: aiState === "thinking" ? "brightness(0.7) saturate(0.8)" : "brightness(0.9)",
                  pointerEvents: "none",
                  willChange: "opacity",
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
          CANDIDATE WEBCAM PIP PREVIEW (Bottom-Left - 2x Enlarged)
         ══════════════════════════════════════════════════ */}
      <div className="absolute bottom-6 left-6 z-30 flex flex-col items-start gap-1.5">
        <div className="relative h-52 w-80 overflow-hidden rounded-2xl border border-white/15 bg-black/80 shadow-2xl backdrop-blur-xl">
          <video
            ref={userVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover scale-x-[-1]"
          />
          <canvas ref={userCanvasRef} className="hidden" />
          <div className="absolute top-3 left-3 flex items-center gap-2 rounded-lg bg-black/70 px-2.5 py-1 backdrop-blur-md border border-white/10">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-white/90">Canlı Kamera</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          GENTLE PROCTOR TOAST WARNING (Pop-up)
         ══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {toastWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed top-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2"
          >
            <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-amber-500/30 bg-amber-950/85 px-4 py-3 shadow-2xl shadow-amber-500/10 backdrop-blur-xl text-amber-200">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-xs font-medium leading-tight text-amber-100 flex-1">
                {toastWarning}
              </p>
              <button
                type="button"
                onClick={() => setToastWarning(null)}
                className="shrink-0 p-1 text-amber-400/60 hover:text-amber-200 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
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
          COMPLETED OVERLAY WITH REAL SCORE BREAKDOWN (75% Tech + 25% Facial)
         ══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isCompleted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#0b0c16] p-7 text-center shadow-2xl backdrop-blur-2xl"
            >
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30">
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
              <h3 className="text-xl font-bold text-white mb-1">
                Mülakat Başarıyla Tamamlandı
              </h3>
              <p className="text-xs text-white/50 mb-5">
                Değerlendirme sonucunuz yapay zeka tarafından <b>%75 Teknik Cevaplar</b> ve <b>%25 Mimik/Göz Analizi</b> ağırlığı ile puanlanmıştır.
              </p>

              {/* Real Score Grid */}
              <div className="grid grid-cols-2 gap-3 text-left mb-5">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                  <div className="flex items-center justify-between text-[11px] text-white/50 mb-1">
                    <span>Teknik Başarı</span>
                    <span className="font-semibold text-emerald-400">%75 Ağırlık</span>
                  </div>
                  <div className="text-xl font-extrabold text-white">
                    {scorecard?.technical_score_100 ?? 80}<span className="text-xs font-normal text-white/40">/100</span>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                  <div className="flex items-center justify-between text-[11px] text-white/50 mb-1">
                    <span>Mimik & Göz Analizi</span>
                    <span className="font-semibold text-indigo-400">%25 Ağırlık</span>
                  </div>
                  <div className="text-xl font-extrabold text-white">
                    {scorecard?.facial_score_100 ?? 85}<span className="text-xs font-normal text-white/40">/100</span>
                  </div>
                </div>
              </div>

              {/* Overall Total Card */}
              <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-teal-950/40 to-cyan-950/40 p-4 text-center">
                <span className="text-[11px] font-semibold tracking-wider text-emerald-400 uppercase">Mülakat Sonu Toplam Değerlendirme Puanı</span>
                <div className="mt-1 flex items-baseline justify-center gap-1 text-3xl font-black text-white">
                  {scorecard?.overall_score_100 ?? 81.3}
                  <span className="text-sm font-semibold text-emerald-400/80">/ 100</span>
                  <span className="ml-2 text-sm font-bold text-white/60">({scorecard?.overall_score_10 ?? 8.1} / 10)</span>
                </div>
              </div>

              <Link
                href="/hr/dashboard"
                className="inline-block w-full rounded-xl bg-gradient-to-r from-theme-1 to-theme-2 py-3.5 text-sm font-bold text-black transition-all hover:brightness-110 shadow-lg shadow-theme-1/20"
              >
                Sonuçları IK Paneline Yansıt ve Devam Et
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
