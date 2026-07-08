import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Mic, Square, Zap, Languages, Copy, Check, Download, RotateCcw, X, Pause, Play } from "lucide-react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { useAuth } from "@/context/AuthContext";
import hachiLogo from "@/assets/hachi-logo.png";
import { TranscriptSegments, type TranscriptSegment } from "@/components/TranscriptSegments";
import { downloadSrt } from "@/lib/srt";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";
const MAX_RECORD_SECONDS = 30 * 60; // 30 phút
const LANGUAGE_OPTIONS = [
  ["auto", "Tự động nhận diện"], ["vi", "Tiếng Việt"], ["en", "Tiếng Anh"],
  ["fr", "Tiếng Pháp"], ["de", "Tiếng Đức"], ["es", "Tiếng Tây Ban Nha"],
  ["it", "Tiếng Ý"], ["pt", "Tiếng Bồ Đào Nha"], ["ja", "Tiếng Nhật"],
  ["zh", "Tiếng Trung"], ["ko", "Tiếng Hàn"], ["hi", "Tiếng Hindi"],
] as const;

const SPARKLES = [
  { top: "6%",  left: "8%",  delay: 0,   size: "h-1.5 w-1.5" },
  { top: "14%", left: "80%", delay: 0.8, size: "h-1 w-1"     },
  { top: "30%", left: "3%",  delay: 1.3, size: "h-2 w-2"     },
  { top: "48%", left: "95%", delay: 0.4, size: "h-1 w-1"     },
  { top: "62%", left: "4%",  delay: 1.7, size: "h-1 w-1"     },
  { top: "75%", left: "88%", delay: 0.9, size: "h-1.5 w-1.5" },
  { top: "88%", left: "15%", delay: 1.5, size: "h-1 w-1"     },
  { top: "93%", left: "70%", delay: 0.2, size: "h-2 w-2"     },
  { top: "4%",  left: "50%", delay: 1.0, size: "h-1 w-1"     },
  { top: "55%", left: "48%", delay: 0.5, size: "h-1 w-1"     },
];

