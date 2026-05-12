import { describe, expect, it, vi } from "vitest";
import {
  GEMINI_TEXT_FALLBACK_MODEL_NAME,
  GEMINI_TEXT_MODEL_NAME,
} from "@/lib/gemini";
import type { MeetingJSON } from "@/types/database";

function createSummaryJson(): MeetingJSON {
  return {
    version: "1.0",
    meeting: {
      title: "Reuniao",
      date_mentioned: null,
      duration_minutes: null,
      participants: [],
      participant_count: 0,
    },
    decisions: [],
    tasks: [],
    open_items: [],
    next_meeting: {
      datetime: null,
      location_or_link: null,
    },
    summary_one_line: "Resumo em uma linha",
    metadata: {
      prompt_version: "1.1.0",
      total_decisions: 0,
      total_tasks: 0,
      total_open_items: 0,
    },
  };
}

describe("meeting summary AI metrics", () => {
  it("builds a completed summary metric with fallback model attribution", async () => {
    const mod = await import("./meeting-summary-metrics");
    const metric = mod.buildMeetingSummaryAiMetric({
      meetingId: "meeting-1",
      userId: "user-1",
      requestId: "event-1",
      stage: "completed",
      status: "completed",
      errorMessage: null,
      transcript: "um dois tres quatro",
      summaryWhatsapp: "Resumo pronto",
      summaryJson: createSummaryJson(),
      summaryModel: GEMINI_TEXT_FALLBACK_MODEL_NAME,
      promptVersion: "1.1.0",
      generationDurationMs: 1234,
      totalDurationMs: 1234,
      startedAt: "2026-05-08T10:00:00.000Z",
      completedAt: "2026-05-08T10:00:01.234Z",
    });

    expect(metric).toEqual(
      expect.objectContaining({
        meeting_id: "meeting-1",
        user_id: "user-1",
        request_id: "event-1",
        status: "completed",
        stage: "completed",
        error_message: null,
        primary_model: GEMINI_TEXT_MODEL_NAME,
        fallback_model: GEMINI_TEXT_FALLBACK_MODEL_NAME,
        summary_model: GEMINI_TEXT_FALLBACK_MODEL_NAME,
        used_fallback: true,
        prompt_version: "1.1.0",
        transcript_tokens_estimated: 4,
        generation_duration_ms: 1234,
        total_duration_ms: 1234,
        started_at: "2026-05-08T10:00:00.000Z",
        completed_at: "2026-05-08T10:00:01.234Z",
      })
    );
    expect(metric.summary_tokens_estimated).toBeGreaterThan(0);
    expect(metric.estimated_cost_usd).toBeGreaterThan(0);
  });

  it("inserts summary metrics into meeting_summary_ai_metrics", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "metric-1" },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const supabase = {
      from: vi.fn(() => ({ insert })),
    };
    const mod = await import("./meeting-summary-metrics");

    const result = await mod.insertMeetingSummaryAiMetric(
      supabase as never,
      {
        meeting_id: "meeting-1",
        user_id: "user-1",
        status: "completed",
        stage: "completed",
        request_id: "event-1",
        error_message: null,
        primary_model: GEMINI_TEXT_MODEL_NAME,
        fallback_model: GEMINI_TEXT_FALLBACK_MODEL_NAME,
        summary_model: GEMINI_TEXT_MODEL_NAME,
        used_fallback: false,
        prompt_version: "1.1.0",
        transcript_tokens_estimated: 4,
        summary_tokens_estimated: 2,
        generation_duration_ms: 1234,
        total_duration_ms: 1234,
      }
    );

    expect(result).toBe("metric-1");
    expect(supabase.from).toHaveBeenCalledWith("meeting_summary_ai_metrics");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ meeting_id: "meeting-1" })
    );
  });
});
