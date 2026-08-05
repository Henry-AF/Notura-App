import { describe, expect, it } from "vitest";
import { getMeetingBreadcrumbLabel, isProcessingView } from "./meeting-detail-view";

describe("isProcessingView", () => {
  it("uses the processing view while the meeting is still processing", () => {
    expect(isProcessingView("processing")).toBe(true);
  });

  it("uses the processing view for meetings that have not started yet", () => {
    expect(isProcessingView("scheduled")).toBe(true);
  });

  it("uses the details view once processing finished", () => {
    expect(isProcessingView("completed")).toBe(false);
  });

  it("uses the details view for failed meetings so the retry state is reachable", () => {
    expect(isProcessingView("failed")).toBe(false);
  });
});

describe("getMeetingBreadcrumbLabel", () => {
  it("labels the breadcrumb as processing while the meeting processes", () => {
    expect(getMeetingBreadcrumbLabel("processing")).toBe("Processando");
    expect(getMeetingBreadcrumbLabel("scheduled")).toBe("Processando");
  });

  it("labels the breadcrumb as details for terminal statuses", () => {
    expect(getMeetingBreadcrumbLabel("completed")).toBe("Detalhes");
    expect(getMeetingBreadcrumbLabel("failed")).toBe("Detalhes");
  });
});
