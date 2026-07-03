import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Mic, Upload, LogOut, Pencil, User, Zap, Languages, ArrowRight, Camera, Check, X, History, AudioLines, Clock } from "lucide-react";
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

  useEffect(() => {
    if (!user || !token) return;
    void fetch(`${API_URL}/api/transcribe/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() as Promise<HistoryItem[]> : [])
      .then((data) => setHistory(data.slice(0, 3)));
  }, [user, token]);

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
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center">
            <img src={hachiLogo} alt="Hachi" className="h-14 w-auto object-contain" />
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link to="/upload" className="hover:text-foreground transition">Tải file lên</Link>
            <Link to="/record" className="hover:text-foreground transition">Ghi âm</Link>
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
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-12">

        {/* Greeting */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Sẵn sàng chuyển đổi
          </div>
          <h1 className="text-4xl font-bold text-foreground md:text-5xl">
            Xin chào,{" "}
            <span className="font-display text-primary text-5xl md:text-6xl">{user.firstName}!</span>
          </h1>
          <p className="mt-3 text-muted-foreground text-lg">Hôm nay bạn muốn chuyển đổi gì?</p>
        </div>

        {/* ── 2 Feature Cards ─────────────────────────────────────────── */}
        <div className="grid gap-6">

          {/* Card: Upload */}
          <Link to="/upload"
            className="group relative overflow-hidden rounded-3xl border border-border bg-card p-8 transition-all duration-300 hover:border-primary/60 hover:shadow-glow hover:-translate-y-1 block"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative flex items-center gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/15 border border-primary/20">
                <Upload className="h-9 w-9 text-primary animate-float" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-foreground mb-1">Tải file âm thanh</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Upload file MP3, WAV, M4A… Hachi chuyển thành văn bản chính xác trong vài giây.
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-primary" />~3 giây</span>
                  <span className="flex items-center gap-1"><Languages className="h-3 w-3 text-primary" />50+ ngôn ngữ</span>
                </div>
              </div>
              <ArrowRight className="h-6 w-6 text-muted-foreground shrink-0 transition group-hover:translate-x-1 group-hover:text-primary" />
            </div>
          </Link>

          {/* Card: Record */}
          <Link to="/record"
            className="group relative overflow-hidden rounded-3xl border border-border bg-card p-8 transition-all duration-300 hover:border-primary/60 hover:shadow-glow hover:-translate-y-1 block"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-primary/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative flex items-center gap-5">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/15 border border-primary/20">
                <span className="absolute inset-0 rounded-full border border-primary/30 animate-pulse-ring" />
                <span className="absolute inset-0 rounded-full border border-primary/20 animate-pulse-ring" style={{ animationDelay: "0.8s" }} />
                <Mic className="relative h-9 w-9 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-foreground mb-1">Ghi âm giọng nói</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Nói trực tiếp vào micro, Hachi chuyển đổi theo thời gian thực — không cần tải file.
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-primary" />Thời gian thực</span>
                  <span className="flex items-center gap-1"><Languages className="h-3 w-3 text-primary" />50+ ngôn ngữ</span>
                </div>
              </div>
              <ArrowRight className="h-6 w-6 text-muted-foreground shrink-0 transition group-hover:translate-x-1 group-hover:text-primary" />
            </div>
          </Link>
        </div>

        {/* History preview */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
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
        <div className="mt-10 flex flex-wrap justify-center gap-8 text-sm text-muted-foreground border-t border-border pt-8">
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

            <div className="grid grid-cols-2 gap-3">
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

            <div className="flex gap-3 pt-1">
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
