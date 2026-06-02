import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("meeting detail actions", () => {
  it("moves chat access into the header and removes meeting-specific floating buttons", () => {
    const meetingHeader = readSource("src/components/meeting-detail/MeetingHeader.tsx");
    const meetingDetailClient = readSource(
      "src/app/dashboard/meetings/[id]/meeting-detail-client.tsx"
    );
    const meetingChatSheet = readSource(
      "src/components/meeting-detail/MeetingChatSheet.tsx"
    );
    const meetingDetailIndex = readSource("src/components/meeting-detail/index.ts");

    expect(meetingHeader).toContain("Chat");
    expect(meetingHeader).toContain("bg-[linear-gradient(135deg,rgba(94,76,235,0.92)_0%,rgba(59,130,246,0.82)_100%)]");
    expect(meetingDetailClient).not.toContain("AIInsightToast");
    expect(meetingChatSheet).not.toContain('aria-label="Abrir análise com IA"');
    expect(meetingChatSheet).not.toContain("position: fixed");
    expect(meetingDetailIndex).not.toContain("AIInsightToast");
    expect(meetingChatSheet).not.toContain(
      'if (feedback !== "up") (e.currentTarget as HTMLButtonElement).style.color = feedback === "up" ? "#10B981" : "#9CA3AF";'
    );
    expect(meetingChatSheet).not.toContain(
      'if (feedback !== "down") (e.currentTarget as HTMLButtonElement).style.color = feedback === "down" ? "#EF4444" : "#9CA3AF";'
    );
  });

  it("shows processing cancellation from the meeting detail without changing the processing page", () => {
    const meetingHeader = readSource("src/components/meeting-detail/MeetingHeader.tsx");
    const meetingDetailClient = readSource(
      "src/app/dashboard/meetings/[id]/meeting-detail-client.tsx"
    );
    const processingPage = readSource("src/app/dashboard/processing/page.tsx");

    expect(meetingHeader).toContain("onCancelProcessing");
    expect(meetingDetailClient).toContain("cancelMeetingProcessing");
    expect(meetingDetailClient).toContain('meetingStatus === "processing"');
    expect(processingPage).not.toContain("cancelMeetingProcessing");
    expect(processingPage).not.toContain("Cancelar processamento");
  });

  it("renders an inline participant editor and reloads after participant edits", () => {
    const meetingDetailClient = readSource(
      "src/app/dashboard/meetings/[id]/meeting-detail-client.tsx"
    );
    const meetingDetailIndex = readSource("src/components/meeting-detail/index.ts");

    expect(meetingDetailIndex).toContain("MeetingParticipantsEditorCard");
    expect(meetingDetailClient).toContain("MeetingParticipantsEditorCard");
    expect(meetingDetailClient).toContain("updateParticipantDisplayName");
    expect(meetingDetailClient).toContain("mergeParticipant");
    expect(meetingDetailClient).toContain("window.location.reload()");
    expect(meetingDetailClient).toContain("updatedRole");
    expect(meetingDetailClient).toContain("onMergeParticipant");
    expect(meetingDetailClient).toContain("onSaveParticipant");
    const participantsEditor = readSource("src/components/meeting-detail/MeetingParticipantsEditorCard.tsx");
    expect(participantsEditor).toContain("AvatarFallback");
    expect(participantsEditor).toContain("editingId");
    expect(participantsEditor).toContain("RolePill");
    expect(participantsEditor).toContain("MergePanel");
    expect(participantsEditor).toContain("collapsedGroups");
    expect(participantsEditor).toContain("aria-expanded={!isCollapsed}");
    expect(participantsEditor).toContain("Pencil");
    expect(participantsEditor).toMatch(/ml-1\.5 inline (?:h-3 w-3|size-3)/);
    expect(participantsEditor).not.toContain("✏️");
    expect(participantsEditor).not.toContain("opacity-0");
    expect(participantsEditor).toContain("availableMergeOptions={participants}");
    expect(participantsEditor).toContain("availableMergeOptions={[]}");
    expect(participantsEditor.indexOf("MergeButton")).toBeLessThan(
      participantsEditor.indexOf("RolePill")
    );
    expect(participantsEditor).not.toContain("SelectTrigger");
    expect(participantsEditor).not.toContain("Mesclar com");
    expect(meetingDetailClient).not.toContain("resolveSummary");
    expect(meetingDetailClient).not.toContain("resolvedSummary");
  });

  it("labels the participant avatar overflow as additional participants", () => {
    const meetingHeader = readSource("src/components/meeting-detail/MeetingHeader.tsx");

    expect(meetingHeader).toContain("aria-label={`${extra} participantes adicionais");
    expect(meetingHeader).toContain("title={`${participants.length} participantes");
  });
});
