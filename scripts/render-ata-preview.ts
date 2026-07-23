// Dev tool: renders the default ata template against a real meeting payload
// so a change to default-ata.docx or buildAtaData can be checked visually
// (convert the output docx to PDF/PNG) before merging. Not part of the app.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildAtaData } from "@/lib/docx/meeting-ata-data";
import { renderAtaDocx } from "@/lib/docx/generate-ata";
import type { MeetingWithRelations } from "@/lib/meetings/detail";

const realMeeting = {
  id: "e7cf01d4-5095-4ad3-a059-80e3f9027964",
  title: "Otimização de Processos de Agendamento e Atendimento",
  client_name: null,
  meeting_date: "2026-07-22",
  created_at: "2026-07-22 20:10:32.820523+00",
  summary_json: {
    summary_one_line:
      "A reunião focou na otimização de processos de agendamento e atendimento, com foco na implementação de fluxos de confirmação, cancelamento, lista de espera e gestão de ocupação de salas.",
  },
  summary_structured: {
    title: "Otimização de Processos de Agendamento e Atendimento",
    version: 1,
    sections: [
      {
        title: "Automação de Confirmação e Cancelamento",
        content:
          "Discutiu-se a automação de processos para confirmação de consultas, cancelamentos e notificações. A ideia é que o sistema avance automaticamente após a confirmação do paciente, sem intervenção manual.",
        participant_ids: ["4913a4f6-963d-4029-81c8-c6186e38cfa5"],
      },
      {
        title: "Lista de Espera e Ocupação de Agenda",
        content:
          "Explorou-se a viabilidade de implementar a função 'lista de espera' do TASI para preencher horários vagos após cancelamentos.",
        participant_ids: ["4913a4f6-963d-4029-81c8-c6186e38cfa5"],
      },
      {
        title: "Gestão de Reagendamentos e Notificações",
        content:
          "Abordou-se a complexidade dos reagendamentos e cancelamentos, especialmente quando o médico não define uma nova data.",
        participant_ids: ["4913a4f6-963d-4029-81c8-c6186e38cfa5"],
      },
    ],
    action_items: [],
  },
  summary_whatsapp: "Reunião: Otimização de Processos de Agendamento e Atendimento",
  meeting_participants: [
    { id: "4913a4f6-963d-4029-81c8-c6186e38cfa5", role: "participant", display_name: "Speaker A", original_name: "Speaker A" },
    { id: "a8ffb59c-9de1-4d66-adad-4a047f264e5f", role: "participant", display_name: "Speaker B", original_name: "Speaker B" },
    { id: "2e7e0f70-95ba-4832-9ff3-7af16b26dcb8", role: "participant", display_name: "Speaker D", original_name: "Speaker D" },
    { id: "d306f111-5dfd-4ae2-ab66-62b8cb784a37", role: "participant", display_name: "Speaker E", original_name: "Speaker E" },
    { id: "4f49d45d-9bb7-4427-800f-33e10153bca6", role: "participant", display_name: "Speaker C", original_name: "Speaker C" },
  ],
  decisions: [
    { description: "Implementar um fluxo de notificação para pacientes que cancelam ou não confirmam consultas.", decided_by: "Speaker A" },
    { description: "Priorizar a funcionalidade de lista de espera no TASI.", decided_by: "Speaker A" },
    { description: "Padronizar o envio de notificações de reagendamento com 2 dias de antecedência.", decided_by: "Speaker A" },
    { description: "Criar um indicador de ocupação de salas/consultórios no ambulatório.", decided_by: "Speaker A" },
  ],
  tasks: [
    { description: "Pesquisar e apresentar estatísticas sobre pacientes 60+.", owner: "Speaker A", due_date: null },
    { description: "Implementar a funcionalidade de lista de espera no TASI.", owner: "Speaker A", due_date: null },
    { description: "Definir um fluxo para gestão de reagendamentos e cancelamentos.", owner: "Speaker A", due_date: null },
    { description: "Configurar a geração de relatórios de ocupação de salas/consultórios.", owner: "Speaker A", due_date: null },
  ],
  open_items: [
    { description: "Definir claramente o processo de notificação e reagendamento." },
    { description: "Esclarecer a capacidade de selecionar múltiplos pacientes." },
  ],
} as unknown as MeetingWithRelations;

const defaultTemplatePath = path.join(
  __dirname,
  "..",
  "src",
  "lib",
  "docx",
  "templates",
  "default-ata.docx"
);

const templateBuffer = readFileSync(defaultTemplatePath);
const ataData = buildAtaData(realMeeting);

console.log("=== AtaData shape produced by buildAtaData (real meeting e7cf01d4) ===");
console.log(JSON.stringify(ataData, null, 2));

const docxBuffer = renderAtaDocx(templateBuffer, ataData);
const outPath = path.join(__dirname, "..", "ata-preview-output.docx");
writeFileSync(outPath, docxBuffer);
console.log(`\nRendered docx written to: ${outPath}`);
