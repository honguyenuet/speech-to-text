import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import hachiLogo from "@/assets/hachi-logo.png";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

// Vị trí cố định các hạt sáng (tránh random gây lỗi SSR hydration)
const SPARKLES = [
  { top: "8%",  left: "7%",  delay: 0,    size: "h-1.5 w-1.5" },
  { top: "15%", left: "82%", delay: 0.6,  size: "h-1 w-1" },
  { top: "28%", left: "4%",  delay: 1.1,  size: "h-1 w-1" },
  { top: "35%", left: "93%", delay: 0.3,  size: "h-2 w-2" },
  { top: "55%", left: "3%",  delay: 1.7,  size: "h-1 w-1" },
  { top: "62%", left: "88%", delay: 0.9,  size: "h-1.5 w-1.5" },
  { top: "75%", left: "6%",  delay: 0.4,  size: "h-1 w-1" },
  { top: "80%", left: "90%", delay: 1.4,  size: "h-2 w-2" },
  { top: "90%", left: "20%", delay: 0.8,  size: "h-1 w-1" },
  { top: "92%", left: "70%", delay: 1.9,  size: "h-1.5 w-1.5" },
  { top: "5%",  left: "45%", delay: 1.2,  size: "h-1 w-1" },
  { top: "48%", left: "97%", delay: 0.2,  size: "h-1 w-1" },
];

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    error: search.error as string | undefined,
    from:  search.from  as string | undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { error } = Route.useSearch();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) void navigate({ to: "/dashboard", search: { token: undefined } });
  }, [user, isLoading, navigate]);

  function handleGoogleLogin() {
    setIsRedirecting(true);
    window.location.href = `${API_URL}/api/auth/google`;
  }

  const errorMessages: Record<string, string> = {
    google_failed: "Đăng nhập Google thất bại. Vui lòng thử lại.",
    server_error:  "Có lỗi xảy ra. Vui lòng thử lại sau.",
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex flex-col items-center justify-center px-4 py-12">

      {/* ── Nền gradient giống hero ─────────────────────────────────── */}
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />

      {/* ── Các quả cầu sáng nổi ────────────────────────────────────── */}
      <div className="absolute top-[15%] left-[12%] h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-float pointer-events-none" />
      <div
        className="absolute bottom-[10%] right-[8%] h-56 w-56 rounded-full bg-primary/15 blur-3xl animate-float pointer-events-none"
        style={{ animationDelay: "1.4s" }}
      />
      <div
        className="absolute top-[55%] left-[70%] h-36 w-36 rounded-full bg-primary/25 blur-2xl animate-float pointer-events-none"
        style={{ animationDelay: "0.7s" }}
      />

      {/* ── Hạt sáng lấp lánh ───────────────────────────────────────── */}
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className={`absolute ${s.size} rounded-full bg-primary animate-twinkle pointer-events-none`}
          style={{ top: s.top, left: s.left, animationDelay: `${s.delay}s` }}
        />
      ))}

      {/* ── Nội dung chính ──────────────────────────────────────────── */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">

        {/* Logo + vòng pulse */}
        <div className="relative flex h-44 w-44 items-center justify-center mb-6">
          {/* 3 vòng sóng giống landing page */}
          <span className="absolute inset-0 rounded-full border border-primary/40 animate-pulse-ring" />
          <span
            className="absolute inset-0 rounded-full border border-primary/25 animate-pulse-ring"
            style={{ animationDelay: "0.8s" }}
          />
          <span
            className="absolute inset-0 rounded-full border border-primary/12 animate-pulse-ring"
            style={{ animationDelay: "1.6s" }}
          />
          {/* Vòng tròn nền vàng mờ */}
          <div className="absolute inset-6 rounded-full bg-primary/10" />
          <img
            src={hachiLogo}
            alt="Hachi"
            className="relative h-32 w-auto object-contain animate-float drop-shadow-[0_6px_24px_rgba(250,200,60,0.5)]"
          />
        </div>

        {/* Tiêu đề chào mừng */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Chào mừng quay trở lại
          </div>
          <h1 className="text-4xl font-bold text-foreground leading-tight">
            Xin chào,{" "}
            <span className="font-display text-primary text-5xl">tôi là Hachi!</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-xs mx-auto">
            Đăng nhập để tiếp tục chuyển giọng nói thành văn bản nhanh và chính xác.
          </p>
        </div>

        {/* Card đăng nhập */}
        <div className="w-full rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-6 shadow-soft">

          {/* Thông báo lỗi */}
          {error && errorMessages[error] && (
            <div className="mb-5 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center">
              {errorMessages[error]}
            </div>
          )}

          {/* Nút Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={isRedirecting}
            className="group w-full relative flex items-center justify-center gap-3 rounded-full border border-border bg-yellow-400 text-gray-800 py-3.5 px-6 font-semibold text-sm hover:bg-gray-50 transition-all shadow hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden"
          >
            {/* Shimmer effect khi hover */}
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-yellow-900/40 to-transparent" />

            {isRedirecting ? (
              <span className="h-5 w-5 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
            ) : (
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            <span>{isRedirecting ? "Đang chuyển hướng..." : "Đăng nhập bằng Google"}</span>
          </button>

          {/* Divider trang trí */}
          <div className="mt-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <div className="flex items-end gap-[3px] px-2">
              {[0.5, 0.9, 0.6, 1, 0.7, 0.8, 0.5].map((_, i) => (
                <span
                  key={i}
                  className="w-[3px] h-3 rounded-full bg-primary/50 animate-wave"
                  style={{ animationDelay: `${i * 0.14}s` }}
                />
              ))}
            </div>
            <div className="h-px flex-1 bg-border" />
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Bằng cách đăng nhập, bạn đồng ý với{" "}
            <span className="text-primary cursor-pointer hover:underline">Điều khoản dịch vụ</span>{" "}
            của Hachi.
          </p>
        </div>

        {/* Thanh thống kê */}
        <div className="mt-6 flex items-center gap-5 text-xs text-muted-foreground">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">50+</div>
            <div>Ngôn ngữ</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">~3s</div>
            <div>Tốc độ xử lý</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">98%</div>
            <div>Độ chính xác</div>
          </div>
        </div>

        <Link
          to="/"
          className="mt-6 text-sm text-muted-foreground hover:text-foreground transition"
        >
          ← Quay về trang chủ
        </Link>
      </div>
    </div>
  );
}
