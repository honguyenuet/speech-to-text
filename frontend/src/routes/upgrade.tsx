import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Clock, CreditCard, Sparkles, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import hachiLogo from "@/assets/hachi-logo.png";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

type BillingCycle = "monthly" | "yearly";
type UpgradePlan = "payg" | "plus" | "pro" | "pre";

interface UpgradeResponse {
  id?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string | null;
  plan?: "free" | UpgradePlan;
  billingCycle?: BillingCycle | null;
  freeTranscriptionSeconds?: number;
  usedTranscriptionSeconds?: number;
  paygSecondsRemaining?: number;
  dailyTranscriptionSeconds?: number;
  dailyQuotaSeconds?: number | null;
  usageAlertRequired?: boolean;
  usageAlertDailySeconds?: number;
  remainingTranscriptionSeconds?: number | null;
  error?: string;
}

const SUBSCRIPTION_PLANS: Array<{
  id: Exclude<UpgradePlan, "payg">;
  name: string;
  dailyHours: number;
  monthlyPrice: string;
  yearlyPrice: string;
  storage: string;
  priority: string;
  tone: string;
  highlights: string[];
}> = [
  {
    id: "plus",
    name: "Plus",
    dailyHours: 3,
    monthlyPrice: "299.000đ",
    yearlyPrice: "2.990.000đ",
    storage: "50GB",
    priority: "Ưu tiên tiêu chuẩn",
    tone: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
    highlights: ["3 giờ chuyển đổi mỗi ngày", "50GB lưu trữ", "Ưu tiên xử lý tiêu chuẩn"],
  },
  {
    id: "pro",
    name: "Pro",
    dailyHours: 5,
    monthlyPrice: "499.000đ",
    yearlyPrice: "4.990.000đ",
    storage: "150GB",
    priority: "Ưu tiên cao",
    tone: "border-primary/40 bg-primary/10 text-primary",
    highlights: ["5 giờ chuyển đổi mỗi ngày", "150GB lưu trữ", "Ưu tiên xử lý cao"],
  },
  {
    id: "pre",
    name: "Pre",
    dailyHours: 7,
    monthlyPrice: "799.000đ",
    yearlyPrice: "7.990.000đ",
    storage: "300GB",
    priority: "Ưu tiên cao nhất",
    tone: "border-amber-400/35 bg-amber-400/10 text-amber-300",
    highlights: ["7 giờ chuyển đổi mỗi ngày", "300GB lưu trữ", "Ưu tiên xử lý cao nhất"],
  },
];

export const Route = createFileRoute("/upgrade")({
  component: UpgradePage,
});

