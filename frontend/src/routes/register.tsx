import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent, type ChangeEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import hachiLogo from "@/assets/hachi-logo.png";
import { Zap, Languages, CheckCircle2, ArrowRight, Eye, EyeOff } from "lucide-react";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

// Chuyển URL-safe base64 về standard base64
function decodeUrlSafeBase64(str: string): string {
  const standard = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = standard.length % 4;
  return atob(pad > 0 ? standard + "=".repeat(4 - pad) : standard);
}

interface GoogleData {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
}

// Hạt sáng cố định (tránh SSR hydration mismatch)
const SPARKLES = [
  { top: "7%",  left: "3%",  delay: 0,    size: "h-1.5 w-1.5" },
  { top: "13%", left: "85%", delay: 0.8,  size: "h-1 w-1" },
  { top: "32%", left: "1%",  delay: 1.4,  size: "h-2 w-2" },
  { top: "40%", left: "97%", delay: 0.3,  size: "h-1 w-1" },
  { top: "58%", left: "2%",  delay: 1.9,  size: "h-1 w-1" },
  { top: "65%", left: "92%", delay: 0.6,  size: "h-1.5 w-1.5" },
  { top: "78%", left: "7%",  delay: 1.1,  size: "h-1 w-1" },
  { top: "83%", left: "88%", delay: 0.4,  size: "h-2 w-2" },
  { top: "93%", left: "40%", delay: 1.6,  size: "h-1 w-1" },
  { top: "4%",  left: "50%", delay: 0.9,  size: "h-1.5 w-1.5" },
  { top: "22%", left: "48%", delay: 1.3,  size: "h-1 w-1" },
  { top: "70%", left: "50%", delay: 0.2,  size: "h-1 w-1" },
];

