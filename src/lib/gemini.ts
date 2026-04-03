// ─────────────────────────────────────────────────────────────────────────────
// lib/gemini.ts
//
// Módulo de sumarização via Google Gemini.
// Exporta helpers compartilhados pela pipeline de processamento de reuniões:
//   - generateWhatsAppSummary(transcript) → string
//   - generateJsonSummary(transcript)     → MeetingJSON
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { MeetingJSON } from "@/types/database";

// ── Constantes ────────────────────────────────────────────────────────────────

const MODEL_NAME = "gemini-2.5-flash";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const SUMMARY_SCHEMA_VERSION = "1.0";
export const PROMPT_VERSION = "1.0.0";

// ── Prompts do sistema ────────────────────────────────────────────────────────

/**
 * Prompt para geração de resumo formatado para WhatsApp.
 * Usa emojis e linguagem simples conforme spec do produto.
 */
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


/**
 * Prompt para geração de resumo estruturado em JSON.
 * O schema deve ser compatível com MeetingJSON (src/types/database.ts).
 */
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
    "prompt_version": "${PROMPT_VERSION}",
    "total_decisions": "number",
    "total_tasks": "number",
    "total_open_items": "number"
  }
}

Retorne EXATAMENTE este schema. Todos os campos são obrigatórios. Arrays podem estar vazios [].`;

// ── Helpers internos ──────────────────────────────────────────────────────────

/**
 * Retorna um cliente Gemini autenticado com a chave de ambiente GEMINI_API_KEY.
 */
function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment");
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Aguarda `ms` milissegundos — usado para backoff entre tentativas.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executa `fn` com retry automático (até MAX_RETRIES tentativas, backoff de RETRY_DELAY_MS).
 * Lança o último erro se todas as tentativas falharem.
 */
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

// ── Funções públicas ──────────────────────────────────────────────────────────

/**
 * Gera um resumo da transcrição formatado para WhatsApp.
 * Retorna string com emojis e seções em negrito.
 * Equivalente ao Step 3 (summarize-whatsapp) — mesmo contrato de retorno.
 */
export async function generateWhatsAppSummary(transcript: string): Promise<string> {
  return withRetry(async () => {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_WHATSAPP,
    });

    const result = await model.generateContent(
      `Transcrição da reunião:\n\n${transcript}`
    );
    const text = result.response.text();

    if (!text) throw new Error("Gemini returned empty response for WhatsApp summary");
    return text;
  });
}

/**
 * Gera um resumo estruturado da transcrição como objeto MeetingJSON.
 * Retorna JSON com tasks, decisions, open_items etc.
 * Equivalente ao Step 4 (summarize-json) — mesmo contrato de retorno.
 */
export async function generateJsonSummary(transcript: string): Promise<MeetingJSON> {
  return withRetry(async () => {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_JSON,
    });

    const result = await model.generateContent(
      `Transcrição da reunião:\n\n${transcript}`
    );
    const text = result.response.text();

    if (!text) throw new Error("Gemini returned empty response for JSON summary");

    // Tenta parsear diretamente; se falhar, extrai o bloco JSON do texto
    let parsed: MeetingJSON;
    try {
      parsed = JSON.parse(text) as MeetingJSON;
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Failed to parse Gemini JSON response");
      parsed = JSON.parse(jsonMatch[0]) as MeetingJSON;
    }

    // Verifica se o modelo sinalizou transcrição inválida
    if ((parsed as unknown as { error?: string }).error === "UNPROCESSABLE_TRANSCRIPT") {
      throw new Error("Transcript was unprocessable: empty or unintelligible");
    }

    return parsed;
  });
}
