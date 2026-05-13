import type { RecordingMode } from "./RecordingSetupCard";

export interface RecordingTheme {
  segmentActiveClass: string;
  buttonClass: string;
}

const THEMES: Record<RecordingMode, RecordingTheme> = {
  "in-person": {
    segmentActiveClass: "bg-primary text-primary-foreground",
    buttonClass: "bg-primary hover:bg-primary/90 text-primary-foreground",
  },
  remote: {
    segmentActiveClass: "bg-emerald-500 text-white",
    buttonClass: "bg-emerald-500 hover:bg-emerald-500 text-white",
  },
  upload: {
    segmentActiveClass: "bg-amber-400 text-slate-950",
    buttonClass: "bg-amber-400 hover:bg-amber-300 text-slate-950",
  },
};

export function getRecordingTheme(mode: RecordingMode): RecordingTheme {
  return THEMES[mode];
}