const FEATURES = [
  { icon: CheckCircle2, text: "Chính xác lên đến 98%" },
  { icon: Languages,   text: "Hỗ trợ 50+ ngôn ngữ" },
  { icon: Zap,         text: "Xử lý chỉ trong ~3 giây" },
];

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>) => ({
    data: search.data as string | undefined,
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { data: encodedData } = Route.useSearch();
  const { user, isLoading, setToken } = useAuth();
  const navigate = useNavigate();

  const [googleData, setGoogleData] = useState<GoogleData | null>(null);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", password: "", confirmPassword: "",
  });
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [error, setError]                     = useState("");
  const [isSubmitting, setIsSubmitting]       = useState(false);

  useEffect(() => {
    if (!isLoading && user) void navigate({ to: "/dashboard", search: { token: undefined } });
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (!encodedData) { void navigate({ to: "/login", search: { error: undefined, from: undefined } }); return; }
    try {
      const decoded = JSON.parse(decodeUrlSafeBase64(encodedData)) as GoogleData;
      setGoogleData(decoded);
      setForm((p) => ({ ...p, email: decoded.email }));
    } catch {
      void navigate({ to: "/login", search: { error: undefined, from: undefined } });
    }
  }, [encodedData, navigate]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) { setError("Mật khẩu xác nhận không khớp"); return; }
    if (form.password.length < 6) { setError("Mật khẩu phải có ít nhất 6 ký tự"); return; }

    setIsSubmitting(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName, lastName: form.lastName,
          email: form.email,        password: form.password,
          googleId: googleData?.googleId ?? null,
        }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok) { setError(data.error ?? "Đăng ký thất bại"); return; }
      if (data.token) {
        setToken(data.token);
        void navigate({ to: "/dashboard", search: { token: undefined } });
      }
    } catch {
      setError("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8 sm:py-10">

      {/* ── Nền động ──────────────────────────────────────────────────── */}
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="absolute top-[10%] left-[8%]   h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-float    pointer-events-none" />
      <div className="absolute bottom-[8%] right-[6%] h-60 w-60 rounded-full bg-primary/15 blur-3xl animate-float    pointer-events-none" style={{ animationDelay: "1.5s" }} />
      <div className="absolute top-[45%] left-[60%]  h-40 w-40 rounded-full bg-primary/25 blur-2xl animate-float    pointer-events-none" style={{ animationDelay: "0.7s" }} />

      {SPARKLES.map((s, i) => (
        <span key={i}
          className={`absolute ${s.size} rounded-full bg-primary animate-twinkle pointer-events-none`}
          style={{ top: s.top, left: s.left, animationDelay: `${s.delay}s` }}
        />
      ))}

      {/* ── Layout 2 cột ─────────────────────────────────────────────── */}
      <div className="relative z-10 grid w-full max-w-5xl items-center gap-8 lg:grid-cols-2 lg:gap-10">

        {/* ══ CỘT TRÁI — Branding ══════════════════════════════════════ */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left">

          {/* Logo + vòng pulse */}
          <div className="relative mb-5 flex h-36 w-36 items-center justify-center sm:mb-8 sm:h-48 sm:w-48">
            <span className="absolute inset-0 rounded-full border border-primary/40 animate-pulse-ring" />
            <span className="absolute inset-0 rounded-full border border-primary/25 animate-pulse-ring" style={{ animationDelay: "0.8s" }} />
            <span className="absolute inset-0 rounded-full border border-primary/12 animate-pulse-ring" style={{ animationDelay: "1.6s" }} />
            <div className="absolute inset-5 rounded-full bg-primary/10 sm:inset-8" />
            <img
              src={hachiLogo}
              alt="Hachi"
              className="relative h-24 w-auto animate-float object-contain drop-shadow-[0_8px_32px_rgba(250,200,60,0.5)] sm:h-36"
            />
          </div>

          {/* Badge + Tiêu đề */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Chào mừng đến với Hachi
          </div>

          <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl md:text-5xl">
            Bắt đầu hành trình{" "}
            <span className="mt-1 block font-display text-4xl text-primary sm:text-5xl md:text-6xl">
              cùng Hachi!
            </span>
          </h1>

          <p className="mt-4 max-w-sm text-sm text-muted-foreground sm:text-base">
            Tạo tài khoản miễn phí và trải nghiệm công nghệ chuyển giọng nói
            thành văn bản chính xác hàng đầu Việt Nam.
          </p>

          {/* Feature list */}
          <ul className="mt-5 space-y-3 sm:mt-7">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 border border-primary/20">
                  <f.icon className="h-3.5 w-3.5 text-primary" />
                </span>
                <span className="text-sm text-muted-foreground">{f.text}</span>
              </li>
            ))}
          </ul>

          {/* Transcript demo card giống landing */}
          <div className="mt-8 w-full max-w-sm rounded-2xl border border-border bg-card/80 p-4 hidden lg:block">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Zap className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-semibold text-foreground">Kết quả chuyển đổi</span>
              <div className="ml-auto flex items-end gap-[3px] h-5">
                {[0.6, 1, 0.7, 0.9, 0.5, 0.8, 0.6].map((_, i) => (
                  <span key={i} className="w-[3px] rounded-full bg-primary/60 animate-wave"
                    style={{ height: "100%", animationDelay: `${i * 0.12}s` }} />
                ))}
              </div>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed">
              "Hachi chuyển giọng nói của bạn thành văn bản{" "}
              <span className="bg-primary/20 text-primary px-1 rounded">chính xác</span>{" "}
              trong tích tắc."
            </p>
          </div>

          <Link to="/" className="mt-6 text-sm text-muted-foreground hover:text-foreground transition hidden lg:inline-flex items-center gap-1">
            ← Quay về trang chủ
          </Link>
        </div>

        {/* ══ CỘT PHẢI — Form ══════════════════════════════════════════ */}
        <div className="w-full">
          <div className="rounded-2xl border border-border bg-card/80 p-5 shadow-soft backdrop-blur-sm sm:rounded-3xl sm:p-7">

            {/* Header form */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">Tạo tài khoản</h2>
              <p className="mt-1 text-sm text-muted-foreground">Điền thông tin bên dưới để bắt đầu</p>
            </div>

            {/* Google linked banner */}
            {googleData && (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-primary/10 border border-primary/25 px-4 py-2.5 text-sm text-primary">
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Đã liên kết với tài khoản Google</span>
              </div>
            )}

            {/* Lỗi */}
            {error && (
              <div className="mb-5 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">

              {/* First + Last name */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Tên <span className="text-destructive">*</span>
                  </label>
                  <input
                    name="firstName" value={form.firstName} onChange={handleChange} required
                    placeholder="Văn A"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Họ <span className="text-destructive">*</span>
                  </label>
                  <input
                    name="lastName" value={form.lastName} onChange={handleChange} required
                    placeholder="Nguyễn"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Địa chỉ email <span className="text-destructive">*</span>
                </label>
                <input
                  name="email" type="email" value={form.email} onChange={handleChange} required
                  placeholder="ban@example.com"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Mật khẩu <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    name="password" type={showPassword ? "text" : "password"}
                    value={form.password} onChange={handleChange} required
                    placeholder="Ít nhất 6 ký tự"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Xác nhận mật khẩu <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    name="confirmPassword" type={showConfirm ? "text" : "password"}
                    value={form.confirmPassword} onChange={handleChange} required
                    placeholder="Nhập lại mật khẩu"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit" disabled={isSubmitting}
                className="group w-full flex items-center justify-center gap-2 rounded-full bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {isSubmitting ? (
                  <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                ) : (
                  <>
                    Tạo tài khoản
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            {/* Divider trang trí */}
            <div className="mt-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <div className="flex items-end gap-[3px] px-1">
                {[0.5, 0.9, 0.6, 1, 0.7, 0.8, 0.5].map((_, i) => (
                  <span key={i} className="w-[3px] h-3 rounded-full bg-primary/40 animate-wave"
                    style={{ animationDelay: `${i * 0.14}s` }} />
                ))}
              </div>
              <div className="h-px flex-1 bg-border" />
            </div>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Đã có tài khoản?{" "}
              <Link to="/login" search={{ error: undefined, from: undefined }}
                className="text-primary font-semibold hover:underline"
              >
                Đăng nhập ngay
              </Link>
            </p>
          </div>

          {/* Mobile: back link */}
          <div className="mt-5 text-center lg:hidden">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition">
              ← Quay về trang chủ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
