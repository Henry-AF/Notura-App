// ─────────────────────────────────────────────────────────────────────────────
// Inngest function: process-meeting
// Trigger: 'meeting/process'
// Transcribes audio, summarizes via Claude, saves results, sends WhatsApp
// ─────────────────────────────────────────────────────────────────────────────

import { inngest } from "@/lib/inngest";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getPresignedDownloadUrl, deleteAudio } from "@/lib/r2";
import { sendWhatsAppMessage, alertOperator } from "@/lib/whatsapp";
import { AssemblyAI } from "assemblyai";
import Anthropic from "@anthropic-ai/sdk";
import type { MeetingJSON, Priority, Confidence } from "@/types/database";

// ── External clients ─────────────────────────────────────────────────────────

function getAAI() {
  return new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });
}
function getAnthropic() {
  return new Anthropic();
}

// ── Prompt constants (from @notura/summarization) ────────────────────────────

const PROMPT_VERSION = "1.0.0";

const SYSTEM_WHATSAPP = `Você é o Notura, um assistente especializado em processar transcrições de reuniões de negócios em português brasileiro.

Sua tarefa: analisar a transcrição e gerar um resumo estruturado, preciso e acionável para entrega via WhatsApp.

═══ REGRAS OBRIGATÓRIAS ═══

1. Escreva SEMPRE em português brasileiro informal-profissional (como um colega competente).
2. Extraia APENAS o que foi explicitamente dito ou claramente implícito no contexto — nunca invente decisões, tarefas ou participantes.
3. Se algo foi discutido mas NÃO decidido, coloque na seção "Em aberto" — NUNCA como decisão.
4. Atribua tarefas SOMENTE a quem foi explicitamente mencionado como responsável. Se uma tarefa foi mencionada mas ninguém assumiu, use "A definir" como responsável.
5. Se a próxima reunião NÃO foi mencionada, omita a linha completamente.
6. Se a transcrição tiver ruído, fala sobreposta, erros de transcrição ou gírias regionais, interprete o contexto — não copie trechos ininteligíveis.
7. Mantenha o resumo conciso — máximo 300 palavras.
8. NÃO use formatação markdown. Sem asteriscos duplos (**), sem hashtags (#), sem backticks (\`). Use apenas texto plano e o bullet "•".
9. Use *texto* (um asterisco) apenas para nomes de pessoas em tarefas, pois WhatsApp renderiza como itálico.
10. Se a transcrição estiver vazia, corrompida ou ininteligível, responda EXATAMENTE: "⚠️ Não foi possível processar esta transcrição. O áudio pode estar corrompido ou inaudível."

═══ TRATAMENTO DE NOMES ═══

- Use o primeiro nome como falado na reunião.
- Se o mesmo participante é referido por apelido E nome completo, padronize pelo nome mais usado.
- Corrija capitalização (ex: "ana" → "Ana", "BRUNO" → "Bruno").

═══ FORMATO DE SAÍDA ═══

Reunião: [assunto principal] — [data se mencionada]
Participantes: [nomes separados por vírgula]

Decisões tomadas:
• [decisão objetiva em uma frase]
• [decisão objetiva em uma frase]

Tarefas:
• *[Nome]* — [o que fazer] / [prazo se mencionado]
• *[Nome]* — [o que fazer] / [prazo se mencionado]

Em aberto:
• [ponto sem definição que precisa retomada]

Próxima reunião: [data, hora e local/link se mencionados]

═══ REGRAS DE SEÇÕES ═══

- "Decisões tomadas": se não há nenhuma → escreva "Nenhuma decisão formal registrada nesta reunião."
- "Tarefas": se não há nenhuma → escreva "Nenhuma tarefa atribuída formalmente."
- "Em aberto": se não há nenhuma → OMITA a seção inteira (não escreva o título).
- "Próxima reunião": se não mencionada → OMITA a linha inteira.
- "Participantes": se apenas 1 pessoa fala e nenhum nome é mencionado → escreva "Participante não identificado".`;

