"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Users, Plus, Loader2, Trash2, Mail, User, Key, CheckCircle2, AlertTriangle, Shield, Settings, Save, Brain } from "lucide-react";
import { useRouter } from "next/navigation";

interface DualSliderProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  val1: number;
  val2: number;
  onChange: (v1: number, v2: number) => void;
  leftLabel: string;
  middleLabel: string;
  rightLabel: string;
  leftColor: string;
  middleColor: string;
  rightColor: string;
}

function DualRangeSlider({
  label, description, icon, min, max, val1, val2, onChange, leftLabel, middleLabel, rightLabel, leftColor, middleColor, rightColor
}: DualSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<"thumb1" | "thumb2" | null>(null);

  const getPercentage = (value: number) => ((value - min) / (max - min)) * 100;

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = x / rect.width;
    let newValue = Math.round(min + percent * (max - min));

    if (isDragging === "thumb1") {
      newValue = Math.min(newValue, val2 - 1);
      onChange(newValue, val2);
    } else {
      newValue = Math.max(newValue, val1 + 1);
      onChange(val1, newValue);
    }
  }, [isDragging, min, max, val1, val2, onChange]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => setIsDragging(null);
    if (isDragging) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, handleMove]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h4 className="text-white font-semibold">{label}</h4>
          <p className="text-sm text-zinc-500">{description}</p>
        </div>
      </div>
      <div className="relative h-2 w-full bg-zinc-800 rounded-full mt-4" ref={trackRef}>
        <div className={`absolute top-0 bottom-0 left-0 rounded-l-full ${leftColor}`} style={{ width: `${getPercentage(val1)}%` }} />
        <div className={`absolute top-0 bottom-0 ${middleColor}`} style={{ left: `${getPercentage(val1)}%`, right: `${100 - getPercentage(val2)}%` }} />
        <div className={`absolute top-0 bottom-0 right-0 rounded-r-full ${rightColor}`} style={{ left: `${getPercentage(val2)}%` }} />
        <div className="absolute top-1/2 -mt-2.5 -ml-2.5 h-5 w-5 bg-white rounded-full shadow cursor-grab active:cursor-grabbing z-10" style={{ left: `${getPercentage(val1)}%` }} onMouseDown={(e) => { e.preventDefault(); setIsDragging("thumb1"); }} />
        <div className="absolute top-1/2 -mt-2.5 -ml-2.5 h-5 w-5 bg-white rounded-full shadow cursor-grab active:cursor-grabbing z-10" style={{ left: `${getPercentage(val2)}%` }} onMouseDown={(e) => { e.preventDefault(); setIsDragging("thumb2"); }} />
      </div>
      <div className="flex justify-between text-xs text-zinc-400 mt-1">
        <div className="flex items-center gap-1"><div className={`w-2 h-2 rounded-full ${leftColor}`} />{leftLabel} (&lt; {val1})</div>
        <div className="flex items-center gap-1"><div className={`w-2 h-2 rounded-full ${middleColor}`} />{middleLabel} ({val1} - {val2})</div>
        <div className="flex items-center gap-1"><div className={`w-2 h-2 rounded-full ${rightColor}`} />{rightLabel} (&gt;= {val2})</div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // HR Form
  const [hrName, setHrName] = useState("");
  const [hrEmail, setHrEmail] = useState("");
  const [hrPassword, setHrPassword] = useState("");

  // Settings
  const [s1Reject, setS1Reject] = useState<number>(50);
  const [s1Proceed, setS1Proceed] = useState<number>(75);
  const [s2Reject, setS2Reject] = useState<number>(60);
  const [s2Invite, setS2Invite] = useState<number>(75);
  const [s3Reject, setS3Reject] = useState<number>(50);
  const [s3Proceed, setS3Proceed] = useState<number>(75);
  const [s4Reject, setS4Reject] = useState<number>(50);
  const [s4Hire, setS4Hire] = useState<number>(80);
  
  const [autoApproveJobs, setAutoApproveJobs] = useState<boolean>(true);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/company-manager/dashboard");
      if (!response.ok) throw new Error("Veriler yüklenemedi.");
      const json = await response.json();
      setData(json);

      if (json.settings) {
        setS1Reject(json.settings.stage1AutoRejectThreshold);
        setS1Proceed(json.settings.stage1AutoProceedThreshold);
        setS2Reject(json.settings.stage2AutoRejectThreshold);
        setS2Invite(json.settings.stage2AutoInviteThreshold);
        setS3Reject(json.settings.stage3AutoRejectThreshold);
        setS3Proceed(json.settings.stage3AutoProceedThreshold);
        setS4Reject(json.settings.stage4AutoRejectThreshold);
        setS4Hire(json.settings.stage4AutoHireThreshold);
        setAutoApproveJobs(json.settings.autoApproveJobs ?? true);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const handleAddHRUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hrName.trim() || !hrEmail.trim() || !hrPassword.trim()) {
      setError("Lütfen tüm alanları doldurun.");
      return;
    }
    setActionLoading("add_hr");
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/company-manager/hr-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: hrName, email: hrEmail, password: hrPassword }),
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.message || "İK kullanıcısı oluşturulamadı.");
      setSuccess("İK kullanıcısı başarıyla oluşturuldu.");
      setHrName(""); setHrEmail(""); setHrPassword("");
      void fetchDashboardData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteHRUser = async (id: string) => {
    if (!confirm("Bu İK kullanıcısını silmek istediğinize emin misiniz?")) return;
    setActionLoading(`delete_hr_${id}`);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/company-manager/hr-users?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json()).message || "Kullanıcı silinemedi.");
      setSuccess("İK kullanıcısı silindi.");
      void fetchDashboardData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveSettings = async () => {
    setActionLoading("save_settings");
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/company-manager/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage1AutoProceedThreshold: s1Proceed,
          stage1AutoRejectThreshold: s1Reject,
          stage2AutoInviteThreshold: s2Invite,
          stage2AutoRejectThreshold: s2Reject,
          stage3AutoProceedThreshold: s3Proceed,
          stage3AutoRejectThreshold: s3Reject,
          stage4AutoHireThreshold: s4Hire,
          stage4AutoRejectThreshold: s4Reject,
          autoApproveJobs
        })
      });
      if (!res.ok) throw new Error("Ayarlar kaydedilemedi.");
      setSuccess("Ayarlar başarıyla güncellendi.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-theme-1 animate-spin" />
        <p className="text-zinc-400 font-medium">Ayarlar yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="border-b border-white/[0.06] pb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Settings className="w-7 h-7 text-theme-1" />
          Firma Ayarları
        </h1>
        <p className="text-zinc-400 mt-2">İK yönetimi ve sistemin otomatik süreç barajlarını ayarlayın.</p>
      </div>

      <div className="min-h-[72px]">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in fade-in">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 animate-in fade-in">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-200">{success}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: HR Management */}
        <div className="lg:col-span-4 space-y-8">
          <div className="rounded-2xl border border-[#222] bg-[#111] shadow-xl overflow-hidden">
            <div className="p-6 border-b border-white/[0.04]">
              <h2 className="text-xl font-bold text-white mb-1">İK Kullanıcısı Ekle</h2>
            </div>
            <form onSubmit={handleAddHRUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase">Ad Soyad</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input type="text" value={hrName} onChange={(e) => setHrName(e.target.value)} required className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0a0a0a] border border-[#333] text-white focus:ring-1 focus:ring-theme-1 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase">E-posta</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input type="email" value={hrEmail} onChange={(e) => setHrEmail(e.target.value)} required className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0a0a0a] border border-[#333] text-white focus:ring-1 focus:ring-theme-1 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase">Şifre</label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input type="password" value={hrPassword} onChange={(e) => setHrPassword(e.target.value)} required className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0a0a0a] border border-[#333] text-white focus:ring-1 focus:ring-theme-1 outline-none" />
                </div>
              </div>
              <button type="submit" disabled={actionLoading === "add_hr"} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-theme-1 text-black font-semibold mt-4">
                {actionLoading === "add_hr" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Ekle</>}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-[#222] bg-[#111] p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-theme-1" />
              Kayıtlı İK Yetkilileri
            </h3>
            {data.hrUsers.length === 0 ? (
              <p className="text-sm text-zinc-500">Kayıtlı İK bulunamadı.</p>
            ) : (
              <div className="divide-y divide-[#222]">
                {data.hrUsers.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-semibold text-white">{u.fullName}</p>
                      <p className="text-sm text-zinc-400">{u.email}</p>
                    </div>
                    <button onClick={() => handleDeleteHRUser(u.id)} className="text-zinc-500 hover:text-red-500 p-2">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Settings */}
        <div className="lg:col-span-8 space-y-8">
          <div className="rounded-2xl border border-[#222] bg-[#111] shadow-xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white">Sistem Ayarları</h2>
                <p className="text-zinc-400 text-sm mt-1">İlan onayları ve otomasyon sınırları.</p>
              </div>
              <button onClick={handleSaveSettings} disabled={actionLoading === "save_settings"} className="flex items-center justify-center gap-2 bg-theme-1 hover:bg-theme-1/90 text-black px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50">
                {actionLoading === "save_settings" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Ayarları Kaydet
              </button>
            </div>

            <div className="space-y-8">
              {/* Auto Approve Job Toggle */}
              <div className="flex items-center justify-between p-5 rounded-xl border border-white/[0.04] bg-[#0a0a0a]">
                <div>
                  <h3 className="font-semibold text-white">İK İlanlarını Otomatik Onayla</h3>
                  <p className="text-sm text-zinc-400">Bu ayar açıksa İK'nın açtığı ilanlar doğrudan yayına alınır. Kapalıysa manuel onayınız gerekir.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={autoApproveJobs} onChange={(e) => setAutoApproveJobs(e.target.checked)} />
                  <div className="w-11 h-6 bg-[#222] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-1"></div>
                </label>
              </div>

              {/* Sliders */}
              <div className="rounded-xl border border-white/[0.04] bg-[#0a0a0a] p-6">
                <DualRangeSlider 
                  label="Aşama 1: Yerel ATS Algoritması" description="CV tarama aşaması aksiyonları."
                  icon={<Shield className="w-5 h-5 text-theme-1" />} min={0} max={100}
                  val1={s1Reject} val2={s1Proceed} onChange={(v1, v2) => { setS1Reject(v1); setS1Proceed(v2); }}
                  leftLabel="Otomatik Ret" middleLabel="İK İncelemesi" rightLabel="Otomatik İleri"
                  leftColor="bg-red-500" middleColor="bg-yellow-500" rightColor="bg-green-500"
                />
              </div>

              <div className="rounded-xl border border-white/[0.04] bg-[#0a0a0a] p-6">
                <DualRangeSlider 
                  label="Aşama 2: CV LLM Derin Analizi" description="Yapay zeka CV analiz puanı aksiyonları."
                  icon={<Brain className="w-5 h-5 text-theme-1" />} min={0} max={100}
                  val1={s2Reject} val2={s2Invite} onChange={(v1, v2) => { setS2Reject(v1); setS2Invite(v2); }}
                  leftLabel="Otomatik Ret" middleLabel="İK İncelemesi" rightLabel="Mülakata Davet"
                  leftColor="bg-red-500" middleColor="bg-yellow-500" rightColor="bg-blue-500"
                />
              </div>

              <div className="rounded-xl border border-white/[0.04] bg-[#0a0a0a] p-6">
                <DualRangeSlider 
                  label="Aşama 3: Mülakat Değerlendirmesi" description="Mülakat performansı aksiyonları."
                  icon={<Shield className="w-5 h-5 text-theme-1" />} min={0} max={100}
                  val1={s3Reject} val2={s3Proceed} onChange={(v1, v2) => { setS3Reject(v1); setS3Proceed(v2); }}
                  leftLabel="Otomatik Ret" middleLabel="İK İncelemesi" rightLabel="Genel Onay"
                  leftColor="bg-red-500" middleColor="bg-yellow-500" rightColor="bg-orange-500"
                />
              </div>

              <div className="rounded-xl border border-white/[0.04] bg-[#0a0a0a] p-6">
                <DualRangeSlider 
                  label="Aşama 4: Genel Karar" description="İşe alım kararı aksiyonları."
                  icon={<CheckCircle2 className="w-5 h-5 text-theme-1" />} min={0} max={100}
                  val1={s4Reject} val2={s4Hire} onChange={(v1, v2) => { setS4Reject(v1); setS4Hire(v2); }}
                  leftLabel="Ret / Arşiv" middleLabel="Bekleme" rightLabel="İşe Alım"
                  leftColor="bg-red-500" middleColor="bg-yellow-500" rightColor="bg-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