interface Word {
  text: string;
  start: number; // milliseconds
  end: number;   // milliseconds
}
function formatTimestamp(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

interface TranscriptionQuota {
  plan: "free" | "payg" | "plus" | "pro" | "pre";
  billingCycle: "monthly" | "yearly" | null;
  freeTranscriptionSeconds: number;
  usedTranscriptionSeconds: number;
  paygSecondsRemaining: number;
  dailyTranscriptionSeconds: number;
  dailyQuotaSeconds: number | null;
  usageAlertRequired: boolean;
  usageAlertDailySeconds: number;
  remainingTranscriptionSeconds: number | null;
}

type RecordStatus = "idle" | "requesting" | "recording" | "paused" | "recorded" | "processing" | "done" | "error";

export const Route = createFileRoute("/record")({
  component: RecordPage,
});

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function RecordPage() {
  const { user, isLoading, token, updateUser } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus]               = useState<RecordStatus>("idle");
  const [recordTime, setRecordTime]       = useState(0);
  const [transcription, setTranscription] = useState("");
  const [duration, setDuration]           = useState<number | null>(null);
  const [error, setError]                 = useState("");
  const [copied, setCopied]               = useState(false);
  const [audioUrl, setAudioUrl]           = useState<string | null>(null);
  const [audioMime, setAudioMime]         = useState("audio/webm");
  const [speakerLabels, setSpeakerLabels] = useState(false);
  const [language, setLanguage]           = useState("auto");
  const [recordNotice, setRecordNotice]   = useState("");
  const [words, setWords]                 = useState<Word[]>([]);
  const [segments, setSegments]           = useState<TranscriptSegment[]>([]);
  const [transcriptionId, setTranscriptionId] = useState<number | null>(null);
  const [speakerNames, setSpeakerNames]   = useState<Record<string, string>>({});

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef         = useRef<Blob[]>([]);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordTimeRef     = useRef(0);
  const streamRef         = useRef<MediaStream | null>(null);
  const audioUrlRef       = useRef<string | null>(null);
  const recordedBlobRef   = useRef<Blob | null>(null);
  const recordedMimeRef   = useRef<string>("audio/webm");
  const audioRef          = useRef<HTMLAudioElement>(null);
  // Direct DOM refs — no state update → cursor never resets during editing
  const editRef           = useRef<HTMLDivElement>(null);
  const spanRefs          = useRef<HTMLSpanElement[]>([]);
  const activeIdxRef      = useRef(-1);

  useEffect(() => {
    if (!isLoading && !user) void navigate({ to: "/login", search: { error: undefined, from: undefined } });
  }, [user, isLoading, navigate]);

  // Build word spans in the contentEditable div when words arrive
  useEffect(() => {
    const div = editRef.current;
    if (!div) return;
    div.innerHTML = "";
    spanRefs.current = [];
    activeIdxRef.current = -1;
    if (words.length === 0) return;
    words.forEach((w, i) => {
      const span = document.createElement("span");
      span.className = "cursor-pointer rounded px-0.5 transition-colors duration-100 hover:bg-primary/15";
      span.textContent = w.text;
      span.title = `${formatTimestamp(w.start)} – ${formatTimestamp(w.end)}`;
      span.onclick = () => {
        if (audioRef.current) {
          audioRef.current.currentTime = w.start / 1000;
          void audioRef.current.play();
        }
      };
      div.appendChild(span);
      if (i < words.length - 1) div.appendChild(document.createTextNode(" "));
      spanRefs.current.push(span);
    });
  }, [words]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  // Direct DOM highlight — no React state → cursor never jumps
  function handleTimeUpdate() {
    if (!audioRef.current || spanRefs.current.length === 0) return;
    const ms = audioRef.current.currentTime * 1000;
    let newIdx = -1;
    for (let i = 0; i < words.length; i++) {
      if (words[i].start <= ms) newIdx = i;
      else break;
    }
    if (newIdx === activeIdxRef.current) return;
    const prev = spanRefs.current[activeIdxRef.current];
    if (prev) {
      prev.classList.remove("bg-primary", "text-primary-foreground", "font-medium");
      prev.classList.add("hover:bg-primary/15");
    }
    const cur = spanRefs.current[newIdx];
    if (cur) {
      cur.classList.add("bg-primary", "text-primary-foreground", "font-medium");
      cur.classList.remove("hover:bg-primary/15");
      cur.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    activeIdxRef.current = newIdx;
  }

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const nextTime = recordTimeRef.current + 1;
      recordTimeRef.current = nextTime;
      setRecordTime(nextTime);

      if (nextTime >= MAX_RECORD_SECONDS) {
        setRecordTime(MAX_RECORD_SECONDS);
        recordTimeRef.current = MAX_RECORD_SECONDS;
        stopRecording(true);
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startRecording() {
    setStatus("requesting"); setError(""); setRecordNotice("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current  = stream;
      chunksRef.current  = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => onRecordStop(mimeType);

      recorder.start(250);
      setStatus("recording");
      recordTimeRef.current = 0;
      setRecordTime(0);
      startTimer();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể truy cập microphone";
      setError(msg.includes("Permission") || msg.includes("denied")
        ? "Trình duyệt chưa cấp quyền microphone. Vui lòng cho phép quyền truy cập."
        : `Lỗi microphone: ${msg}`);
      setStatus("error");
    }
  }

  function stopRecording(hitLimit?: unknown) {
    if (hitLimit === true) {
      setRecordNotice(`Bản ghi đã tự động dừng vì đạt giới hạn ${formatTime(MAX_RECORD_SECONDS)}.`);
    }
    stopTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function pauseRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    stopTimer();
    setStatus("paused");
  }

  function resumeRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    startTimer();
    setStatus("recording");
  }

  function onRecordStop(mimeType: string) {
    const blob = new Blob(chunksRef.current, { type: mimeType });
    if (blob.size === 0) { setError("Không có âm thanh nào được ghi."); setStatus("error"); return; }

    recordedBlobRef.current = blob;
    recordedMimeRef.current = mimeType;

    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    setAudioUrl(url);
    setAudioMime(mimeType);
    setStatus("recorded");
  }

  async function startTranscription() {
    const blob = recordedBlobRef.current;
    if (!blob) return;

    setStatus("processing");
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    formData.append("speakerLabels", String(speakerLabels));
    formData.append("language", language);
    try {
      const res  = await fetch(`${API_URL}/api/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await res.json()) as { jobId?: string; error?: string };
      if (!res.ok) { setError(data.error ?? "Chuyển đổi thất bại"); setStatus("error"); return; }
      if (!data.jobId) throw new Error("Server không trả về mã job");
      while (true) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const jobRes = await fetch(`${API_URL}/api/transcribe/jobs/${data.jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const job = (await jobRes.json()) as {
          status?: string; error?: string; quota?: TranscriptionQuota;
          result?: { id: number; text: string; duration: number; words: Word[]; segments: TranscriptSegment[]; speaker_names?: Record<string, string> };
        };
        if (!jobRes.ok || job.status === "failed") {
          setError(job.error ?? "Chuyển đổi thất bại"); setStatus("error"); return;
        }
        if (job.status === "completed" && job.result) {
          setTranscription(job.result.text ?? "");
          setDuration(job.result.duration ?? null);
          setWords(job.result.words ?? []);
          setSegments(job.result.segments ?? []);
          setTranscriptionId(job.result.id);
          setSpeakerNames(job.result.speaker_names ?? {});
          if (job.quota) updateUser(job.quota);
          setStatus("done");
          return;
        }
      }
    } catch {
      setError("Không thể kết nối đến server"); setStatus("error");
    }
  }

  async function handleCopy() {
    const text = editRef.current?.textContent ?? transcription;
    await navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function handleRenameSpeaker(speaker: string, name: string) {
    if (!transcriptionId) return;
    const res = await fetch(`${API_URL}/api/transcribe/${transcriptionId}/speakers`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ speaker, name }),
    });
    const data = (await res.json()) as { error?: string; speakerNames?: Record<string, string>; segments?: TranscriptSegment[]; text?: string };
    if (!res.ok) { setError(data.error ?? "Không thể đổi tên người nói"); return; }
    setSpeakerNames(data.speakerNames ?? {});
    if (data.segments) setSegments(data.segments);
    if (data.text) setTranscription(data.text);
  }

  async function handleDownload() {
    const text = editRef.current?.textContent ?? transcription;
    const doc = new Document({
      sections: [{
        children: text.split("\n").map((line) =>
          new Paragraph({ children: [new TextRun(line)] })
        ),
      }],
    });
    const blob = await Packer.toBlob(doc);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "recording.docx"; a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadAudio() {
    if (!audioUrl) return;
    const ext = audioMime.includes("webm") ? "webm" : "ogg";
    const a = document.createElement("a");
    a.href = audioUrl; a.download = `recording.${ext}`; a.click();
  }

  function reset() {
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
    recordedBlobRef.current = null;
    recordTimeRef.current = 0;
    setAudioUrl(null);
    setWords([]);
    setSegments([]);
    setTranscriptionId(null);
    setSpeakerNames({});
    if (editRef.current) editRef.current.innerHTML = "";
    spanRefs.current = [];
    activeIdxRef.current = -1;
    setStatus("idle"); setRecordTime(0); setTranscription(""); setError(""); setRecordNotice(""); setDuration(null);
  }

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!user) return null;

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">

      {/* Nền */}
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="absolute top-[8%]  left-[4%]   h-80 w-80 rounded-full bg-primary/15 blur-3xl animate-float pointer-events-none" />
      <div className="absolute bottom-[6%] right-[4%] h-64 w-64 rounded-full bg-primary/10 blur-3xl animate-float pointer-events-none" style={{ animationDelay: "1.5s" }} />
      {SPARKLES.map((s, i) => (
        <span key={i} className={`absolute ${s.size} rounded-full bg-primary animate-twinkle pointer-events-none`}
          style={{ top: s.top, left: s.left, animationDelay: `${s.delay}s` }} />
      ))}

      {/* Header */}
      <header className="relative z-20 border-b border-border bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/dashboard" search={{ token: undefined }} className="flex items-center">
            <img src={hachiLogo} alt="Hachi" className="h-11 w-auto object-contain sm:h-14" />
          </Link>
          <Link to="/dashboard" search={{ token: undefined }}
            className="whitespace-nowrap text-xs text-muted-foreground transition hover:text-foreground sm:text-sm">
            ← Quay về trang chủ
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">

        {/* Heading */}
        <div className="mb-6 text-center sm:mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Ghi âm trực tiếp
          </div>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Ghi âm <span className="font-display text-primary text-4xl sm:text-5xl">giọng nói</span>
          </h1>
          <p className="mt-2 text-muted-foreground">Nói trực tiếp vào microphone, Hachi chuyển đổi thành văn bản tức thì.</p>
        </div>

        {/* Record card */}
        <div className={`relative overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 sm:rounded-3xl sm:p-8
          ${status === "done" ? "border-primary/50 shadow-glow" : "border-border"}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

          {/* Header row */}
          <div className="relative mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/15 sm:h-12 sm:w-12">
                <Mic className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground sm:text-xl">Ghi âm giọng nói</h2>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Languages className="h-3 w-3" /> Tự động nhận diện ngôn ngữ · 50+ ngôn ngữ
                </p>
              </div>
            </div>
            {(status === "done" || status === "error" || status === "recorded") && (
              <button onClick={reset}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-card transition">
                <RotateCcw className="h-3 w-3" /> Ghi âm lại
              </button>
            )}
          </div>

          {/* ── idle ── */}
          {status === "idle" && (
            <div className="flex flex-col items-center gap-6 py-6 sm:py-8">
              <button onClick={() => void startRecording()}
                className="group relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-primary shadow-glow transition-all hover:scale-105 hover:opacity-90 sm:h-32 sm:w-32">
                <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse-ring" />
                <span className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse-ring" style={{ animationDelay: "0.8s" }} />
                <Mic className="h-12 w-12 text-primary-foreground sm:h-14 sm:w-14" />
              </button>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">Nhấn để bắt đầu ghi âm</p>
                <p className="text-sm text-muted-foreground mt-1">Microphone sẽ được kích hoạt khi bạn nhấn nút</p>
              </div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-6">
                <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-primary" />Xử lý ~3 giây</span>
                <span className="flex items-center gap-1.5"><Languages className="h-4 w-4 text-primary" />50+ ngôn ngữ</span>
              </div>
            </div>
          )}

          {/* ── requesting permission ── */}
          {status === "requesting" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <span className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-muted-foreground text-sm">Đang yêu cầu quyền microphone...</p>
            </div>
          )}

          {/* ── recording ── */}
          {(status === "recording" || status === "paused") && (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
                <span className="absolute inset-0 rounded-full bg-destructive/20 animate-pulse" />
                <span className="absolute inset-[-12px] rounded-full border-2 border-destructive/30 animate-pulse-ring" />
                <span className="absolute inset-[-24px] rounded-full border border-destructive/15 animate-pulse-ring" style={{ animationDelay: "0.8s" }} />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-destructive/80 shadow-lg sm:h-24 sm:w-24">
                  <Mic className="h-10 w-10 text-white sm:h-12 sm:w-12" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-mono text-3xl font-bold tabular-nums text-foreground sm:text-4xl">{formatTime(recordTime)}</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-sm text-destructive font-medium">Đang ghi âm</span>
                </div>
              </div>
              <div className="flex h-10 max-w-full items-end gap-1 overflow-hidden">
                {Array.from({ length: 20 }).map((_, i) => (
                  <span key={i} className="w-1.5 rounded-full bg-primary/70 animate-wave"
                    style={{ height: "100%", animationDelay: `${i * 0.08}s` }} />
                ))}
              </div>
              {status === "recording" ? (
                <button onClick={pauseRecording}
                  className="flex items-center gap-2 rounded-full border border-border bg-background/60 px-6 py-3 text-sm font-semibold text-foreground hover:bg-card transition">
                  <Pause className="h-4 w-4" />
                  Tạm dừng
                </button>
              ) : (
                <button onClick={resumeRecording}
                  className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-6 py-3 text-sm font-semibold text-primary hover:bg-primary/20 transition">
                  <Play className="h-4 w-4 fill-primary" />
                  Tiếp tục
                </button>
              )}
              <button onClick={stopRecording}
                className="flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-6 py-3 text-sm font-semibold text-destructive hover:bg-destructive/20 transition">
                <Square className="h-4 w-4 fill-destructive" />
                Dừng ghi âm
              </button>
            </div>
          )}

          {/* ── recorded ── */}
          {status === "recorded" && (
            <div className="flex flex-col gap-5 py-2">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-primary font-medium">Ghi âm hoàn tất</span>
                <span className="text-muted-foreground">· {formatTime(recordTime)}</span>
              </div>
              {recordNotice && (
                <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary">
                  {recordNotice}
                </div>
              )}
              {audioUrl && (
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Mic className="h-3 w-3" /> Nghe lại bản ghi âm
                  </p>
                  <audio controls src={audioUrl} className="w-full" />
                </div>
              )}
              <label className="flex flex-col gap-2 rounded-2xl border border-border bg-background/50 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Languages className="h-4 w-4 text-primary" /> Ngôn ngữ âm thanh
                </span>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20">
                  {LANGUAGE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-background/50 px-4 py-3 transition hover:border-primary/40 hover:bg-primary/5">
                <div>
                  <p className="text-sm font-medium text-foreground">Gắn nhãn người nói</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Phân biệt và đánh dấu từng người trong đoạn ghi âm</p>
                </div>
                <div className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${speakerLabels ? "bg-primary" : "bg-muted"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${speakerLabels ? "translate-x-5" : "translate-x-0.5"}`} />
                  <input type="checkbox" className="sr-only" checked={speakerLabels} onChange={(e) => setSpeakerLabels(e.target.checked)} />
                </div>
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button onClick={handleDownloadAudio}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-medium hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition">
                  <Download className="h-4 w-4" /> Tải audio
                </button>
                <button onClick={() => void startTranscription()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition">
                  <Zap className="h-4 w-4" /> Bắt đầu chuyển đổi
                </button>
              </div>
            </div>
          )}

          {/* ── processing ── */}
          {status === "processing" && (
            <div className="flex flex-col items-center gap-5 py-8">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <span className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse-ring" />
                <span className="h-12 w-12 rounded-full border-[3px] border-primary/30 border-t-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">Đang xử lý âm thanh...</p>
                <p className="text-sm text-muted-foreground mt-1">Hachi đang chuyển đổi giọng nói của bạn</p>
              </div>
              <div className="flex items-end gap-1.5 h-8">
                {Array.from({ length: 13 }).map((_, i) => (
                  <span key={i} className="w-1.5 rounded-full bg-primary/60 animate-wave"
                    style={{ height: "100%", animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            </div>
          )}

          {/* ── error ── */}
          {status === "error" && (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex items-start gap-3 rounded-2xl bg-destructive/10 border border-destructive/20 p-4">
                <X className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
              <button onClick={reset}
                className="w-full flex items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-medium hover:bg-card transition">
                <RotateCcw className="h-4 w-4" /> Thử lại
              </button>
            </div>
          )}

          {/* ── done ── */}
          {status === "done" && (
            <div className="flex flex-col gap-5">
              {/* Status */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-primary font-medium">Chuyển đổi thành công</span>
                {duration && <span className="text-muted-foreground">· {Math.round(duration)}s âm thanh</span>}
                <span className="text-muted-foreground">· {formatTime(recordTime)} ghi âm</span>
              </div>

              {/* Audio player */}
              {audioUrl && (
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Mic className="h-3 w-3" />
                    Nghe lại — từ đang phát sẽ được highlight, nhấn vào từ để tua
                  </p>
                  <audio ref={audioRef} controls src={audioUrl} className="w-full" onTimeUpdate={handleTimeUpdate} />
                </div>
              )}

              {/* contentEditable — highlight + edit in one view */}
              <TranscriptSegments segments={segments} audioRef={audioRef} speakerNames={speakerNames} onRenameSpeaker={handleRenameSpeaker} />
              {words.length > 0 ? (
                <div className="rounded-2xl border border-border bg-background/60 px-5 py-4">
                  <p className="text-xs text-muted-foreground mb-2">Văn bản — có thể chỉnh sửa trực tiếp</p>
                  <div
                    ref={editRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => {
                      if (editRef.current)
                        setTranscription(editRef.current.textContent ?? "");
                    }}
                    className="max-h-64 overflow-y-auto outline-none text-sm text-foreground leading-[2.2] whitespace-pre-wrap min-h-[6rem]"
                  />
                </div>
              ) : (
                <textarea value={transcription} rows={8}
                  onChange={(e) => setTranscription(e.target.value)}
                  className="w-full resize-y rounded-2xl border border-border bg-background/60 px-5 py-4 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button onClick={() => void handleCopy()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-medium hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition">
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Đã sao chép" : "Sao chép"}
                </button>
                <button onClick={handleDownloadAudio}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 py-3 text-sm font-semibold text-primary hover:bg-primary/20 transition">
                  <Download className="h-4 w-4" />
                  Tải audio
                </button>
                <button onClick={() => void handleDownload()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition">
                  <Download className="h-4 w-4" />
                  Tải .docx
                </button>
                <button onClick={() => downloadSrt("recording", segments, words, speakerNames)}
                  disabled={segments.length === 0 && words.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 py-3 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40">
                  <Download className="h-4 w-4" /> Tải .srt
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
