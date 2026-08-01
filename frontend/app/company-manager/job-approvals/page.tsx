"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Briefcase, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";

/** Strip HTML tags and decode common entities */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim();
}

interface Job {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

export default function JobApprovalsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPendingJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/company-manager/job-approvals");
      if (!response.ok) throw new Error("Onay bekleyen ilanlar yüklenemedi.");
      const json = await response.json();
      setJobs(json.jobs || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPendingJobs();
  }, [fetchPendingJobs]);

  const handleAction = async (jobId: string, action: "APPROVE" | "REJECT") => {
    if (action === "REJECT" && !confirm("Bu ilanı reddetmek istediğinize emin misiniz? (Reddedilen ilanlar yayınlanmaz)")) {
      return;
    }
    
    setActionLoading(`${action}_${jobId}`);
    setError("");
    setSuccess("");
    
    try {
      const res = await fetch("/api/company-manager/job-approvals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, action })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || "İşlem başarısız.");
      
      setSuccess(data.message);
      // Remove from list or refresh
      void fetchPendingJobs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-theme-1" />
        <p className="text-sm text-zinc-400">İlanlar yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="border-b border-white/[0.06] pb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Briefcase className="w-7 h-7 text-theme-1" />
          İlan Onayları
        </h1>
        <p className="text-zinc-400 mt-2">İnsan Kaynakları ekibinin yayınlamak istediği ilanları buradan inceleyip onaylayabilirsiniz.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-200">{success}</p>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#111]/50 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/5 mb-4">
            <CheckCircle2 className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-white">Bekleyen İlan Yok</h3>
          <p className="mt-1 text-sm text-zinc-400">Şu anda onayınızı bekleyen herhangi bir ilan bulunmuyor.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-[#222] bg-[#111] p-6 shadow-xl flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-white">{job.title}</h3>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    Onay Bekliyor
                  </span>
                </div>
                <div className="text-sm text-zinc-400 line-clamp-3">
                  {stripHtml(job.description)}
                </div>
                <div className="text-xs text-zinc-500">
                  Oluşturulma: {new Date(job.createdAt).toLocaleString("tr-TR")}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => handleAction(job.id, "REJECT")}
                  disabled={actionLoading !== null}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#222] hover:bg-red-500/10 text-white hover:text-red-400 transition-colors disabled:opacity-50 text-sm font-medium border border-transparent hover:border-red-500/20"
                >
                  {actionLoading === `REJECT_${job.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Reddet
                </button>
                <button
                  onClick={() => handleAction(job.id, "APPROVE")}
                  disabled={actionLoading !== null}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-theme-1 text-black hover:bg-theme-1/90 transition-colors disabled:opacity-50 text-sm font-semibold"
                >
                  {actionLoading === `APPROVE_${job.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Yayınla
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
