// ─────────────────────────────────────────────────────────────────────────────
// lib/gemini.ts
//
// Módulo de sumarização via Google Gemini.
// Exporta helpers compartilhados pela pipeline de processamento de reuniões:
//   - generateMeetingSummary(transcript) → { summaryWhatsapp, summaryJson }
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { MeetingJSON } from "@/types/database";

// ── Constantes ────────────────────────────────────────────────────────────────

const MODEL_NAME = "gemini-3.1-flash-lite-preview";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const SUMMARY_SCHEMA_VERSION = "1.0";
export const PROMPT_VERSION = "1.1.0";

type UnprocessableTranscriptPayload = {
  error: "UNPROCESSABLE_TRANSCRIPT";
  reason: string;
};

export interface MeetingSummaryResult {
  summaryWhatsapp: string;
  summaryJson: MeetingJSON;
}

interface GeminiSummaryEnvelope {
  summary_whatsapp: string;
  summary_json: MeetingJSON | UnprocessableTranscriptPayload;
}

// ── Prompt do sistema ────────────────────────────────────────────────────────

const SYSTEM_SUMMARIZE = `Você é o Notura, um assistente especializado em processar transcrições de reuniões de negócios em português brasileiro.

Sua ÚNICA saída deve ser um objeto JSON válido. Sem texto antes. Sem texto depois. Sem markdown fora do JSON. Sem blocos de código. Apenas JSON puro.

Sua tarefa é analisar a transcrição UMA única vez e retornar, no mesmo objeto:
1. "summary_whatsapp": resumo pronto para envio no WhatsApp.
2. "summary_json": resumo estruturado em JSON para persistência e extração de tarefas/decisões.

═══ REGRAS GERAIS ═══

1. Escreva SEMPRE em português brasileiro informal-profissional.
2. Extraia APENAS o que foi explicitamente dito ou claramente implícito no contexto.
3. Nunca invente decisões, tarefas, participantes, responsáveis, datas ou links.
4. Se algo foi discutido mas NÃO decidido, trate como item em aberto.
5. Se a transcrição tiver ruído, fala sobreposta, erros de transcrição ou gírias regionais, interprete o contexto e não copie trechos ininteligíveis.
6. Corrija capitalização de nomes e padronize pelo nome mais usado na reunião.
7. Datas com formato claro devem usar ISO 8601 no "summary_json". Datas imprecisas podem ser descritivas.
8. Se a transcrição estiver vazia, corrompida ou ininteligível, retorne EXATAMENTE este objeto:
{
  "summary_whatsapp": "⚠️ Não foi possível processar esta transcrição. O áudio pode estar corrompido ou inaudível.",
  "summary_json": {
    "error": "UNPROCESSABLE_TRANSCRIPT",
    "reason": "Transcrição vazia ou ininteligível"
  }
}

═══ REGRAS PARA "summary_whatsapp" ═══

1. Mantenha o texto conciso, com no máximo 300 palavras.
2. NÃO use markdown. Sem asteriscos duplos (**), sem hashtags (#), sem backticks (\`).
3. Use apenas texto plano e o bullet "•".
4. Use *texto* (um asterisco) apenas para nomes de pessoas em tarefas, pois o WhatsApp renderiza como itálico.
5. Se uma tarefa foi mencionada mas ninguém assumiu, use "A definir" como responsável.
6. Se a próxima reunião não foi mencionada, omita a linha inteira.

Formato obrigatório de "summary_whatsapp":

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

Regras de seção para "summary_whatsapp":
- "Decisões tomadas": se não há nenhuma, escreva "Nenhuma decisão formal registrada nesta reunião."
- "Tarefas": se não há nenhuma, escreva "Nenhuma tarefa atribuída formalmente."
- "Em aberto": se não há nenhuma, OMITA a seção inteira.
- "Próxima reunião": se não mencionada, OMITA a linha inteira.
- "Participantes": se apenas 1 pessoa fala e nenhum nome é mencionado, escreva "Participante não identificado".

═══ REGRAS PARA "summary_json" ═══

1. Campos sem informação: retorne null para strings/objetos e [] para listas.
2. Tarefas sem prazo explícito: "due_date" = null.
3. Tarefas sem responsável explícito: "owner" = "indefinido".
4. Prioridade: infira pelo contexto e urgência. Default = "média".
5. "confidence": use "alta" quando a decisão estiver explicitamente confirmada; caso contrário, "média".
6. Todos os campos do schema abaixo são obrigatórios. Arrays podem estar vazios.

Schema obrigatório de "summary_json":
{
  "version": "${SUMMARY_SCHEMA_VERSION}",
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
      "confidence": "alta | média"
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
    "prompt_version": "${PROMPT_VERSION}",
    "total_decisions": "number",
    "total_tasks": "number",
    "total_open_items": "number"
  }
}

═══ FORMATO FINAL DE RESPOSTA ═══

Retorne EXATAMENTE um objeto JSON neste formato:
{
  "summary_whatsapp": "string",
  "summary_json": { ...schema acima... }
}`;

// ── Helpers internos ──────────────────────────────────────────────────────────

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment");
  return new GoogleGenerativeAI(apiKey);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        console.warn(`[gemini] Attempt ${attempt} failed — retrying in ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  throw lastError;
}

function parseJsonResponse<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to parse Gemini JSON response");
    return JSON.parse(jsonMatch[0]) as T;
  }
}

function isUnprocessableTranscriptPayload(
  value: MeetingJSON | UnprocessableTranscriptPayload
): value is UnprocessableTranscriptPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    value.error === "UNPROCESSABLE_TRANSCRIPT"
  );
}

// ── Função pública ────────────────────────────────────────────────────────────

export async function generateMeetingSummary(
  transcript: string
): Promise<MeetingSummaryResult> {
  return withRetry(async () => {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_SUMMARIZE,
    });

    const result = await model.generateContent(
      `Transcrição da reunião:\n\n${transcript}`
    );
    const text = result.response.text();

    if (!text) throw new Error("Gemini returned empty response for meeting summary");

    const parsed = parseJsonResponse<GeminiSummaryEnvelope>(text);

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Gemini returned an invalid meeting summary envelope");
    }

    if (typeof parsed.summary_whatsapp !== "string" || !parsed.summary_whatsapp.trim()) {
      throw new Error("Gemini returned an invalid WhatsApp summary");
    }

    if (!parsed.summary_json || typeof parsed.summary_json !== "object") {
      throw new Error("Gemini returned an invalid JSON summary");
    }

    if (isUnprocessableTranscriptPayload(parsed.summary_json)) {
      throw new Error(`Transcript was unprocessable: ${parsed.summary_json.reason}`);
    }

    return {
      summaryWhatsapp: parsed.summary_whatsapp,
      summaryJson: parsed.summary_json,
    };
  });
}
