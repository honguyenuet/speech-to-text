import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { MessageCircle, X, Phone, Mail, Send, Check } from "lucide-react";
import { AuthProvider } from "@/context/AuthContext";

import appCss from "../styles.css?url";
import hachiLogoUrl from "../assets/hachi-logo.png?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function SupportChat() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  function handleSend() {
    if (!message.trim()) return;
    setSent(true);
    setMessage("");
    setTimeout(() => setSent(false), 3500);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 overflow-hidden rounded-3xl border border-border bg-card shadow-[0_20px_80px_-20px_oklch(0_0_0/0.7)]">
          {/* Header gradient */}
          <div className="bg-gradient-to-br from-[oklch(0.82_0.17_84)] to-[oklch(0.88_0.18_88)] px-5 py-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-[oklch(0.16_0.01_80)]">Hỗ trợ khách hàng</p>
                <p className="mt-0.5 text-[10px] text-[oklch(0.16_0.01_80)]/70">Chúng tôi phản hồi trong vài phút</p>
              </div>
              <button onClick={() => setOpen(false)}
                className="text-[oklch(0.16_0.01_80)]/60 hover:text-[oklch(0.16_0.01_80)] transition">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[oklch(0.16_0.01_80)]/20 text-sm font-bold text-[oklch(0.16_0.01_80)]">H</div>
              <div>
                <p className="text-xs font-semibold text-[oklch(0.16_0.01_80)]">Hachi Support</p>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-[10px] text-[oklch(0.16_0.01_80)]/70">Đang trực tuyến</span>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-3 p-4">
            {/* Greeting bubble */}
            <div className="flex items-end gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[oklch(0.82_0.17_84)]/20 text-xs font-bold text-[oklch(0.82_0.17_84)]">H</div>
              <div className="max-w-[210px] rounded-2xl rounded-bl-sm bg-[oklch(0.22_0.01_80)] px-3 py-2 text-xs text-[oklch(0.98_0.01_90)] leading-relaxed">
                Xin chào! Tôi có thể giúp gì cho bạn hôm nay? 👋
              </div>
            </div>

            {/* Quick contact */}
            <div className="flex flex-col gap-2 mt-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[oklch(0.72_0.02_85)]">Liên hệ trực tiếp</p>
              <a href="tel:0916168475"
                className="flex items-center gap-2.5 rounded-xl border border-[oklch(0.28_0.02_85/60%)] px-3 py-2.5 text-xs text-[oklch(0.98_0.01_90)] transition hover:border-[oklch(0.82_0.17_84)]/40 hover:bg-[oklch(0.82_0.17_84)]/5">
                <Phone className="h-3.5 w-3.5 text-[oklch(0.82_0.17_84)]" />
                <span>0916 168 475</span>
              </a>
              <a href="mailto:hachi@gmail.com"
                className="flex items-center gap-2.5 rounded-xl border border-[oklch(0.28_0.02_85/60%)] px-3 py-2.5 text-xs text-[oklch(0.98_0.01_90)] transition hover:border-[oklch(0.82_0.17_84)]/40 hover:bg-[oklch(0.82_0.17_84)]/5">
                <Mail className="h-3.5 w-3.5 text-[oklch(0.82_0.17_84)]" />
                <span>hachi@gmail.com</span>
              </a>
            </div>

            {/* Message input */}
            {sent ? (
              <div className="flex items-center gap-2 rounded-xl border border-[oklch(0.82_0.17_84)]/20 bg-[oklch(0.82_0.17_84)]/10 px-3 py-2.5 text-xs text-[oklch(0.82_0.17_84)]">
                <Check className="h-3.5 w-3.5" /> Đã gửi! Chúng tôi sẽ liên hệ sớm.
              </div>
            ) : (
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  placeholder="Nhập tin nhắn..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="flex-1 rounded-xl border border-[oklch(0.28_0.02_85/60%)] bg-[oklch(0.14_0.01_80)] px-3 py-2 text-xs text-[oklch(0.98_0.01_90)] placeholder:text-[oklch(0.72_0.02_85)] focus:outline-none focus:ring-1 focus:ring-[oklch(0.82_0.17_84)]/40"
                />
                <button onClick={handleSend}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.82_0.17_84)] to-[oklch(0.88_0.18_88)] text-[oklch(0.16_0.01_80)] transition hover:opacity-90">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.82_0.17_84)] to-[oklch(0.88_0.18_88)] shadow-[0_8px_32px_-8px_oklch(0.82_0.17_84/0.7)] transition-all hover:scale-105 hover:opacity-90"
      >
        {open
          ? <X className="h-5 w-5 text-[oklch(0.16_0.01_80)]" />
          : <MessageCircle className="h-6 w-6 text-[oklch(0.16_0.01_80)]" />}
          
      </button>
    </div>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Hachi" },
      { name: "description", content: "Lovable Generated Project" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Hachi" },
      { property: "og:description", content: "Lovable Generated Project" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: hachiLogoUrl },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;0,800;1,600;1,700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <SupportChat />
      </AuthProvider>
    </QueryClientProvider>
  );
}