function UpgradePage() {
  const { user, isLoading, token, updateUser } = useAuth();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [buyingPlan, setBuyingPlan] = useState<UpgradePlan | null>(null);
  const [error, setError] = useState("");
  const [successPlan, setSuccessPlan] = useState<UpgradePlan | null>(null);

  useEffect(() => {
    if (!isLoading && !user) void navigate({ to: "/login", search: { error: undefined, from: undefined } });
  }, [user, isLoading, navigate]);

  async function handlePurchase(plan: UpgradePlan) {
    if (!token) {
      setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      return;
    }
    setBuyingPlan(plan);
    setError("");
    setSuccessPlan(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan, billingCycle: plan === "payg" ? null : billingCycle }),
      });
      const data = (await res.json()) as UpgradeResponse;
      if (!res.ok) {
        setError(data.error ?? "Không thể nâng cấp tài khoản");
        return;
      }
      updateUser(data);
      setSuccessPlan(plan);
    } catch {
      setError("Không thể kết nối đến server");
    } finally {
      setBuyingPlan(null);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="absolute left-[4%] top-[12%] h-72 w-72 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[8%] right-[5%] h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />

      <header className="relative z-20 border-b border-border bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/dashboard" search={{ token: undefined }} className="flex items-center">
            <img src={hachiLogo} alt="Hachi" className="h-11 w-auto object-contain sm:h-14" />
          </Link>
          <Link to="/dashboard" search={{ token: undefined }}
            className="whitespace-nowrap text-xs text-muted-foreground transition hover:text-foreground sm:text-sm">
            ← Quay về dashboard
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Nâng cấp tài khoản
            </div>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Chọn hạn mức chuyển đổi phù hợp
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Tất cả gói đều dùng được các chức năng cơ bản. Nâng cấp giúp bạn có thêm thời gian chuyển đổi, ưu tiên xử lý và dung lượng lưu trữ.
            </p>
          </div>

          <div className="inline-flex w-full rounded-full border border-border bg-card p-1 sm:w-auto">
            {(["monthly", "yearly"] as BillingCycle[]).map((cycle) => (
              <button
                key={cycle}
                onClick={() => setBillingCycle(cycle)}
                className={`flex-1 rounded-full px-5 py-2 text-sm font-semibold transition sm:flex-none ${
                  billingCycle === cycle
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {cycle === "monthly" ? "Theo tháng" : "Theo năm"}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {successPlan && (
          <div className="mb-5 flex items-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary">
            <Check className="h-4 w-4" />
            Tài khoản đã được nâng cấp sang {successPlan.toUpperCase()}.
          </div>
        )}

        <div className="mb-5 grid gap-3 rounded-2xl border border-border bg-card p-4 text-sm sm:grid-cols-3 sm:p-5">
          <div>
            <p className="font-semibold text-foreground">Chức năng cơ bản</p>
            <p className="mt-1 text-muted-foreground">Upload, ghi âm, gắn nhãn người nói, chỉnh sửa và tải DOCX đều dùng được ở mọi gói.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Ưu tiên xử lý</p>
            <p className="mt-1 text-muted-foreground">Gói cao hơn được đưa vào hàng đợi nhanh hơn khi hệ thống bận.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Dung lượng lưu trữ</p>
            <p className="mt-1 text-muted-foreground">Gói cao hơn giữ được nhiều file audio và lịch sử chuyển đổi hơn.</p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:rounded-3xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/15">
                <Zap className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mb-5">
              <div className="text-3xl font-bold text-foreground">249.000đ</div>
              <p className="mt-1 text-sm text-muted-foreground">mỗi giờ, mua nhanh 10 giờ</p>
            </div>
            <ul className="mb-6 space-y-3 text-sm text-muted-foreground">
              {["Tất cả chức năng cơ bản", "10 giờ chuyển đổi linh hoạt", "10GB lưu trữ", "Không phí duy trì"].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => void handlePurchase("payg")}
              disabled={buyingPlan !== null}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 py-3 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-60"
            >
              {buyingPlan === "payg" ? <span className="h-4 w-4 rounded-full border-2 border-primary/40 border-t-primary animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Mua 10 giờ
            </button>
          </div>

          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrentPlan = user.plan === plan.id && user.billingCycle === billingCycle;
            return (
              <div key={plan.id}
                className={`relative overflow-hidden rounded-2xl border bg-card p-5 transition sm:rounded-3xl ${
                  plan.id === "pro" ? "border-primary/50 shadow-glow" : "border-border"
                }`}
              >
                {plan.id === "pro" && (
                  <div className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Phổ biến
                  </div>
                )}
                <div className="mb-5">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${plan.tone}`}>
                    <Clock className="mr-1.5 h-3.5 w-3.5" />
                    {plan.dailyHours} giờ/ngày
                  </span>
                  <h2 className="mt-4 text-2xl font-bold text-foreground">{plan.name}</h2>
                </div>
                <div className="mb-5">
                  <div className="text-3xl font-bold text-foreground">
                    {billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {billingCycle === "monthly" ? "mỗi tháng" : "mỗi năm, tiết kiệm khoảng 17%"}
                  </p>
                </div>
                <div className="mb-5 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-border bg-background/50 px-3 py-2">
                    <p className="text-muted-foreground">Lưu trữ</p>
                    <p className="mt-0.5 font-semibold text-foreground">{plan.storage}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/50 px-3 py-2">
                    <p className="text-muted-foreground">Xử lý</p>
                    <p className="mt-0.5 font-semibold text-foreground">{plan.priority}</p>
                  </div>
                </div>
                <ul className="mb-6 space-y-3 text-sm text-muted-foreground">
                  {["Tất cả chức năng cơ bản", ...plan.highlights].map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => void handlePurchase(plan.id)}
                  disabled={buyingPlan !== null || isCurrentPlan}
                  className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition disabled:opacity-60 ${
                    plan.id === "pro"
                      ? "bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                      : "border border-border hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                  }`}
                >
                  {buyingPlan === plan.id ? (
                    <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                  ) : isCurrentPlan ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {isCurrentPlan ? "Đang dùng gói này" : `Mua ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
