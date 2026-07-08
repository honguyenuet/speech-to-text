import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Mic, Upload, LogOut, Pencil, User, Zap, Languages, ArrowRight, Camera, Check, X, History, AudioLines, Clock, CreditCard, ListTodo, RefreshCw, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import hachiLogo from "@/assets/hachi-logo.png";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

type JobStatus = "queued" | "processing" | "completed" | "failed" | "error";
interface TranscriptionJob {
  id: string;
  assemblyai_id: string;
  status: JobStatus;
  filename: string;
  file_size: number;
  error: string | null;
  transcription_id: number | null;
  queuePosition: number | null;
  created_at: string;
  updated_at: string;
}

const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: "Đang chờ", processing: "Đang xử lý", completed: "Hoàn thành",
  failed: "Thất bại", error: "Thất bại",
};

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatQuotaTime(seconds: number | null) {
  if (seconds === null) return "Không giới hạn";
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes} phút ${rest.toString().padStart(2, "0")} giây`;
}

const SPARKLES = [
  { top: "6%",  left: "18%", delay: 0,   size: "h-1.5 w-1.5" },
  { top: "11%", left: "78%", delay: 0.7, size: "h-1 w-1"     },
  { top: "30%", left: "94%", delay: 1.3, size: "h-1 w-1"     },
  { top: "45%", left: "1%",  delay: 0.4, size: "h-2 w-2"     },
  { top: "60%", left: "96%", delay: 1.8, size: "h-1 w-1"     },
  { top: "72%", left: "5%",  delay: 0.9, size: "h-1.5 w-1.5" },
  { top: "84%", left: "88%", delay: 1.5, size: "h-1 w-1"     },
  { top: "90%", left: "35%", delay: 0.2, size: "h-2 w-2"     },
  { top: "3%",  left: "55%", delay: 1.1, size: "h-1 w-1"     },
  { top: "50%", left: "2%",  delay: 0.6, size: "h-1 w-1"     },
];

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: search.token as string | undefined,
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { token: urlToken } = Route.useSearch();
  const { user, isLoading, token, setToken, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  // ── History state ────────────────────────────────────────────────────
  interface HistoryItem { id: number; filename: string; duration: number | null; text: string; created_at: string; }
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [jobFilter, setJobFilter] = useState<"all" | "active" | "completed" | "failed">("all");
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsRefreshing, setJobsRefreshing] = useState(false);
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);

  useEffect(() => {
    if (!user || !token) return;
    void fetch(`${API_URL}/api/transcribe/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() as Promise<HistoryItem[]> : [])
      .then((data) => setHistory(data.slice(0, 3)));
  }, [user, token]);

  useEffect(() => {
    if (!user || !token) return;
    let cancelled = false;

    async function loadJobs(refreshActive = true) {
      setJobsRefreshing(true);
      try {
        const listRes = await fetch(`${API_URL}/api/transcribe/jobs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!listRes.ok) return;
        let data = (await listRes.json()) as TranscriptionJob[];
        if (refreshActive) {
          const active = data.filter((job) => job.status === "queued" || job.status === "processing");
          if (active.length > 0) {
            await Promise.all(active.map((job) => fetch(`${API_URL}/api/transcribe/jobs/${job.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            })));
            const refreshed = await fetch(`${API_URL}/api/transcribe/jobs`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (refreshed.ok) data = (await refreshed.json()) as TranscriptionJob[];
          }
        }
        if (!cancelled) setJobs(data);
      } finally {
        if (!cancelled) { setJobsLoading(false); setJobsRefreshing(false); }
      }
    }

    void loadJobs();
    const interval = window.setInterval(() => void loadJobs(), 4000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [user, token, jobsRefreshKey]);

  // ── Edit profile state ──────────────────────────────────────────────
  const [editOpen, setEditOpen]               = useState(false);
  const [editForm, setEditForm]               = useState({ firstName: "", lastName: "" });
  const [avatarPreview, setAvatarPreview]     = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar]   = useState(false);
  const [profileError, setProfileError]       = useState("");
  const [profileSuccess, setProfileSuccess]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Xử lý token từ URL (sau OAuth redirect)
  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
      void navigate({ to: "/dashboard", replace: true, search: { token: undefined } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoading && !user && !urlToken) {
      void navigate({ to: "/login", search: { error: undefined, from: undefined } });
    }
  }, [user, isLoading, urlToken, navigate]);

  useEffect(() => {
    if (user) setEditForm({ firstName: user.firstName, lastName: user.lastName });
  }, [user]);

  // ── Handlers ────────────────────────────────────────────────────────
  function handleLogout() { logout(); window.location.href = "/login"; }

  function openEdit() {
    if (user) setEditForm({ firstName: user.firstName, lastName: user.lastName });
    setAvatarPreview(null); setProfileError(""); setProfileSuccess(false); setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false); setAvatarPreview(null); setProfileError(""); setProfileSuccess(false);
  }

  function resizeImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const SIZE = 256;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE; canvas.height = SIZE;
        const ctx = canvas.getContext("2d")!;
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, SIZE, SIZE);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject; img.src = url;
    });
  }

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setProfileError("Vui lòng chọn file ảnh hợp lệ"); return; }
    setProfileError(""); setIsSavingAvatar(true);
    try {
      const base64 = await resizeImage(file);
      setAvatarPreview(base64);
      const res  = await fetch(`${API_URL}/api/auth/avatar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar: base64 }),
      });
      const data = (await res.json()) as { avatar?: string; error?: string };
      if (!res.ok) { setProfileError(data.error ?? "Lỗi khi lưu ảnh"); return; }
      updateUser({ avatar: data.avatar ?? null });
    } catch { setProfileError("Có lỗi xảy ra khi tải ảnh lên"); }
    finally {
      setIsSavingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSaveProfile() {
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      setProfileError("Vui lòng điền đầy đủ họ và tên"); return;
    }
    setProfileError(""); setProfileSuccess(false); setIsSavingProfile(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ firstName: editForm.firstName.trim(), lastName: editForm.lastName.trim() }),
      });
      const data = (await res.json()) as { firstName?: string; lastName?: string; error?: string };
      if (!res.ok) { setProfileError(data.error ?? "Lưu thất bại"); return; }
      updateUser({ firstName: data.firstName, lastName: data.lastName });
      setProfileSuccess(true);
      setTimeout(() => { setProfileSuccess(false); closeEdit(); }, 1200);
    } catch { setProfileError("Có lỗi xảy ra. Vui lòng thử lại."); }
    finally { setIsSavingProfile(false); }
  }

  // ── Loading ──────────────────────────────────────────────────────────
  if (isLoading || (urlToken && !user)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">Đang xử lý đăng nhập...</p>
        </div>
      </div>
    );
  }
  if (!user) return null;

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  const isFreePlan = user.plan === "free";
  const quotaRemaining = user.remainingTranscriptionSeconds ?? 0;
  const filteredJobs = jobs.filter((job) => {
    if (jobFilter === "active") return job.status === "queued" || job.status === "processing";
    if (jobFilter === "completed") return job.status === "completed";
    if (jobFilter === "failed") return job.status === "failed" || job.status === "error";
    return true;
  });
  const activeJobCount = jobs.filter((job) => job.status === "queued" || job.status === "processing").length;

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nền ──────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="absolute top-[8%]  left-[5%]   h-80 w-80 rounded-full bg-primary/15 blur-3xl animate-float pointer-events-none" />
      <div className="absolute bottom-[5%] right-[4%] h-64 w-64 rounded-full bg-primary/10 blur-3xl animate-float pointer-events-none" style={{ animationDelay: "1.6s" }} />
      <div className="absolute top-[50%] left-[65%]  h-48 w-48 rounded-full bg-primary/20 blur-2xl animate-float pointer-events-none" style={{ animationDelay: "0.8s" }} />
      {SPARKLES.map((s, i) => (
        <span key={i} className={`absolute ${s.size} rounded-full bg-primary animate-twinkle pointer-events-none`}
          style={{ top: s.top, left: s.left, animationDelay: `${s.delay}s` }} />
      ))}

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="relative z-30 border-b border-border bg-background/70 backdrop-blur-md">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center">
            <img src={hachiLogo} alt="Hachi" className="h-11 w-auto object-contain sm:h-14" />
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link to="/upload" className="hover:text-foreground transition">Tải file lên</Link>
            <Link to="/record" className="hover:text-foreground transition">Ghi âm</Link>
            <Link to="/upgrade" className="hover:text-foreground transition flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />Nâng cấp
            </Link>
            <Link to="/history" className="hover:text-foreground transition flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />Lịch sử
            </Link>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 hover:bg-card transition focus:outline-none focus:ring-2 focus:ring-primary/50">
                {user.avatar ? (
                  <img src={user.avatar} alt="avatar" className="h-8 w-8 rounded-full object-cover ring-1 ring-primary/40" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground shadow-glow select-none">
                    {initials}
                  </span>
                )}
                <span className="hidden sm:block text-sm font-medium text-foreground max-w-[120px] truncate">
                  {user.firstName} {user.lastName}
                </span>
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border">
              <DropdownMenuLabel className="pb-1">
                <p className="text-sm font-semibold text-foreground">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-muted-foreground font-normal truncate">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer hover:bg-primary/10 focus:bg-primary/10" onSelect={openEdit}>
                <Pencil className="h-4 w-4 text-primary" />
                Chỉnh sửa thông tin
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10" onSelect={handleLogout}>
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">

        {/* Greeting */}
        <div className="mb-8 text-center sm:mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Sẵn sàng chuyển đổi
          </div>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
            Xin chào,{" "}
            <span className="font-display text-primary text-4xl sm:text-5xl md:text-6xl">{user.firstName}!</span>
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">Hôm nay bạn muốn chuyển đổi gì?</p>
        </div>

        {/* Quota */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-card p-5 sm:rounded-3xl sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/15">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">Thời gian chuyển đổi còn lại</h2>
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {isFreePlan ? "Free" : user.plan.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isFreePlan
                    ? "Tài khoản mới có 30 phút chuyển đổi miễn phí."
                    : user.plan === "payg"
                      ? "Pay As You Go dùng theo số giờ đã mua, phù hợp các dự án thỉnh thoảng."
                      : "Hạn mức chuyển đổi được làm mới mỗi ngày theo gói của bạn."}
                </p>
              </div>
            </div>

            <div className="w-full md:max-w-sm">
              <span className="text-2xl font-bold text-foreground">{formatQuotaTime(quotaRemaining)}</span>
              <Link
                to="/upgrade"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
              >
                <CreditCard className="h-4 w-4" />
                {quotaRemaining <= 0 ? "Mua gói để dùng tiếp" : "Nâng cấp tài khoản"}
              </Link>
            </div>
          </div>
        </div>

        {/* Transcription queue */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-border bg-card sm:rounded-3xl">
          <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                <ListTodo className="h-5 w-5 text-primary" /> Hàng đợi chuyển đổi
                {activeJobCount > 0 && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">{activeJobCount} đang chạy</span>}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">Theo dõi Job ID và trạng thái xử lý của các file đã gửi.</p>
            </div>
            <button type="button" onClick={() => setJobsRefreshKey((value) => value + 1)} disabled={jobsRefreshing}
              className="flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-medium transition hover:border-primary/40 hover:bg-primary/10 disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${jobsRefreshing ? "animate-spin" : ""}`} /> Làm mới
            </button>
          </div>

          <div className="flex flex-wrap gap-2 px-5 py-4 sm:px-6">
            {([['all', 'Tất cả'], ['active', 'Đang chạy'], ['completed', 'Hoàn thành'], ['failed', 'Thất bại']] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setJobFilter(value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${jobFilter === value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>

          {jobsLoading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
              <span className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" /> Đang tải hàng đợi...
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="px-6 pb-8 pt-3 text-center text-sm text-muted-foreground">
              {jobs.length === 0 ? "Chưa có job chuyển đổi nào." : "Không có job phù hợp bộ lọc."}
            </div>
          ) : (
            <div className="divide-y divide-border/70 border-t border-border/70">
              {filteredJobs.map((job) => {
                const isActive = job.status === "queued" || job.status === "processing";
                const isFailed = job.status === "failed" || job.status === "error";
                return (
                  <div key={job.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${isFailed ? "border-destructive/20 bg-destructive/10" : "border-primary/20 bg-primary/10"}`}>
                      {isFailed ? <AlertCircle className="h-5 w-5 text-destructive" /> : isActive
                        ? <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                        : <Check className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="max-w-full truncate text-sm font-semibold text-foreground">{job.filename}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isFailed ? "bg-destructive/10 text-destructive" : isActive ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"}`}>
                          {JOB_STATUS_LABELS[job.status]}{job.queuePosition && ` · #${job.queuePosition}`}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span title={job.id}>Job ID: <code className="text-foreground/80">{job.id}</code></span>
                        <span>{formatFileSize(job.file_size)}</span>
                        <span>{new Date(job.created_at).toLocaleString("vi-VN")}</span>
                      </div>
                      {job.error && <p className="mt-1.5 line-clamp-2 text-xs text-destructive">{job.error}</p>}
                    </div>
                    {job.status === "completed" && (
                      <Link to="/history" className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
                        Xem kết quả <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 2 Feature Cards ─────────────────────────────────────────── */}
        <div className="grid gap-6">

          {/* Card: Upload */}
          <Link to="/upload"
            className="group relative block overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/60 hover:shadow-glow sm:rounded-3xl sm:p-8 sm:hover:-translate-y-1"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/15 sm:h-20 sm:w-20">
                <Upload className="h-7 w-7 animate-float text-primary sm:h-9 sm:w-9" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="mb-1 text-xl font-bold text-foreground sm:text-2xl">Tải file âm thanh</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Upload file MP3, WAV, M4A… Hachi chuyển thành văn bản chính xác trong vài giây.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:gap-4">
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-primary" />~3 giây</span>
                  <span className="flex items-center gap-1"><Languages className="h-3 w-3 text-primary" />50+ ngôn ngữ</span>
                </div>
              </div>
              <ArrowRight className="hidden h-6 w-6 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary sm:block" />
            </div>
          </Link>

          {/* Card: Record */}
          <Link to="/record"
            className="group relative block overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/60 hover:shadow-glow sm:rounded-3xl sm:p-8 sm:hover:-translate-y-1"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-primary/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/15 sm:h-20 sm:w-20">
                <span className="absolute inset-0 rounded-full border border-primary/30 animate-pulse-ring" />
                <span className="absolute inset-0 rounded-full border border-primary/20 animate-pulse-ring" style={{ animationDelay: "0.8s" }} />
                <Mic className="relative h-7 w-7 text-primary sm:h-9 sm:w-9" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="mb-1 text-xl font-bold text-foreground sm:text-2xl">Ghi âm giọng nói</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Nói trực tiếp vào micro, Hachi chuyển đổi theo thời gian thực — không cần tải file.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:gap-4">
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-primary" />Thời gian thực</span>
                  <span className="flex items-center gap-1"><Languages className="h-3 w-3 text-primary" />50+ ngôn ngữ</span>
                </div>
              </div>
              <ArrowRight className="hidden h-6 w-6 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary sm:block" />
            </div>
          </Link>
        </div>

        {/* History preview */}
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Lịch sử gần đây
            </h2>
            <Link to="/history"
              className="flex items-center gap-1 text-sm text-primary hover:underline">
              Xem tất cả <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 py-8 text-center text-sm text-muted-foreground">
              Chưa có lịch sử. Hãy tải file hoặc ghi âm để bắt đầu!
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {history.map((item) => (
                <Link to="/history" key={item.id}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-3.5 hover:border-primary/40 hover:bg-primary/5 transition group">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 border border-primary/20">
                    {item.filename.startsWith("recording.")
                      ? <Mic className="h-4 w-4 text-primary" />
                      : <AudioLines className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.filename}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(item.created_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {item.duration && <span>· {Math.round(item.duration)}s</span>}
                    </div>
                  </div>
                  <p className="hidden md:block text-xs text-muted-foreground truncate max-w-[200px]">
                    {item.text || "Không có văn bản"}
                  </p>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-10 grid grid-cols-2 gap-4 border-t border-border pt-8 text-sm text-muted-foreground sm:flex sm:flex-wrap sm:justify-center sm:gap-8">
          {[
            { value: "50+",  label: "Ngôn ngữ hỗ trợ" },
            { value: "~3s",  label: "Tốc độ xử lý"    },
            { value: "98%",  label: "Độ chính xác"     },
            { value: "200MB",label: "File tối đa"      },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              <div className="text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </main>

      {/* ── Edit Profile Dialog ──────────────────────────────────────── */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => void handleAvatarFileChange(e)} />

      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl">Chỉnh sửa thông tin</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-5 py-2">

            {/* Avatar */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                {(avatarPreview ?? user.avatar) ? (
                  <img src={avatarPreview ?? user.avatar!} alt="avatar"
                    className="h-20 w-20 rounded-full object-cover shadow-glow ring-2 ring-primary/40" />
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary text-2xl font-bold text-primary-foreground shadow-glow select-none">
                    {initials}
                  </span>
                )}
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSavingAvatar}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-card border border-border hover:bg-primary/10 transition disabled:opacity-50"
                  title="Thay ảnh đại diện">
                  {isSavingAvatar
                    ? <span className="h-3.5 w-3.5 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
                    : <Camera className="h-3.5 w-3.5 text-primary" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isSavingAvatar ? "Đang lưu ảnh..." : "Nhấn biểu tượng camera để thay ảnh"}
              </p>
            </div>

            {profileError && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                <X className="h-4 w-4 shrink-0" />{profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-sm text-primary">
                <Check className="h-4 w-4 shrink-0" />Đã lưu thành công!
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tên</label>
                <input value={editForm.firstName}
                  onChange={(e) => { setEditForm((p) => ({ ...p, firstName: e.target.value })); setProfileError(""); }}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Tên" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Họ</label>
                <input value={editForm.lastName}
                  onChange={(e) => { setEditForm((p) => ({ ...p, lastName: e.target.value })); setProfileError(""); }}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Họ" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input value={user.email} disabled
                className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed" />
              <p className="text-xs text-muted-foreground/60">Email liên kết với tài khoản, không thể thay đổi</p>
            </div>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              <button onClick={closeEdit} disabled={isSavingProfile}
                className="flex-1 rounded-full border border-border py-2.5 text-sm font-medium text-foreground hover:bg-card transition disabled:opacity-50">
                Hủy
              </button>
              <button onClick={() => void handleSaveProfile()} disabled={isSavingProfile || isSavingAvatar}
                className="flex-1 flex items-center justify-center gap-2 rounded-full bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition disabled:opacity-60">
                {isSavingProfile
                  ? <><span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />Đang lưu...</>
                  : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
