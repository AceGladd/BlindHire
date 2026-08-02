"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Wifi, Mic, Video, Volume2, CheckCircle2, Play, ShieldCheck, User, Activity } from "lucide-react";
import * as faceapi from "@vladmandic/face-api";

export interface PreflightChecks {
  internet: boolean;
  microphone: boolean;
  camera: boolean;
  faceVisible: boolean;
  audio: boolean;
  audioClarity: boolean;
}

const AUDIO_THRESHOLD = 40;

export default function PreflightStage({
  onReady,
}: {
  readonly onReady: () => void;
}): React.JSX.Element {
  const [checks, setChecks] = useState<PreflightChecks>({
    internet: false,
    microphone: false,
    camera: false,
    faceVisible: false,
    audio: false,
    audioClarity: false,
  });
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [streamError, setStreamError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);
  const requestingPermissionRef = useRef<boolean>(false);

  const allPassed = checks.internet && checks.microphone && checks.camera && checks.audio && checks.faceVisible && checks.audioClarity;

  // Mock internet check
  useEffect(() => {
    const timer = setTimeout(() => {
      setChecks((prev) => ({ ...prev, internet: true }));
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const modelsLoadedRef = useRef(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        modelsLoadedRef.current = true;
      } catch (err) {
        console.error("Yüz tanıma modelleri yüklenemedi:", err);
      }
    };
    void loadModels();
  }, []);

  // Request permissions
  const handlePermission = useCallback(async () => {
    // getUserMedia asenkron olduğu için tek başına bir state kontrolü yeterli
    // değil — buton hızlıca iki kez tıklanırsa (veya benzeri bir çift tetikleme
    // olursa) ikinci çağrı da ilk çağrı dönmeden önce başlayıp ikinci bir
    // kamera/mikrofon akışı açabilir. Senkron bir bayrak bunu engeller.
    if (requestingPermissionRef.current) return;
    requestingPermissionRef.current = true;
    try {
      setStreamError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      setPermissionGranted(true);

      // The video element is rendered conditionally based on permissionGranted.
      // We will assign the srcObject in a useEffect to ensure it is mounted.

      // Check camera
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.readyState === "live") {
        setChecks((prev) => ({ ...prev, camera: true }));
      }

      // Check microphone track exists
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack && audioTrack.readyState === "live") {
        setChecks((prev) => ({ ...prev, microphone: true }));
      }

      // Setup audio analysis
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      let goodAudioFrames = 0;

      const detectAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(average);
        
        if (average > AUDIO_THRESHOLD) {
          setChecks((prev) => ({ ...prev, audio: true }));
          goodAudioFrames++;
          if (goodAudioFrames > 30) { // Approx 0.5s of accumulated speech peaks
            setChecks((prev) => ({ ...prev, audioClarity: true }));
          }
        }
        
        animFrameRef.current = requestAnimationFrame(detectAudio);
      };
      animFrameRef.current = requestAnimationFrame(detectAudio);

      // Setup Face API detection loop
      let isDetecting = true;
      const detectFace = async () => {
        if (!isDetecting) return;
        if (videoRef.current && videoRef.current.readyState >= 2 && modelsLoadedRef.current) {
          try {
            // Increased scoreThreshold to 0.65 to require better lighting/clarity
            const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.65 }));
            if (detections.length === 1) {
              const box = detections[0].box;
              const faceArea = box.width * box.height;
              // Minimum face size (approx 100x100 pixels) to ensure they are visible but not too strict
              if (faceArea < 10000) {
                setChecks((prev) => ({ ...prev, faceVisible: false }));
                setStreamError("Lütfen kameraya biraz daha yaklaşın (Yüzünüz çok küçük algılandı).");
              } else {
                setChecks((prev) => ({ ...prev, faceVisible: true }));
                setStreamError(null);
              }
            } else if (detections.length > 1) {
              setChecks((prev) => ({ ...prev, faceVisible: false }));
              setStreamError("Güvenlik Uyarısı: Kamerada birden fazla kişi tespit edildi!");
            } else {
              setChecks((prev) => ({ ...prev, faceVisible: false }));
              setStreamError("Kamerada yüzünüz net olarak tespit edilemedi. Lütfen ışığı kontrol edin.");
            }
          } catch (e) {
            console.error(e);
          }
        }
        setTimeout(detectFace, 1000);
      };

      const waitForModels = setInterval(() => {
        if (modelsLoadedRef.current) {
          clearInterval(waitForModels);
          detectFace();
        }
      }, 500);

      // Cleanup face detection loop on unmount hook
      return () => {
        isDetecting = false;
        clearInterval(waitForModels);
      };

    } catch (err: any) {
      requestingPermissionRef.current = false;
      if (err.name === "NotAllowedError") {
        setStreamError("Kamera ve mikrofon erişimi reddedildi. Lütfen tarayıcı izinlerini kontrol edip tekrar deneyin.");
      } else if (err.name === "NotFoundError") {
        setStreamError("Sisteme bağlı bir kamera veya mikrofon bulunamadı. Lütfen donanımınızı kontrol edin.");
      } else {
        setStreamError("Donanım erişiminde bir hata oluştu: " + err.message);
      }
    }
  }, []);

  // Assign stream to video once it is mounted
  useEffect(() => {
    if (permissionGranted && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [permissionGranted]);

  // Cleanup on unmount or transition
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleStart = useCallback(() => {
    // Stop streams before transitioning
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) {
      void audioContextRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    onReady();
  }, [onReady]);

  const checkItems: {
    key: keyof PreflightChecks;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { key: "internet", label: "İnternet Bağlantısı", icon: <Wifi className="h-4 w-4" /> },
    { key: "microphone", label: "Mikrofon Donanımı", icon: <Mic className="h-4 w-4" /> },
    { key: "camera", label: "Kamera Bağlantısı", icon: <Video className="h-4 w-4" /> },
    { key: "faceVisible", label: "Yüz Netliği (AI Analizi)", icon: <User className="h-4 w-4" /> },
    { key: "audio", label: "Ortam Sesi Eşiği", icon: <Volume2 className="h-4 w-4" /> },
    { key: "audioClarity", label: "Ses Netliği (AI Analizi)", icon: <Activity className="h-4 w-4" /> },
  ];

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-theme-1/[0.05] blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-theme-3/[0.05] blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-theme-1/20 to-theme-3/20 ring-1 ring-white/[0.1]">
            <ShieldCheck className="h-6 w-6 text-theme-1/90" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Ön Uçuş Kontrolü
          </h1>
          <p className="mt-2 text-sm text-white/35">
            Mülakata başlamadan önce cihazlarınızı test edin.
          </p>
        </motion.div>

        {/* Two-column layout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid gap-6 md:grid-cols-2"
        >
          {/* Left ΓÇö Video feed */}
          <div className="rounded-2xl border border-white/[0.05] bg-black/20 backdrop-blur-md p-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border-2 border-white/[0.05] bg-black/30">
              {permissionGranted ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                  <Video className="h-10 w-10 text-white/10" />
                  <p className="text-xs text-white/20">
                    Kamera Önizlemesi
                  </p>
                </div>
              )}

              {/* Live badge */}
              {permissionGranted && (
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-red-400/70">
                    live
                  </span>
                </div>
              )}
            </div>

            {/* Permission button */}
            {!permissionGranted && (
              <button
                type="button"
                onClick={handlePermission}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-theme-1 to-theme-3 px-6 py-3 text-sm font-bold text-black shadow-lg shadow-theme-1/15 transition-all duration-300 hover:shadow-theme-1/25 hover:brightness-110"
              >
                <span className="flex items-center justify-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  İzin Ver
                </span>
              </button>
            )}

            {streamError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/15 bg-red-500/[0.04] p-3"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400/70" />
                <p className="text-[11px] leading-relaxed text-red-400/70">
                  {streamError}
                </p>
              </motion.div>
            )}
          </div>

          {/* Right ΓÇö Checks */}
          <div className="flex flex-col gap-4">
            <div className="flex-1 rounded-2xl border border-white/[0.05] bg-black/20 backdrop-blur-md p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/30">
                Sistem Kontrolleri
              </p>

              <div className="flex flex-col gap-3">
                {checkItems.map((item) => (
                  <div
                    key={item.key}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-500 ${
                      checks[item.key]
                        ? "border-theme-1/15 bg-theme-1/[0.04]"
                        : "border-white/[0.04] bg-white/[0.015]"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-500 ${
                        checks[item.key]
                          ? "bg-theme-1/15 text-theme-1"
                          : "bg-white/[0.04] text-white/20"
                      }`}
                    >
                      {checks[item.key] ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        item.icon
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium transition-colors duration-500 ${
                          checks[item.key] ? "text-theme-1" : "text-white/50"
                        }`}
                      >
                        {item.label}
                      </p>
                      {item.key === "audio" && permissionGranted && !checks.audio && (
                        <p className="mt-0.5 text-[10px] text-white/20">
                          Konuşarak mikrofonu test edin...
                        </p>
                      )}
                    </div>
                    {checks[item.key] && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-[10px] font-semibold text-theme-1/60"
                      >
                        TAMAM
                      </motion.span>
                    )}
                  </div>
                ))}
              </div>

              {/* Volume meter */}
              {permissionGranted && (
                <div className="mt-5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-white/25">
                      Mikrofon Seviyesi
                    </span>
                    <span className="font-mono text-[10px] text-white/15">
                      {Math.round(audioLevel)}/255
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.04]">
                    <motion.div
                      className={`h-full rounded-full transition-colors duration-200 ${
                        audioLevel > AUDIO_THRESHOLD
                          ? "bg-gradient-to-r from-theme-1 to-theme-2"
                          : "bg-gradient-to-r from-theme-1 to-theme-3"
                      }`}
                      animate={{ width: `${Math.min((audioLevel / 80) * 100, 100)}%` }}
                      transition={{ duration: 0.05, ease: "linear" }}
                    />
                  </div>
                  {!checks.audio && permissionGranted && (
                    <p className="mt-1.5 text-[10px] text-white/15">
                      Eşik değeri: {AUDIO_THRESHOLD} ΓÇö Mevcut: {Math.round(audioLevel)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Start button */}
            <button
              type="button"
              disabled={!allPassed}
              onClick={handleStart}
              className={`w-full rounded-xl px-6 py-4 text-sm font-semibold transition-all duration-300 ${
                allPassed
                  ? "bg-gradient-to-r from-theme-1 to-theme-2 text-black shadow-lg shadow-theme-1/15 hover:shadow-theme-1/25 hover:brightness-110"
                  : "cursor-not-allowed border border-white/[0.05] bg-black/20 text-white/15"
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <Play className="h-4 w-4" />
                {allPassed ? "Mülakata Başla" : "Tüm kontroller bekleniyor..."}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </main>
  );
}