// NOT-138: a tiny in-memory event log for the recording screen. Interruption
// bugs (screen lock, backgrounding, phone calls) only reproduce on a real
// device with the screen off — there's no debugger attached to read console
// output at that moment. Rendering this log on screen is what turns "trust
// me, it auto-resumed" into a print Henry can attach to the ticket.

export interface RecordingLogEntry {
  at: number;
  event: string;
  detail?: string;
}

const MAX_ENTRIES = 20;

let entries: RecordingLogEntry[] = [];
let listeners = new Set<(entries: RecordingLogEntry[]) => void>();

function notify() {
  for (const listener of listeners) listener(entries);
}

export function logRecordingEvent(event: string, detail?: string): void {
  entries = [...entries, { at: Date.now(), event, detail }].slice(-MAX_ENTRIES);
  notify();
}

export function getRecordingLog(): RecordingLogEntry[] {
  return entries;
}

export function clearRecordingLog(): void {
  entries = [];
  notify();
}

export function subscribeRecordingLog(listener: (entries: RecordingLogEntry[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function formatRecordingLogEntry(entry: RecordingLogEntry): string {
  const time = new Date(entry.at).toLocaleTimeString('pt-BR', { hour12: false });
  return entry.detail ? `${time}  ${entry.event} — ${entry.detail}` : `${time}  ${entry.event}`;
}
