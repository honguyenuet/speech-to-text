import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  History, AudioLines, Mic, Copy, Check, Download,
  ChevronDown, ChevronUp, Clock, HardDrive, Trash2,
  X, Search,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import hachiLogo from "@/assets/hachi-logo.png";
import { Document, Packer, Paragraph, TextRun } from "docx";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

interface Word {
  text: string;
  start: number;
  end: number;
}

interface HistoryItem {
  id: number;
  filename: string;
  file_size: number;
  duration: number | null;
  text: string;
  words: Word[] | null;
  audio_filename: string | null;
  created_at: string;
}

export const Route = createFileRoute("/history")({
  component: HistoryPage,
});

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isRecording(filename: string) {
  return filename.startsWith("recording.");
}

function HistoryPage() {
  const { user, isLoading, token } = useAuth();
  const navigate = useNavigate();

  const [items, setItems]               = useState<HistoryItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [expanded, setExpanded]         = useState<number | null>(null);
  const [copied, setCopied]             = useState<number | null>(null);
  const [deleting, setDeleting]         = useState<number | null>(null);
  const [isSaving, setIsSaving]         = useState(false);
  const [localChanged, setLocalChanged] = useState(false);
  const [search, setSearch]             = useState("");
  // blob URLs keyed by item id — loaded on first expand
  const [itemAudioUrls, setItemAudioUrls] = useState<Record<number, string>>({});
  const [audioLoading, setAudioLoading]   = useState(false);

  // Single set of refs — only one item can be expanded at a time
  const audioRef       = useRef<HTMLAudioElement>(null);
  const editRef        = useRef<HTMLDivElement>(null);
  const spanRefs       = useRef<HTMLSpanElement[]>([]);
  const activeIdxRef   = useRef(-1);
  const wordsRef       = useRef<Word[]>([]);
  const itemsRef       = useRef<HistoryItem[]>([]);
  // Tracks which IDs have already been fetched (avoids re-fetch on re-expand)
  const fetchedIds     = useRef<Set<number>>(new Set());

  useEffect(() => { itemsRef.current = items; }, [items]);

  const filtered = search.trim()
    ? items.filter((i) => {
        const q = search.toLowerCase();
        return i.filename.toLowerCase().includes(q) || i.text.toLowerCase().includes(q);
      })
    : items;

  useEffect(() => {
    if (!isLoading && !user) void navigate({ to: "/login", search: { error: undefined, from: undefined } });
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (!user || !token) return;
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/api/transcribe/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setItems((await res.json()) as HistoryItem[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, token]);

  // When expanded changes: rebuild word spans + auto-fetch audio from server
  useEffect(() => {
    const div = editRef.current;

    // Pause old audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Clear previous DOM state
    if (div) {
      div.innerHTML = "";
    }
    spanRefs.current = [];
    activeIdxRef.current = -1;
    wordsRef.current = [];
    setLocalChanged(false);

    if (expanded === null || !div) return;

    const item = itemsRef.current.find((i) => i.id === expanded);
    if (!item) return;

    // Build word spans
    const ws: Word[] = Array.isArray(item.words) ? item.words : [];
    wordsRef.current = ws;

    if (ws.length === 0) {
      div.textContent = item.text;
    } else {
      ws.forEach((w, i) => {
        const span = document.createElement("span");
        span.className =
          "cursor-pointer rounded px-0.5 transition-colors duration-100 hover:bg-primary/15";
        span.textContent = w.text;
        span.onclick = () => {
          if (audioRef.current) {
            audioRef.current.currentTime = w.start / 1000;
            void audioRef.current.play();
          }
        };
        div.appendChild(span);
        if (i < ws.length - 1) div.appendChild(document.createTextNode(" "));
        spanRefs.current.push(span);
      });
    }

    // Auto-fetch audio from server if not yet loaded
    if (item.audio_filename && !fetchedIds.current.has(expanded)) {
      fetchedIds.current.add(expanded);
      setAudioLoading(true);
      void fetch(`${API_URL}/api/transcribe/${expanded}/audio`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (res) => {
          if (!res.ok) return;
          const blob = await res.blob();
          const url  = URL.createObjectURL(blob);
          setItemAudioUrls((prev) => ({ ...prev, [expanded]: url }));
        })
        .finally(() => setAudioLoading(false));
    }
  }, [expanded, token]);

  function handleTimeUpdate() {
    if (!audioRef.current || wordsRef.current.length === 0) return;
    const ms = audioRef.current.currentTime * 1000;
    let newIdx = -1;
    for (let i = 0; i < wordsRef.current.length; i++) {
      if (wordsRef.current[i].start <= ms) newIdx = i;
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

  function resetEdit() {
    const item = itemsRef.current.find((i) => i.id === expanded);
    if (!item || !editRef.current) return;
    const ws: Word[] = Array.isArray(item.words) ? item.words : [];
    editRef.current.innerHTML = "";
    spanRefs.current = [];
    activeIdxRef.current = -1;
    if (ws.length > 0) {
      wordsRef.current = ws;
      ws.forEach((w, i) => {
        const span = document.createElement("span");
        span.className =
          "cursor-pointer rounded px-0.5 transition-colors duration-100 hover:bg-primary/15";
        span.textContent = w.text;
        span.onclick = () => {
          if (audioRef.current) {
            audioRef.current.currentTime = w.start / 1000;
            void audioRef.current.play();
          }
        };
        editRef.current!.appendChild(span);
        if (i < ws.length - 1) editRef.current!.appendChild(document.createTextNode(" "));
        spanRefs.current.push(span);
      });
    } else {
      editRef.current.textContent = item.text;
    }
    setLocalChanged(false);
  }

  async function handleSaveEdit(id: number) {
    const text = editRef.current?.textContent ?? "";
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/transcribe/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, text } : i));
        setLocalChanged(false);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopy(item: HistoryItem) {
    const text = expanded === item.id && editRef.current
      ? (editRef.current.textContent ?? item.text)
      : item.text;
    await navigator.clipboard.writeText(text);
    setCopied(item.id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      const res = await fetch(`${API_URL}/api/transcribe/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (expanded === id) setExpanded(null);
        setItemAudioUrls((prev) => {
          if (prev[id]) URL.revokeObjectURL(prev[id]);
          const next = { ...prev };
          delete next[id];
          return next;
        });
        fetchedIds.current.delete(id);
      }
    } finally {
      setDeleting(null);
    }
  }

  async function handleDownload(item: HistoryItem) {
    const text = expanded === item.id && editRef.current
      ? (editRef.current.textContent ?? item.text)
      : item.text;
    const baseName = item.filename.replace(/\.[^.]+$/, "");
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

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!user) return null;

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="absolute top-[8%] left-[4%] h-80 w-80 rounded-full bg-primary/15 blur-3xl animate-float pointer-events-none" />
      <div className="absolute bottom-[6%] right-[4%] h-64 w-64 rounded-full bg-primary/10 blur-3xl animate-float pointer-events-none" style={{ animationDelay: "1.5s" }} />

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

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">

        {/* Heading */}
        <div className="mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-4">
            <History className="h-3 w-3" /> Lịch sử chuyển đổi
          </div>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Lịch sử <span className="font-display text-primary text-4xl sm:text-5xl">của bạn</span>
          </h1>
          <p className="mt-2 text-muted-foreground">Tất cả bản chuyển đổi gần đây — nhấn để xem, chỉnh sửa hoặc nghe lại.</p>

          {/* Search */}
          <div className="relative mt-5 max-w-lg">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm theo tên file hoặc nội dung..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-border bg-card/60 py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {search && !loading && (
            <p className="mt-2 text-xs text-muted-foreground">
              Tìm thấy <span className="font-medium text-foreground">{filtered.length}</span> kết quả cho &quot;{search}&quot;
            </p>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
              <History className="h-10 w-10 text-primary/50" />
            </div>
            <p className="text-lg font-semibold text-foreground">
              {search ? "Không tìm thấy kết quả" : "Chưa có lịch sử"}
            </p>
            <p className="text-muted-foreground text-sm">
              {search ? `Không có bản ghi nào khớp với "${search}"` : "Hãy thử tải file hoặc ghi âm để bắt đầu!"}
            </p>
            {!search && (
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <Link to="/upload"
                  className="rounded-full border border-primary/40 bg-primary/10 px-5 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition">
                  Tải file lên
                </Link>
                <Link to="/record"
                  className="rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition">
                  Ghi âm
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((item) => {
              const isOpen   = expanded === item.id;
              const hasWords = Array.isArray(item.words) && item.words.length > 0;
              const audioUrl = itemAudioUrls[item.id];

              return (
                <div key={item.id}
                  className={`relative overflow-hidden rounded-2xl border bg-card transition-all duration-200
                    ${isOpen ? "border-primary/40 shadow-glow" : "border-border hover:border-primary/30"}`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-transparent pointer-events-none" />

                  {/* Row header */}
                  <div className="relative flex items-start gap-3 px-4 py-4 sm:items-center sm:px-5">
                    <button
                      onClick={() => setExpanded(isOpen ? null : item.id)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left sm:items-center sm:gap-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 border border-primary/20">
                        {isRecording(item.filename)
                          ? <Mic className="h-5 w-5 text-primary" />
                          : <AudioLines className="h-5 w-5 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-foreground text-sm">{item.filename}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />{formatDate(item.created_at)}
                          </span>
                          {item.file_size > 0 && (
                            <span className="flex items-center gap-1">
                              <HardDrive className="h-3 w-3" />{formatBytes(item.file_size)}
                            </span>
                          )}
                          {item.duration && <span>{Math.round(item.duration)}s âm thanh</span>}
                        </div>
                      </div>
                      {!isOpen && (
                        <p className="hidden md:block text-xs text-muted-foreground truncate max-w-xs">
                          {item.text || "Không có văn bản"}
                        </p>
                      )}
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => void handleDelete(item.id)}
                        disabled={deleting === item.id}
                        title="Xóa bản ghi"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
                      >
                        {deleting === item.id
                          ? <span className="h-3.5 w-3.5 rounded-full border-2 border-destructive/40 border-t-destructive animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => setExpanded(isOpen ? null : item.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-card transition"
                      >
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isOpen && (
                    <div className="flex flex-col gap-3 border-t border-border/50 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">

                      {/* Audio player — auto-loaded from server */}
                      {item.audio_filename && (
                        <div>
                          {audioLoading && !audioUrl ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="h-3.5 w-3.5 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
                              Đang tải audio...
                            </div>
                          ) : audioUrl ? (
                            <div className="flex flex-col gap-1.5">
                              <p className="text-xs text-muted-foreground">
                                {hasWords
                                  ? "Nhấn vào từ trong văn bản để tua đến đoạn đó"
                                  : "Nghe lại bản ghi"}
                              </p>
                              <audio
                                ref={audioRef}
                                src={audioUrl}
                                controls
                                onTimeUpdate={handleTimeUpdate}
                                className="w-full h-10 rounded-xl"
                              />
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* ContentEditable text — always editable inline */}
                      <div className="rounded-2xl border border-border bg-background/60 px-4 py-4 sm:px-5">
                        <p className="text-xs text-muted-foreground mb-2">
                          Văn bản — có thể chỉnh sửa trực tiếp
                        </p>
                        <div
                          ref={editRef}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={() => {
                            const current  = editRef.current?.textContent ?? "";
                            const original = itemsRef.current.find((i) => i.id === expanded)?.text ?? "";
                            setLocalChanged(current !== original);
                          }}
                          className="max-h-64 overflow-y-auto outline-none text-sm text-foreground leading-[2.2] whitespace-pre-wrap min-h-[5rem]"
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
                        {localChanged && (
                          <>
                            <button onClick={resetEdit}
                              className="flex items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium transition hover:bg-card">
                              <X className="h-3 w-3" /> Hủy
                            </button>
                            <button onClick={() => void handleSaveEdit(item.id)} disabled={isSaving}
                              className="flex items-center justify-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-60">
                              {isSaving
                                ? <span className="h-3 w-3 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                                : <Check className="h-3 w-3" />}
                              Lưu
                            </button>
                          </>
                        )}
                        <button onClick={() => void handleCopy(item)}
                          className="flex items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary">
                          {copied === item.id
                            ? <><Check className="h-3 w-3 text-primary" />Đã sao chép</>
                            : <><Copy className="h-3 w-3" />Sao chép</>}
                        </button>
                        <button onClick={() => void handleDownload(item)}
                          className="flex items-center justify-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow transition hover:opacity-90">
                          <Download className="h-3 w-3" /> Tải .docx
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