const SYSTEM_JSON = `Você é o Notura, um processador de transcrições de reuniões de negócios em português brasileiro.

Sua ÚNICA saída deve ser um objeto JSON válido. Sem texto antes. Sem texto depois. Sem markdown. Sem blocos de código. Apenas JSON puro.

═══ REGRAS ═══

1. Extraia APENAS o que foi explicitamente dito ou claramente implícito.
2. Nunca invente responsáveis, datas ou decisões.
3. Campos sem informação: retorne null (strings/objetos) ou array vazio [] (listas).
4. Nomes: capitalize corretamente, use o nome mais falado na reunião.
5. Tarefas sem prazo explícito: "due_date" = null.
6. Tarefas sem responsável explícito: "owner" = "indefinido".
7. Datas com formato claro: use ISO 8601 (YYYY-MM-DD ou YYYY-MM-DDTHH:mm).
8. Datas sem formato preciso: use string descritiva ("próxima segunda", "fim do mês").
9. Prioridade: infira pelo contexto e urgência. Default = "média".
10. Se a transcrição estiver vazia, corrompida ou ininteligível, retorne:
    {"error": "UNPROCESSABLE_TRANSCRIPT", "reason": "Transcrição vazia ou ininteligível"}

═══ SCHEMA ═══

{
  "version": "1.0",
  "meeting": {
    "title": "string — assunto principal da reunião",
    "date_mentioned": "string (ISO 8601) | null",
    "duration_minutes": "number | null — se mencionado",
    "participants": ["string — nomes dos participantes"],
    "participant_count": "number — quantidade de participantes identificados"
  },
  "decisions": [
    {
      "description": "string — decisão objetiva em uma frase",
      "decided_by": "string | null — quem tomou a decisão, se explícito",
      "confidence": "alta | média — 'alta' se explicitamente confirmado, 'média' se inferido do contexto"
    }
  ],
  "tasks": [
    {
      "description": "string — o que deve ser feito",
      "owner": "string — nome do responsável ou 'indefinido'",
      "due_date": "string (ISO 8601) | string descritiva | null",
      "priority": "alta | média | baixa",
      "status": "pendente"
    }
  ],
  "open_items": [
    {
      "description": "string — ponto sem resolução que precisa retomada",
      "context": "string | null — breve contexto de por que ficou em aberto"
    }
  ],
  "next_meeting": {
    "datetime": "string (ISO 8601) | string descritiva | null",
    "location_or_link": "string | null"
  },
  "summary_one_line": "string — uma frase descrevendo o principal resultado da reunião",
  "metadata": {
    "prompt_version": "1.0",
    "total_decisions": "number",
    "total_tasks": "number",
    "total_open_items": "number"
  }
}

Retorne EXATAMENTE este schema. Todos os campos são obrigatórios. Arrays podem estar vazios [].`;

// ── Types for Inngest event data ─────────────────────────────────────────────

