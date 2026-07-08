import type { TranscriptSegment, TranscriptWord } from "@/components/TranscriptSegments";

function formatSrtTimestamp(milliseconds: number) {
  const safe = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const millis = safe % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function segmentsFromWords(words: TranscriptWord[]) {
  const groups: TranscriptWord[][] = [];
  let current: TranscriptWord[] = [];
  for (const word of words) {
    current.push(word);
    const duration = word.end - (current[0]?.start ?? word.start);
    if (/[.!?…]$/.test(word.text) || current.length >= 12 || duration >= 6_000) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) groups.push(current);
  return groups.map((group) => ({
    speaker: null,
    text: group.map((word) => word.text).join(" "),
    start: group[0].start,
    end: group[group.length - 1].end,
    words: group,
  } satisfies TranscriptSegment));
}

export function buildSrt(
  segments: TranscriptSegment[],
  words: TranscriptWord[] = [],
  speakerNames: Record<string, string> = {},
) {
  const cues = segments.length > 0 ? segments : segmentsFromWords(words);
  return cues.map((segment, index) => {
    const speaker = segment.speaker
      ? `${speakerNames[segment.speaker] || segment.speakerName || `Người nói ${segment.speaker}`}: `
      : "";
    return `${index + 1}\r\n${formatSrtTimestamp(segment.start)} --> ${formatSrtTimestamp(segment.end)}\r\n${speaker}${segment.text.trim()}\r\n`;
  }).join("\r\n");
}

export function downloadSrt(
  filename: string,
  segments: TranscriptSegment[],
  words: TranscriptWord[] = [],
  speakerNames: Record<string, string> = {},
) {
  const content = buildSrt(segments, words, speakerNames);
  if (!content) return false;
  const blob = new Blob(["\uFEFF", content], { type: "application/x-subrip;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename.replace(/\.[^.]+$/, "") || "transcript"}.srt`;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
