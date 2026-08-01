"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AppLogo } from "@/components/AppLogo";
import { useToast } from "@/components/ToastContext";
import {
  LogIn,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
  X,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

export default function CandidateLoginPage(): React.JSX.Element {
  return (
    <Suspense fallback={<div className="flex-1 w-full flex items-center justify-center text-white">Yükleniyor...</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect");
  const { addToast } = useToast();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // ── Password Reset Modal States ──
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [resetStep, setResetStep] = useState<"email" | "code_password">("email");
  const [resetEmail, setResetEmail] = useState<string>("");
  const [resetCode, setResetCode] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [isSendingCode, setIsSendingCode] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [devCodeNotice, setDevCodeNotice] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // Hardcoded Super Admin login check
    if (email === "admin" && password === "admin") {
      const cookieOpts = rememberMe ? "; Max-Age=2592000" : "";
      document.cookie = `auth_token=authenticated; path=/; SameSite=Lax${cookieOpts}`;
      document.cookie = `user_role=SUPER_ADMIN; path=/; SameSite=Lax${cookieOpts}`;
      document.cookie = `user_name=Admin; path=/; SameSite=Lax${cookieOpts}`;
      document.cookie = `company_name=Sistem Yönetimi; path=/; SameSite=Lax${cookieOpts}`;
      
      addToast("Oturum açıldı. Hoş geldiniz, Sistem Yöneticisi.", "success");
      router.push("/admin");
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.message || "E-posta veya şifre hatalı.");
        } else {
          throw new Error("Sunucu ile bağlantı kurulamadı.");
        }
      }

      const data = await response.json();

      const cookieOpts = rememberMe ? "; Max-Age=2592000" : "";
      // Set auth cookies from successful login
      document.cookie = `auth_token=authenticated; path=/; SameSite=Lax${cookieOpts}`;
      document.cookie = `user_role=${data.role}; path=/; SameSite=Lax${cookieOpts}`;
      if (data.id) document.cookie = `user_id=${data.id}; path=/; SameSite=Lax${cookieOpts}`;
      if (data.fullName) document.cookie = `user_name=${encodeURIComponent(data.fullName)}; path=/; SameSite=Lax${cookieOpts}`;
      if (data.email) document.cookie = `user_email=${encodeURIComponent(data.email)}; path=/; SameSite=Lax${cookieOpts}`;
      if (data.companyName) document.cookie = `company_name=${encodeURIComponent(data.companyName)}; path=/; SameSite=Lax${cookieOpts}`;

      addToast(`Giriş başarılı. Hoş geldiniz, ${data.fullName || "Kullanıcı"}!`, "success");

      if (redirectPath) {
        router.push(redirectPath);
      } else if (data.role === "SUPER_ADMIN") {
        router.push("/admin");
      } else if (data.role === "COMPANY_MANAGER") {
        router.push("/company-manager/dashboard");
      } else if (data.role === "HR") {
        router.push("/hr/dashboard");
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "E-posta veya şifre hatalı.", "error");
      setIsLoading(false);
    }
  };

  // ── Handle Request Reset Code ──
  const handleSendResetCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;

    setIsSendingCode(true);
    setDevCodeNotice(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Kod gönderilirken bir hata oluştu.");
      }

      addToast(data.message || "Doğrulama kodu e-posta adresinize gönderildi.", "info");
      
      if (data.devCode) {
        setDevCodeNotice(data.devCode);
        setResetCode(data.devCode); // Auto-fill demo code for effortless testing
      }

      setResetStep("code_password");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Bir hata oluştu.", "error");
    } finally {
      setIsSendingCode(false);
    }
  };

  // ── Handle Reset Password Confirm ──
  const handleConfirmPasswordReset = async (e: FormEvent) => {
    e.preventDefault();

    if (!resetCode || resetCode.length < 6) {
      addToast("Lütfen 6 haneli doğrulama kodunu giriniz.", "error");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      addToast("Yeni şifre en az 6 karakter olmalıdır.", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast("Şifreler eşleşmiyor. Lütfen tekrar kontrol edin.", "error");
      return;
    }

    setIsResetting(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail,
          code: resetCode,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Şifre sıfırlanamadı.");
      }

      addToast(data.message || "Şifreniz başarıyla sıfırlandı!", "success");

      // Auto fill form with updated email & password
      setEmail(resetEmail);
      setPassword(newPassword);

      // Close modal
      setIsResetModalOpen(false);
      setResetStep("email");
      setResetEmail("");
      setResetCode("");
      setNewPassword("");
      setConfirmPassword("");
      setDevCodeNotice(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Bir hata oluştu.", "error");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden px-4 min-h-screen py-10">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="flex flex-col items-center gap-4 mb-8"
          >
            <AppLogo className="w-16 h-16 drop-shadow-[0_0_15px_var(--theme-c1)] mb-2 ml-1.5" />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Giriş Yap
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                Sisteme erişmek için kimlik bilgilerinizi girin
              </p>
            </div>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Kullanıcı Adı veya E-posta
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@email.com veya admin"
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.015] border border-white/[0.06] text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-theme-1/30 focus:border-theme-1/30 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Şifre
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.015] border border-white/[0.06] text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-theme-1/30 focus:border-theme-1/30 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/[0.1] bg-white/[0.02] text-theme-1 focus:ring-theme-1/30 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="rememberMe" className="ml-2 text-sm text-zinc-400 cursor-pointer select-none">
                  Beni Hatırla
                </label>
              </div>

              {/* Forgot Password Link */}
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setIsResetModalOpen(true);
                }}
                className="text-xs font-semibold text-theme-1 hover:text-theme-1/80 transition-colors flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Şifremi Unuttum?
              </button>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.4 }}
            >
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-gradient-to-r from-theme-1 to-theme-2 hover:from-theme-1 hover:to-theme-2 text-black font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-theme-1/20"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  <>
                    Giriş Yap
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.div>
          </form>

          {/* Register Link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="mt-6 text-center"
          >
            <p className="text-sm text-zinc-500">
              Hesabınız yok mu?{" "}
              <Link
                href="/register"
                className="text-theme-1 hover:text-theme-1 font-medium transition-colors"
              >
                Kayıt Olun
              </Link>
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* ────────────────────────────────────────────────────────── */}
      {/*  SECURE PASSWORD RESET MODAL                             */}
      {/* ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsResetModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 shadow-2xl shadow-black/80"
            >
              {/* Header with Close */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-theme-1/10 text-theme-1 border border-theme-1/20">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      Şifre Sıfırlama
                    </h2>
                    <p className="text-xs text-zinc-400">
                      {resetStep === "email"
                        ? "E-posta adresinize 6 haneli doğrulama kodu gönderilecektir."
                        : "Doğrulama kodunu ve yeni şifrenizi girin."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* STEP 1: Enter Email */}
              {resetStep === "email" ? (
                <form onSubmit={handleSendResetCode} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Kayıtlı E-Posta Adresiniz
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="ornek@email.com"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-theme-1/50 focus:ring-1 focus:ring-theme-1/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsResetModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingCode || !resetEmail}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-theme-1 hover:bg-theme-1/90 text-black font-bold text-xs transition-all disabled:opacity-50"
                    >
                      {isSendingCode ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Kod Gönderiliyor...
                        </>
                      ) : (
                        <>
                          Doğrulama Kodu Gönder
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* STEP 2: Enter Code & Set New Password */
                <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
                  {/* Dev Code Notice Banner */}
                  {devCodeNotice && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs text-emerald-200">
                          Doğrulama Kodu: <strong className="font-mono text-white text-sm tracking-wider">{devCodeNotice}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-400/80 bg-emerald-500/20 px-2 py-0.5 rounded-md font-semibold">
                        Hazır Dolduruldu
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      6 Haneli Doğrulama Kodu
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        maxLength={6}
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white font-mono text-center tracking-[0.4em] text-base placeholder:text-zinc-600 placeholder:tracking-normal focus:outline-none focus:border-theme-1/50 focus:ring-1 focus:ring-theme-1/50 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Yeni Şifre
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="En az 6 karakter"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-theme-1/50 focus:ring-1 focus:ring-theme-1/50 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Yeni Şifre (Tekrar)
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Şifreyi onaylayın"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-theme-1/50 focus:ring-1 focus:ring-theme-1/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setResetStep("email")}
                      className="text-xs font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Tekrar Kod İste
                    </button>

                    <button
                      type="submit"
                      disabled={isResetting || !resetCode || !newPassword}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-theme-1 to-theme-2 text-black font-bold text-xs transition-all hover:brightness-110 disabled:opacity-50"
                    >
                      {isResetting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Güncelleniyor...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Şifreyi Güncelle
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
