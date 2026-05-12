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
};

export function getRecordingTheme(mode: RecordingMode): RecordingTheme {
  return THEMES[mode];
}
