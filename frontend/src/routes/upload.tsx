import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Upload, AudioLines, Zap, Languages, ArrowRight, X, RotateCcw, Copy, Check, Download } from "lucide-react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { useAuth } from "@/context/AuthContext";
import hachiLogo from "@/assets/hachi-logo.png";
import { TranscriptSegments, type TranscriptSegment } from "@/components/TranscriptSegments";
import { downloadSrt } from "@/lib/srt";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";
const MAX_MB   = 200;

const FORMAT_TAGS = ["MP3", "WAV", "M4A", "OGG", "FLAC", "AAC"];
const LANGUAGE_OPTIONS = [
  ["auto", "Tự động nhận diện"], ["vi", "Tiếng Việt"], ["en", "Tiếng Anh"],
  ["fr", "Tiếng Pháp"], ["de", "Tiếng Đức"], ["es", "Tiếng Tây Ban Nha"],
  ["it", "Tiếng Ý"], ["pt", "Tiếng Bồ Đào Nha"], ["ja", "Tiếng Nhật"],
  ["zh", "Tiếng Trung"], ["ko", "Tiếng Hàn"], ["hi", "Tiếng Hindi"],
] as const;

const SPARKLES = [
  { top: "5%",  left: "5%",  delay: 0,   size: "h-1.5 w-1.5" },
  { top: "12%", left: "82%", delay: 0.7, size: "h-1 w-1"     },
  { top: "28%", left: "2%",  delay: 1.3, size: "h-1 w-1"     },
  { top: "44%", left: "96%", delay: 0.4, size: "h-2 w-2"     },
  { top: "60%", left: "3%",  delay: 1.8, size: "h-1 w-1"     },
  { top: "73%", left: "90%", delay: 0.9, size: "h-1.5 w-1.5" },
  { top: "85%", left: "6%",  delay: 1.5, size: "h-1 w-1"     },
  { top: "92%", left: "75%", delay: 0.2, size: "h-2 w-2"     },
  { top: "8%",  left: "45%", delay: 1.1, size: "h-1 w-1"     },
  { top: "50%", left: "50%", delay: 0.6, size: "h-1 w-1"     },
];

interface Word { text: string; start: number; end: number; }
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

export const Route = createFileRoute("/upload")({
  component: UploadPage,
});

