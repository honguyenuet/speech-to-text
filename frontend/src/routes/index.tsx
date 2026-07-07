import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mic, Languages, Zap, FileText, ArrowRight, UserPlus, Upload, Sparkles, Download, Phone, Mail } from "lucide-react";

const SOCIALS = [
  {
    label: "Facebook", href: "#",
    svg: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
    fill: true,
  },
  {
    label: "Instagram", href: "#",
    svg: <><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></>,
    fill: false,
  },
  {
    label: "YouTube", href: "#",
    svg: <><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" style={{fill:"currentColor"}}/></>,
    fill: false,
  },
  {
    label: "X", href: "#",
    svg: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />,
    fill: true,
  },
];
import hachiLogo from "@/assets/hachi-logo.png";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hachi — Chuyển giọng nói thành văn bản trong tích tắc" },
      {
        name: "description",
        content:
          "Hachi giúp bạn chuyển giọng nói thành văn bản nhanh, chính xác và hỗ trợ đa ngôn ngữ. Ghi âm, tải file và nhận bản chép lời ngay lập tức.",
      },
      { property: "og:title", content: "Hachi — Speech to Text" },
      {
        property: "og:description",
        content:
          "Chuyển giọng nói thành văn bản chính xác bằng AI. Nhanh, an toàn, đa ngôn ngữ.",
      },
      { property: "og:image", content: hachiLogo },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  function requireAuth() {
    if (user) {
      void navigate({ to: "/dashboard", search: { token: undefined } });
    } else {
      void navigate({ to: "/login", search: { error: undefined, from: undefined } });
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <header className="relative z-20">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <a href="/" className="flex items-center gap-2">
            <img src={hachiLogo} alt="Hachi" className="h-14 w-auto object-contain sm:h-20" />
          </a>
          <div className="hidden items-center gap-8 md:flex text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">Tính năng</a>
            <a href="#how" className="hover:text-foreground transition">Cách dùng</a>
            <a href="#pricing" className="hover:text-foreground transition">Bảng giá</a>
          </div>
          <button
            onClick={requireAuth}
            className="whitespace-nowrap rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 sm:px-5 sm:text-sm"
          >
            Bắt đầu miễn phí
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-12 lg:grid-cols-2 lg:items-center lg:pt-20">
          {/* Left */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Mô hình AI mới — chính xác 98%
            </div>
            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Chuẩn từng âm, <br />
              <span className="font-display text-primary text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
                trọn từng lời.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground sm:mt-6 sm:text-lg">
              Hachi chuyển giọng nói thành văn bản chính xác trong vài giây. Hỗ
              trợ tiếng Việt, tiếng Anh và hơn 50 ngôn ngữ khác — sẵn sàng cho
              podcast, họp, phỏng vấn và ghi chú nhanh.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <button
                onClick={requireAuth}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 sm:w-auto"
              >
                <Mic className="h-5 w-5" />
                Ghi âm ngay
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </button>
              <button
                onClick={requireAuth}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card/50 px-7 py-3.5 text-base font-semibold text-foreground transition hover:bg-card sm:w-auto"
              >
                Tải file âm thanh
              </button>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4 text-center text-sm text-muted-foreground sm:mt-10 sm:justify-start sm:gap-8 sm:text-left">
              <div>
                <div className="text-2xl font-bold text-foreground">50+</div>
                <div>Ngôn ngữ</div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <div className="text-2xl font-bold text-foreground">~3s</div>
                <div>Tốc độ xử lý</div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <div className="text-2xl font-bold text-foreground">98%</div>
                <div>Độ chính xác</div>
              </div>
            </div>
          </div>

          {/* Right — visual */}
          <div className="relative">
            <div className="absolute inset-0 -z-10 flex items-center justify-center">
              <div className="h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
            </div>

            {/* Logo orbit */}
            <div className="relative mx-auto flex h-72 w-72 items-center justify-center sm:h-96 sm:w-96">
              <span className="absolute h-full w-full rounded-full border border-primary/30 animate-pulse-ring" />
              <span
                className="absolute h-full w-full rounded-full border border-primary/20 animate-pulse-ring"
                style={{ animationDelay: "0.8s" }}
              />
              <span
                className="absolute h-full w-full rounded-full border border-primary/10 animate-pulse-ring"
                style={{ animationDelay: "1.6s" }}
              />
              <img
                src={hachiLogo}
                alt="Hachi logo"
                className="relative h-60 w-60 object-contain drop-shadow-[0_10px_40px_rgba(250,200,60,0.5)] sm:h-80 sm:w-80"
              />
            </div>

            {/* Transcript card */}
            <div className="relative mx-auto mt-6 max-w-md rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Mic className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-foreground">Đang ghi âm</div>
                    <div className="text-[11px] text-muted-foreground">00:14 · Tiếng Việt</div>
                  </div>
                </div>
                <div className="flex h-6 items-end gap-[3px]">
                  {[0.6, 1, 0.8, 0.4, 0.9, 0.5, 0.7].map((_, i) => (
                    <span
                      key={i}
                      className="w-[3px] rounded-full bg-primary animate-wave"
                      style={{
                        height: "100%",
                        animationDelay: `${i * 0.12}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-foreground/90">
                “Xin chào, đây là Hachi — trợ lý chuyển giọng nói thành văn bản
                nhanh và chính xác nhất cho{" "}
                <span className="bg-primary/20 text-primary px-1 rounded">người Việt</span>.”
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section id="features" className="border-t border-border bg-card/30">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-3 md:gap-8">
          {[
            {
              icon: Zap,
              title: "Tốc độ tức thì",
              desc: "Chuyển đổi file 10 phút chỉ trong vài giây nhờ hạ tầng GPU tối ưu.",
            },
            {
              icon: Languages,
              title: "Đa ngôn ngữ",
              desc: "Hơn 50 ngôn ngữ, tự động nhận diện — kể cả giọng vùng miền.",
            },
            {
              icon: FileText,
              title: "Xuất linh hoạt",
              desc: "Tải xuống dưới dạng DOCX hoặc copy nhanh trong một cú nhấp.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-card p-6 transition hover:border-primary/50"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How to use */}
      <section id="how" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">

          <div className="mb-10 text-center sm:mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Đơn giản — chỉ 4 bước
            </div>
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              Cách <span className="font-display text-primary text-4xl sm:text-5xl">sử dụng</span>
            </h2>
            <p className="mt-3 text-muted-foreground">Từ lần đầu đăng ký đến bản văn bản hoàn chỉnh, chỉ mất chưa đầy một phút.</p>
          </div>

          {/* Steps */}
          <div className="relative grid gap-8 md:grid-cols-4">
            {/* Connecting line */}
            <div className="absolute top-10 left-[12.5%] right-[12.5%] hidden h-px md:block"
              style={{ background: "linear-gradient(to right, transparent, oklch(0.82 0.17 84 / 0.4) 15%, oklch(0.82 0.17 84 / 0.4) 85%, transparent)" }} />

            {[
              {
                step: 1,
                icon: UserPlus,
                title: "Đăng ký tài khoản",
                desc: "Tạo tài khoản miễn phí hoặc đăng nhập nhanh qua Google trong vài giây.",
              },
              {
                step: 2,
                icon: Upload,
                title: "Chọn phương thức",
                desc: "Tải file âm thanh (MP3, WAV, M4A…) hoặc ghi âm trực tiếp từ microphone.",
              },
              {
                step: 3,
                icon: Sparkles,
                title: "AI xử lý",
                desc: "Hachi tự động nhận diện ngôn ngữ, phân tích và chuyển đổi chỉ trong vài giây.",
              },
              {
                step: 4,
                icon: Download,
                title: "Nhận kết quả",
                desc: "Chỉnh sửa văn bản, sao chép hoặc tải xuống file Word — lưu mãi trong lịch sử.",
              },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center gap-4">
                {/* Step bubble */}
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-primary/10 border border-primary/30" />
                  <span className="absolute inset-2 rounded-full bg-primary/15" />
                  <s.icon className="relative h-8 w-8 text-primary" />
                  {/* Step number badge */}
                  <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-primary text-[11px] font-bold text-primary-foreground shadow-glow">
                    {s.step}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-14 flex justify-center">
            <button
              onClick={requireAuth}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 sm:w-auto"
            >
              <Mic className="h-5 w-5" />
              Thử ngay miễn phí
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-10 text-sm text-muted-foreground sm:px-6 md:flex-row">

          {/* Logo + copyright */}
          <div className="flex flex-col items-center md:items-start gap-1">
            <img src={hachiLogo} alt="Hachi" className="h-8 w-auto object-contain" />
            <span className="text-xs">© 2025 Hachi. Powered by sonix.ai.</span>
          </div>

          {/* Contact */}
          <div className="flex flex-col items-center gap-2">
            <a href="tel:0916168475"
              className="flex items-center gap-2 hover:text-primary transition">
              <Phone className="h-4 w-4 text-primary" />
              0916 168 475
            </a>
            <a href="mailto:hachi@gmail.com"
              className="flex items-center gap-2 hover:text-primary transition">
              <Mail className="h-4 w-4 text-primary" />
              hachi@gmail.com
            </a>
          </div>

          {/* Social icons */}
          <div className="flex items-center gap-3">
            {SOCIALS.map(({ label, href, svg, fill }) => (
              <a key={label} href={href} aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition">
                <svg viewBox="0 0 24 24" className="h-4 w-4"
                  fill={fill ? "currentColor" : "none"}
                  stroke={fill ? "none" : "currentColor"}
                  strokeWidth={fill ? undefined : 2}
                  strokeLinecap={fill ? undefined : "round"}
                  strokeLinejoin={fill ? undefined : "round"}>
                  {svg}
                </svg>
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