interface MeetingProcessEventData {
  meetingId: string;
  r2Key: string;
  whatsappNumber: string;
  userId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Inngest function
// ─────────────────────────────────────────────────────────────────────────────

export const processMeeting = inngest.createFunction(
  {
    id: "process-meeting",
    retries: 2,
    triggers: [{ event: "meeting/process" }],
    onFailure: async ({ error, event }) => {
      // On any unrecoverable failure, update meeting status and alert operator
      const supabase = createServiceRoleClient();
      const eventData = event.data?.event?.data as MeetingProcessEventData | undefined;
      const meetingId = eventData?.meetingId;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (meetingId) {
        await supabase
          .from("meetings")
          .update({
            status: "failed",
            error_message: errorMessage,
          })
          .eq("id", meetingId);
      }

      await alertOperator(
        `Processamento falhou para reunião ${meetingId ?? "desconhecida"}: ${errorMessage}`
      );
    },
  },
  async ({ event, step }) => {
    const { meetingId, r2Key, whatsappNumber, userId } =
      event.data as MeetingProcessEventData;
    const supabase = createServiceRoleClient();

    // ── Step 1: Mark as processing ─────────────────────────────────────
    await step.run("update-status-processing", async () => {
      // Idempotency: if already completed, skip the entire function
      const { data: existing } = await supabase
        .from("meetings")
        .select("status")
        .eq("id", meetingId)
        .single();

      if (existing?.status === "completed") {
        throw new Error("SKIP: Meeting already completed");
      }

      const { error } = await supabase
        .from("meetings")
        .update({ status: "processing" })
        .eq("id", meetingId);

      if (error) throw new Error(`Failed to update status: ${error.message}`);
    });

    // ── Step 2: Transcribe audio ───────────────────────────────────────
    const transcript = await step.run("transcribe", async () => {
      // Get a presigned download URL for AssemblyAI to fetch the audio
      const audioUrl = await getPresignedDownloadUrl(r2Key);

      const aai = getAAI();
      const transcriptResult = await aai.transcripts.transcribe({
        audio_url: audioUrl,
        language_code: "pt",
        speaker_labels: true,
        punctuate: true,
      });

      if (transcriptResult.status === "error") {
        throw new Error(
          `AssemblyAI transcription failed: ${transcriptResult.error ?? "unknown error"}`
        );
      }

      if (!transcriptResult.text) {
        throw new Error("AssemblyAI returned empty transcript");
      }

      // Build transcript with speaker labels if available
      let formattedTranscript = transcriptResult.text;

      if (transcriptResult.utterances && transcriptResult.utterances.length > 0) {
        formattedTranscript = transcriptResult.utterances
          .map((u) => `Speaker ${u.speaker}: ${u.text}`)
          .join("\n\n");
      }

      // Save transcript to meeting immediately
      await supabase
        .from("meetings")
        .update({
          transcript: formattedTranscript,
          duration_seconds: transcriptResult.audio_duration
            ? Math.round(transcriptResult.audio_duration)
            : null,
        })
        .eq("id", meetingId);

      return formattedTranscript;
    });

    // ── Step 3: Generate WhatsApp summary ──────────────────────────────
    const summaryWhatsapp = await step.run("summarize-whatsapp", async () => {
      const anthropic = getAnthropic();
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_WHATSAPP,
        messages: [
          {
            role: "user",
            content: `Transcrição da reunião:\n\n${transcript}`,
          },
        ],
      });

      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );
      if (!textBlock) {
        throw new Error("Claude did not return a text response for WhatsApp summary");
      }

      return textBlock.text;
    });

    // ── Step 4: Generate JSON summary ──────────────────────────────────
    const summaryJson = await step.run("summarize-json", async () => {
      const anthropic = getAnthropic();
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: SYSTEM_JSON,
        messages: [
          {
            role: "user",
            content: `Transcrição da reunião:\n\n${transcript}`,
          },
        ],
      });

      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );
      if (!textBlock) {
        throw new Error("Claude did not return a text response for JSON summary");
      }

      // Parse JSON — Claude should return pure JSON per the prompt
      let parsed: MeetingJSON;
      try {
        parsed = JSON.parse(textBlock.text) as MeetingJSON;
      } catch {
        // Try to extract JSON from potential markdown code blocks
        const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("Failed to parse Claude JSON response");
        }
        parsed = JSON.parse(jsonMatch[0]) as MeetingJSON;
      }

      // Check for error response from Claude
      if (
        (parsed as unknown as { error?: string }).error ===
        "UNPROCESSABLE_TRANSCRIPT"
      ) {
        throw new Error("Transcript was unprocessable: empty or unintelligible");
      }

      return parsed;
    });

    // ── Step 5: Save results to Supabase ───────────────────────────────
    await step.run("save-results", async () => {
      // Insert tasks
      if (summaryJson.tasks && summaryJson.tasks.length > 0) {
        const tasksToInsert = summaryJson.tasks.map(
          (task: MeetingJSON["tasks"][number]) => ({
            meeting_id: meetingId,
            user_id: userId,
            description: task.description,
            owner: task.owner === "indefinido" ? null : task.owner,
            due_date: task.due_date ?? null,
            priority: (task.priority ?? "média") as Priority,
            completed: false,
          })
        );

        const { error: tasksError } = await supabase
          .from("tasks")
          .insert(tasksToInsert);

        if (tasksError) {
          console.error("[process-meeting] Failed to insert tasks:", tasksError);
        }
      }

      // Insert decisions
      if (summaryJson.decisions && summaryJson.decisions.length > 0) {
        const decisionsToInsert = summaryJson.decisions.map(
          (decision: MeetingJSON["decisions"][number]) => ({
            meeting_id: meetingId,
            user_id: userId,
            description: decision.description,
            decided_by: decision.decided_by ?? null,
            confidence: (decision.confidence ?? "média") as Confidence,
          })
        );

        const { error: decisionsError } = await supabase
          .from("decisions")
          .insert(decisionsToInsert);

        if (decisionsError) {
          console.error(
            "[process-meeting] Failed to insert decisions:",
            decisionsError
          );
        }
      }

      // Insert open items
      if (summaryJson.open_items && summaryJson.open_items.length > 0) {
        const openItemsToInsert = summaryJson.open_items.map(
          (item: MeetingJSON["open_items"][number]) => ({
            meeting_id: meetingId,
            user_id: userId,
            description: item.description,
            context: item.context ?? null,
          })
        );

        const { error: openItemsError } = await supabase
          .from("open_items")
          .insert(openItemsToInsert);

        if (openItemsError) {
          console.error(
            "[process-meeting] Failed to insert open_items:",
            openItemsError
          );
        }
      }

      // Update meeting with summaries
      const { error: updateError } = await supabase
        .from("meetings")
        .update({
          summary_whatsapp: summaryWhatsapp,
          summary_json: summaryJson as unknown as Record<string, unknown>,
          title: summaryJson.meeting?.title ?? "Reunião processada",
          prompt_version: PROMPT_VERSION,
        })
        .eq("id", meetingId);

      if (updateError) {
        throw new Error(`Failed to save results: ${updateError.message}`);
      }
    });

    // ── Step 6: Send WhatsApp ──────────────────────────────────────────
    await step.run("send-whatsapp", async () => {
      const result = await sendWhatsAppMessage(whatsappNumber, summaryWhatsapp);

      const newStatus = result.success ? "sent" : "failed";
      await supabase
        .from("meetings")
        .update({ whatsapp_status: newStatus })
        .eq("id", meetingId);

      if (!result.success) {
        console.error(
          `[process-meeting] WhatsApp send failed for meeting ${meetingId}: ${result.error}`
        );
        // Don't throw — WhatsApp failure shouldn't fail the whole pipeline
        // User can resend manually
      }
    });

    // ── Step 7: Cleanup — delete audio from R2 (LGPD) ─────────────────
    await step.run("cleanup", async () => {
      try {
        await deleteAudio(r2Key);
      } catch (error) {
        console.error("[process-meeting] Failed to delete audio from R2:", error);
        // Non-critical — log but don't fail the pipeline
      }

      const { error } = await supabase
        .from("meetings")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          audio_r2_key: null, // Clear R2 key since file is deleted
        })
        .eq("id", meetingId);

      if (error) {
        throw new Error(`Failed to mark meeting as completed: ${error.message}`);
      }
    });

    return { meetingId, status: "completed" };
  }
);