function UploadPage() {
  const { user, isLoading, token, updateUser } = useAuth();
  const navigate = useNavigate();

  const [uploadFile, setUploadFile]       = useState<File | null>(null);
  const [isDragging, setIsDragging]       = useState(false);
  const [uploadStatus, setUploadStatus]   = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [transcription, setTranscription] = useState("");
  const [duration, setDuration]           = useState<number | null>(null);
  const [uploadError, setUploadError]     = useState("");
  const [copied, setCopied]               = useState(false);
  const [speakerLabels, setSpeakerLabels] = useState(false);
  const [language, setLanguage]           = useState("auto");
  const [words, setWords]                 = useState<Word[]>([]);
  const [segments, setSegments]           = useState<TranscriptSegment[]>([]);
  const [transcriptionId, setTranscriptionId] = useState<number | null>(null);
  const [speakerNames, setSpeakerNames]   = useState<Record<string, string>>({});
  const [audioUrl, setAudioUrl]           = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef     = useRef<HTMLAudioElement>(null);
  // Direct DOM refs for highlighting (no state → no re-render → cursor safe)
  const editRef      = useRef<HTMLDivElement>(null);
  const spanRefs     = useRef<HTMLSpanElement[]>([]);
  const activeIdxRef = useRef(-1);

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
      span.className =
        "cursor-pointer rounded px-0.5 transition-colors duration-100 hover:bg-primary/15";
      span.textContent = w.text;
      span.title = `${formatTimestamp(w.start)} – ${formatTimestamp(w.end)}`;
      span.onclick = () => {
        if (audioRef.current) {
          audioRef.current.currentTime = w.start / 1000;
          void audioRef.current.play();
        }
      };
      div.appendChild(span);
      // space between words (non-breaking so it stays as one node)
      if (i < words.length - 1) div.appendChild(document.createTextNode(" "));
      spanRefs.current.push(span);
    });
  }, [words]);

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Direct DOM highlight — no React state update → cursor never jumps
  function handleTimeUpdate() {
    if (!audioRef.current || spanRefs.current.length === 0) return;
    const ms = audioRef.current.currentTime * 1000;
    let newIdx = -1;
    for (let i = 0; i < words.length; i++) {
      if (words[i].start <= ms) newIdx = i;
      else break;
    }
    if (newIdx === activeIdxRef.current) return;

    // Remove highlight from previous word
    const prev = spanRefs.current[activeIdxRef.current];
    if (prev) {
      prev.classList.remove("bg-primary", "text-primary-foreground", "font-medium");
      prev.classList.add("hover:bg-primary/15");
    }
    // Add highlight to current word
    const cur = spanRefs.current[newIdx];
    if (cur) {
      cur.classList.add("bg-primary", "text-primary-foreground", "font-medium");
      cur.classList.remove("hover:bg-primary/15");
      cur.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    activeIdxRef.current = newIdx;
  }

  function handleFileSelect(file: File) {
    if (!/\.(mp3|wav|m4a|ogg|flac|aac|mp4|webm)$/i.test(file.name)) {
      setUploadError("Định dạng không hỗ trợ. Dùng MP3, WAV, M4A, OGG, FLAC, AAC"); return;
    }
    if (file.size > MAX_MB * 1024 * 1024) { setUploadError(`File quá lớn (tối đa ${MAX_MB}MB)`); return; }
    setUploadFile(file); setUploadStatus("idle"); setUploadError(""); setTranscription("");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setUploadStatus("uploading"); setUploadError("");
    try {
      const formData = new FormData();
      formData.append("audio", uploadFile);
      formData.append("speakerLabels", String(speakerLabels));
      formData.append("language", language);
      const res  = await fetch(`${API_URL}/api/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await res.json()) as { jobId?: string; error?: string };
      if (!res.ok) { setUploadError(data.error ?? "Chuyển đổi thất bại"); setUploadStatus("error"); return; }
      if (!data.jobId) throw new Error("Server không trả về mã job");
      let completed = false;
      while (!completed) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const jobRes = await fetch(`${API_URL}/api/transcribe/jobs/${data.jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const job = (await jobRes.json()) as {
          status?: string; error?: string; quota?: TranscriptionQuota;
          result?: { id: number; text: string; duration: number; words: Word[]; segments: TranscriptSegment[]; speaker_names?: Record<string, string> };
        };
        if (!jobRes.ok || job.status === "failed") {
          setUploadError(job.error ?? "Chuyển đổi thất bại"); setUploadStatus("error"); return;
        }
        if (job.status === "completed" && job.result) {
          setTranscription(job.result.text ?? "");
          setDuration(job.result.duration ?? null);
          setWords(job.result.words ?? []);
          setSegments(job.result.segments ?? []);
          setTranscriptionId(job.result.id);
          setSpeakerNames(job.result.speaker_names ?? {});
          if (job.quota) updateUser(job.quota);
          completed = true;
        }
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(uploadFile));
      setUploadStatus("done");
    } catch {
      setUploadError("Không thể kết nối đến server"); setUploadStatus("error");
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
    if (!res.ok) { setUploadError(data.error ?? "Không thể đổi tên người nói"); return; }
    setSpeakerNames(data.speakerNames ?? {});
    if (data.segments) setSegments(data.segments);
    if (data.text) setTranscription(data.text);
  }

  async function handleDownload() {
    const text = editRef.current?.textContent ?? transcription;
    const baseName = uploadFile?.name.replace(/\.[^.]+$/, "") ?? "transcript";
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
    a.href = url; a.download = `${baseName}.docx`; a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setWords([]);
    setSegments([]);
    setTranscriptionId(null);
    setSpeakerNames({});
    setUploadFile(null); setUploadStatus("idle"); setTranscription(""); setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!user) return null;

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="absolute top-[10%] left-[5%] h-80 w-80 rounded-full bg-primary/15 blur-3xl animate-float pointer-events-none" />
      <div className="absolute bottom-[8%] right-[5%] h-64 w-64 rounded-full bg-primary/10 blur-3xl animate-float pointer-events-none" style={{ animationDelay: "1.5s" }} />
      {SPARKLES.map((s, i) => (
        <span key={i} className={`absolute ${s.size} rounded-full bg-primary animate-twinkle pointer-events-none`}
          style={{ top: s.top, left: s.left, animationDelay: `${s.delay}s` }} />
      ))}

      <header className="relative z-20 border-b border-border bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/dashboard" search={{ token: undefined }} className="flex items-center">
            <img src={hachiLogo} alt="Hachi" className="h-11 w-auto object-contain sm:h-14" />
          </Link>
          <Link to="/dashboard" search={{ token: undefined }}
            className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground transition hover:text-foreground sm:text-sm">
            ← Quay về trang chủ
          </Link>
        </div>
      </header>

      <input ref={fileInputRef} type="file"
        accept=".mp3,.wav,.m4a,.ogg,.flac,.aac,.mp4,.webm,audio/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
      />

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 text-center sm:mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Chuyển đổi âm thanh
          </div>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Tải file <span className="font-display text-primary text-4xl sm:text-5xl">âm thanh</span>
          </h1>
          <p className="mt-2 text-muted-foreground">Upload file ghi âm, Hachi chuyển thành văn bản chính xác trong vài giây.</p>
        </div>

        <div className={`relative overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 sm:rounded-3xl sm:p-8
          ${uploadStatus === "done" ? "border-primary/50 shadow-glow" : "border-border"}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

          <div className="relative mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/15 sm:h-12 sm:w-12">
                <Upload className="h-6 w-6 text-primary animate-float" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground sm:text-xl">Tải file âm thanh</h2>
                <p className="text-xs text-muted-foreground">MP3, WAV, M4A, OGG, FLAC, AAC · Tối đa {MAX_MB}MB</p>
              </div>
            </div>
            {uploadStatus === "done" && (
              <button onClick={reset}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-card transition">
                <RotateCcw className="h-3 w-3" /> Tải file khác
              </button>
            )}
          </div>

          {/* idle: chưa chọn file */}
          {uploadStatus === "idle" && !uploadFile && (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative mb-6 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all sm:p-12
                  ${isDragging ? "border-primary bg-primary/10" : "border-border bg-background/50 hover:border-primary/50 hover:bg-primary/5"}`}
              >
                <div className="flex flex-col items-center gap-3 pointer-events-none">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <AudioLines className="h-8 w-8 text-primary/70" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-foreground">
                      <span className="text-primary">Kéo thả file</span> vào đây
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">hoặc nhấn để chọn file từ máy tính</p>
                  </div>
                  <p className="text-xs text-muted-foreground/60">Tối đa {MAX_MB}MB · MP3, WAV, M4A, OGG, FLAC, AAC</p>
                </div>
              </div>
              <div className="mb-6 flex flex-wrap gap-2">
                {FORMAT_TAGS.map((fmt) => (
                  <span key={fmt} className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium text-muted-foreground">{fmt}</span>
                ))}
              </div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-6">
                <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-primary" />Xử lý ~3 giây</span>
                <span className="flex items-center gap-1.5"><Languages className="h-4 w-4 text-primary" />Nhận diện tự động 50+ ngôn ngữ</span>
              </div>
            </>
          )}

          {/* idle: đã chọn file */}
          {uploadStatus === "idle" && uploadFile && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                  <AudioLines className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{uploadFile.name}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button onClick={reset} className="text-muted-foreground hover:text-destructive transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {uploadError && (
                <p className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{uploadError}</p>
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
              <button onClick={() => void handleUpload()}
                className="group w-full flex items-center justify-center gap-2 rounded-full bg-gradient-primary py-4 font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition">
                <Zap className="h-5 w-5" />
                Bắt đầu chuyển đổi
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </button>
            </div>
          )}

          {/* uploading */}
          {uploadStatus === "uploading" && (
            <div className="flex flex-col items-center gap-5 py-10">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <span className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse-ring" />
                <span className="absolute inset-0 rounded-full border-2 border-primary/10 animate-pulse-ring" style={{ animationDelay: "0.8s" }} />
                <span className="h-12 w-12 rounded-full border-[3px] border-primary/30 border-t-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">Đang xử lý âm thanh...</p>
                <p className="text-sm text-muted-foreground mt-1">Hachi đang phân tích và chuyển đổi giọng nói thành văn bản</p>
              </div>
              <div className="flex items-end gap-1.5 h-8">
                {[0.5,0.9,0.6,1,0.7,0.8,0.5,0.9,0.6,1,0.7,0.8,0.5].map((_,i) => (
                  <span key={i} className="w-1.5 rounded-full bg-primary/60 animate-wave" style={{ height: "100%", animationDelay: `${i*0.1}s` }} />
                ))}
              </div>
            </div>
          )}

          {/* error */}
          {uploadStatus === "error" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-2xl bg-destructive/10 border border-destructive/20 p-4">
                <X className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{uploadError}</p>
              </div>
              <button onClick={reset}
                className="w-full flex items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-medium hover:bg-card transition">
                <RotateCcw className="h-4 w-4" /> Thử lại
              </button>
            </div>
          )}

          {/* done */}
          {uploadStatus === "done" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-primary font-medium">Chuyển đổi thành công</span>
                {duration && <span className="text-muted-foreground">· {Math.round(duration)}s âm thanh</span>}
              </div>

              {/* Audio player */}
              {audioUrl && (
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                    <AudioLines className="h-3 w-3" />
                    Nghe lại — từ đang phát sẽ được highlight, nhấn vào từ để tua
                  </p>
                  <audio ref={audioRef} src={audioUrl} controls onTimeUpdate={handleTimeUpdate} className="w-full" />
                </div>
              )}

              <TranscriptSegments segments={segments} audioRef={audioRef} speakerNames={speakerNames} onRenameSpeaker={handleRenameSpeaker} />

              {/*
                contentEditable div — user edits here directly while audio plays.
                Highlighting is done via direct DOM classList (no React re-render → cursor never resets).
                Falls back to plain textarea when no word timestamps available.
              */}
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
                <textarea
                  value={transcription} rows={10}
                  onChange={(e) => setTranscription(e.target.value)}
                  className="w-full resize-y rounded-2xl border border-border bg-background/60 px-5 py-4 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button onClick={() => void handleCopy()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-medium hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition">
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Đã sao chép" : "Sao chép"}
                </button>
                <button onClick={() => void handleDownload()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition">
                  <Download className="h-4 w-4" />
                  Tải xuống .docx
                </button>
                <button onClick={() => downloadSrt(uploadFile?.name ?? "transcript", segments, words, speakerNames)}
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
