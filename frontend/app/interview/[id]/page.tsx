"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, LogOut, ShieldAlert, X, Lock, ArrowRight, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

const PreflightStage = dynamic(() => import("./PreflightStage"), { ssr: false });
const ArenaStage = dynamic(() => import("./ArenaStage"), { ssr: false });

type Stage = "password" | "preflight" | "arena";

type AiState = "listening" | "thinking" | "speaking";

const AI_STATES: readonly AiState[] = ["listening", "thinking", "speaking"] as const;

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
    innerShadow: "0 0 60px 10px rgba(34,211,238,0.12), 0 0 120px 40px rgba(34,211,238,0.06)",
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
    innerShadow: "0 0 80px 15px rgba(168,85,247,0.15), 0 0 160px 50px rgba(168,85,247,0.07)",
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
    innerShadow: "0 0 70px 12px rgba(52,211,153,0.14), 0 0 140px 45px rgba(52,211,153,0.06)",
  },
} as const;

const MOCK_TRANSCRIPT_LINES: readonly string[] = [
  "BlindHire: Merhaba, mülakata hoş geldiniz.",
  "BlindHire: Özgeçmişinizi inceledim, deneyimleriniz oldukça etkileyici.",
  "BlindHire: Size teknik becerilerinizle ilgili birkaç sorum olacak.",
  "BlindHire: Hazırsanız başlayalım.",
] as const;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function InterviewPage({ params }: { params: Promise<{ id: string }> }): React.JSX.Element {
  const resolvedParams = use(params);
  const interviewId = resolvedParams.id;
  const router = useRouter();

  // ── Auth State ──
  const [stage, setStage] = useState<Stage>("password");
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [authError, setAuthError] = useState("");

  const [aiState, setAiState] = useState<AiState>("listening");
  const [timeLeft, setTimeLeft] = useState<number>(900);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [proctorAlert, setProctorAlert] = useState<boolean>(false);
  const proctorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setIsVerifying(true);
    setAuthError("");
    try {
      const res = await fetch("/api/interview/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: interviewId, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.message || "Geçersiz şifre.");
      } else {
        setStage("preflight");
      }
    } catch (error) {
      setAuthError("Bir hata oluştu.");
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Countdown timer ──
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Keyboard controls (demo) ──
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setAiState((prev) => {
          const idx = AI_STATES.indexOf(prev);
          return AI_STATES[(idx + 1) % AI_STATES.length];
        });
      }

      if (e.key === "p" || e.key === "P") {
        if (proctorTimeout.current) clearTimeout(proctorTimeout.current);
        setProctorAlert(true);
        proctorTimeout.current = setTimeout(() => {
          setProctorAlert(false);
          proctorTimeout.current = null;
        }, 3000);
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Cleanup proctor timeout
  useEffect(() => {
    return () => {
      if (proctorTimeout.current) clearTimeout(proctorTimeout.current);
    };
  }, []);

  const config = STATE_CONFIG[aiState];
  const transcriptLine = MOCK_TRANSCRIPT_LINES[AI_STATES.indexOf(aiState) % MOCK_TRANSCRIPT_LINES.length];

  if (stage === "password") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#030306] px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 shadow-2xl backdrop-blur-xl"
        >
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-theme-1/20 to-theme-3/20 ring-1 ring-white/[0.1]">
              <Lock className="h-6 w-6 text-theme-1/90" />
            </div>
            <h2 className="mb-2 text-2xl font-bold tracking-tight text-white">
              Mülakata Giriş
            </h2>
            <p className="text-sm text-white/50">
              Devam etmek için e-posta adresinize gönderilen mülakat şifresini girin.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/70">Şifre</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Örn: X7A9K2"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-theme-1/50 focus:bg-theme-1/5 focus:outline-none focus:ring-4 focus:ring-theme-1/10"
              />
            </div>
            {authError && (
              <p className="flex items-center gap-1.5 text-xs text-red-500">
                <ShieldAlert className="h-3.5 w-3.5" />
                {authError}
              </p>
            )}
            <button
              type="submit"
              disabled={isVerifying || !password}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-theme-1 px-4 py-3 text-sm font-bold text-black transition-all hover:bg-theme-1/90 disabled:opacity-50"
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Mülakata Başla
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (stage === "preflight") {
    return <PreflightStage onReady={() => setStage("arena")} />;
  }

  return <ArenaStage interviewId={interviewId} />;
}
