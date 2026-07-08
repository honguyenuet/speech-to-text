import { useMemo, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, Pencil, Search, X } from "lucide-react";

export interface TranscriptWord { text: string; start: number; end: number; }
export interface TranscriptSegment {
  speaker: string | null;
  speakerName?: string | null;
  text: string;
  start: number;
  end: number;
  words: TranscriptWord[];
}

interface Props {
  segments: TranscriptSegment[];
  audioRef: RefObject<HTMLAudioElement | null>;
  speakerNames?: Record<string, string>;
  onRenameSpeaker?: (speaker: string, name: string) => Promise<void> | void;
}

function formatTimestamp(milliseconds: number) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function TranscriptSegments({ segments, audioRef, speakerNames = {}, onRenameSpeaker }: Props) {
  const [query, setQuery] = useState("");
  const [activeResult, setActiveResult] = useState(0);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi");
    if (!needle) return [];
    return segments.flatMap((segment, segmentIndex) => {
      const text = segment.text.toLocaleLowerCase("vi");
      const found: { segmentIndex: number; offset: number }[] = [];
      let offset = 0;
      while ((offset = text.indexOf(needle, offset)) !== -1) {
        found.push({ segmentIndex, offset });
        offset += Math.max(needle.length, 1);
      }
      return found;
    });
  }, [query, segments]);

  const speakers = useMemo(
    () => [...new Set(segments.map((segment) => segment.speaker).filter((value): value is string => Boolean(value)))],
    [segments],
  );

  function seek(milliseconds: number) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = milliseconds / 1000;
    void audioRef.current.play();
  }

  function goToResult(index: number) {
    if (results.length === 0) return;
    const next = (index + results.length) % results.length;
    setActiveResult(next);
    seek(segments[results[next].segmentIndex].start);
  }

  function renderHighlighted(text: string) {
    const needle = query.trim();
    if (!needle) return text;
    const regex = new RegExp(`(${escapeRegExp(needle)})`, "gi");
    return text.split(regex).map((part, index) =>
      part.toLocaleLowerCase("vi") === needle.toLocaleLowerCase("vi")
        ? <mark key={index} className="rounded bg-primary/30 px-0.5 text-foreground">{part}</mark>
        : part,
    );
  }

  async function renameSpeaker(speaker: string) {
    const current = speakerNames[speaker] || `Người nói ${speaker}`;
    const name = window.prompt(`Đổi tên Người nói ${speaker}:`, current)?.trim();
    if (!name || name === current) return;
    await onRenameSpeaker?.(speaker, name);
  }

  if (segments.length === 0) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-background/60 p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={query} onChange={(event) => { setQuery(event.target.value); setActiveResult(0); }}
          placeholder="Tìm trong transcript..."
          className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-28 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20" />
        {query && (
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <span className="text-xs text-muted-foreground">{results.length ? activeResult + 1 : 0}/{results.length}</span>
            <button type="button" onClick={() => goToResult(activeResult - 1)} disabled={!results.length} className="rounded p-1 hover:bg-primary/10 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => goToResult(activeResult + 1)} disabled={!results.length} className="rounded p-1 hover:bg-primary/10 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => setQuery("")} className="rounded p-1 hover:bg-primary/10"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>

      {speakers.length > 0 && onRenameSpeaker && (
        <div className="flex flex-wrap gap-2">
          {speakers.map((speaker) => (
            <button key={speaker} type="button" onClick={() => void renameSpeaker(speaker)}
              className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
              {speakerNames[speaker] || `Người nói ${speaker}`} <Pencil className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      <div className="max-h-64 space-y-1 overflow-y-auto">
        {segments.map((segment, index) => (
          <button key={`${segment.start}-${index}`} type="button" onClick={() => seek(segment.start)}
            className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-primary/10">
            <span className="mr-2 font-mono text-xs font-semibold text-primary">{formatTimestamp(segment.start)} – {formatTimestamp(segment.end)}</span>
            {segment.speaker && <span className="mr-2 text-xs font-semibold text-foreground">{speakerNames[segment.speaker] || segment.speakerName || `Người nói ${segment.speaker}`}</span>}
            <span className="text-sm text-foreground">{renderHighlighted(segment.text)}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Nhấn vào đoạn để tua audio · rê chuột lên từng từ trong trình sửa để xem timestamp từ</p>
    </div>
  );
}
