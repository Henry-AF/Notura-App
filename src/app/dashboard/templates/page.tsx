"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FileText, Sparkles, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, PageShell, SectionCard } from "@/components/ui/app";
import { ToastProvider, useToast } from "@/components/upload/Toast";
import { fetchCurrentUser } from "@/lib/user/current-user-client";
import {
  InvalidTemplatePlaceholdersError,
  TemplatePlanRequiredError,
  deleteTemplate,
  fetchTemplates,
  uploadTemplate,
  type TemplateOption,
} from "./templates-api";

// Keep this list in sync with ALLOWED_PLACEHOLDERS in src/lib/docx/placeholders.ts
const ATA_PLACEHOLDERS = [
  "meeting_title",
  "meeting_date",
  "participants",
  "objective",
  "executive_summary",
  "topics",
  "decisions",
  "tasks",
  "next_steps",
] as const;

function openUpgradeModal() {
  window.dispatchEvent(new CustomEvent("notura:open-plan-modal"));
}

function LoadingState() {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <div className="size-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function PlanGate({ message }: { message: string }) {
  return (
    <EmptyState
      title="Modelos de ata personalizados são um recurso do plano Pro"
      description={message}
      action={
        <Button type="button" onClick={openUpgradeModal} className="active:scale-[0.96]">
          Ver planos
        </Button>
      }
    />
  );
}

function PlaceholdersGuide() {
  return (
    <SectionCard
      title="Placeholders suportados"
      description="Use estas tags no seu arquivo .docx (ex: {meeting_title}) para que a ata seja preenchida automaticamente."
    >
      <div className="flex flex-wrap gap-2">
        {ATA_PLACEHOLDERS.map((placeholder) => (
          <code
            key={placeholder}
            className="rounded-[10px] bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground"
          >
            {`{${placeholder}}`}
          </code>
        ))}
      </div>
    </SectionCard>
  );
}

function UploadForm({
  isUploading,
  invalidPlaceholders,
  onUpload,
}: {
  isUploading: boolean;
  invalidPlaceholders: string[] | null;
  onUpload: (file: File, name: string) => void;
}) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !name.trim()) return;
    onUpload(file, name.trim());
  }

  return (
    <SectionCard title="Novo modelo" description="Envie um arquivo .docx com as tags de ata.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nome do modelo"
          required
          className="h-11 rounded-[14px] border-0 bg-muted px-4 text-sm text-foreground outline-none focus:bg-background focus:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
        />
        <input
          type="file"
          accept=".docx"
          onChange={(event) => setFile(event.target.files ? event.target.files[0] : null)}
          required
          className="text-sm text-muted-foreground file:mr-3 file:rounded-[10px] file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary"
        />
        {invalidPlaceholders && invalidPlaceholders.length > 0 ? (
          <p className="rounded-[10px] bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Placeholders desconhecidos: {invalidPlaceholders.join(", ")}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={isUploading || !file || !name.trim()}
          className="w-full active:scale-[0.96] sm:w-auto"
        >
          <Upload className="size-4" />
          {isUploading ? "Enviando..." : "Enviar modelo"}
        </Button>
      </form>
    </SectionCard>
  );
}

function TemplateRow({
  template,
  isDeleting,
  onDelete,
}: {
  template: TemplateOption;
  isDeleting: boolean;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
          <FileText className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{template.name}</p>
          {template.isDefault ? (
            <p className="text-xs text-muted-foreground">Modelo padrão do sistema</p>
          ) : null}
        </div>
      </div>
      {template.editable ? (
        confirming ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={() => onDelete(template.id)}
              className="active:scale-[0.96]"
            >
              {isDeleting ? "Removendo..." : "Confirmar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isDeleting}
              onClick={() => setConfirming(false)}
              className="active:scale-[0.96]"
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Excluir modelo ${template.name}`}
            onClick={() => setConfirming(true)}
            className="shrink-0 text-destructive hover:bg-destructive/10 active:scale-[0.96]"
          >
            <Trash2 className="size-4" />
          </Button>
        )
      ) : null}
    </div>
  );
}

function TemplatesList({
  templates,
  deletingId,
  onDelete,
}: {
  templates: TemplateOption[];
  deletingId: string | null;
  onDelete: (id: string) => void;
}) {
  return (
    <SectionCard title="Seus modelos">
      <div className="divide-y divide-border/60">
        {templates.map((template) => (
          <TemplateRow
            key={template.id}
            template={template}
            isDeleting={deletingId === template.id}
            onDelete={onDelete}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function TemplatesPageContent() {
  const { show } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [planGateMessage, setPlanGateMessage] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [invalidPlaceholders, setInvalidPlaceholders] = useState<string[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [currentUser, templateList] = await Promise.all([
          fetchCurrentUser(),
          fetchTemplates(),
        ]);
        if (currentUser.effectivePlan !== "team") {
          setPlanGateMessage(
            "Modelos de ata personalizados estão disponíveis apenas para assinantes do plano Pro."
          );
        }
        setTemplates(templateList);
      } catch (error) {
        show(
          error instanceof Error ? error.message : "Erro ao carregar modelos de ata.",
          "error"
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [show]);

  const handleUpload = useCallback(
    async (file: File, name: string) => {
      setIsUploading(true);
      setInvalidPlaceholders(null);
      try {
        const template = await uploadTemplate(file, name);
        setTemplates((prev) => [template, ...prev]);
        show("Modelo de ata salvo com sucesso.", "success");
      } catch (error) {
        if (error instanceof InvalidTemplatePlaceholdersError) {
          setInvalidPlaceholders(error.unknownPlaceholders);
          show(error.message, "error");
          return;
        }
        if (error instanceof TemplatePlanRequiredError) {
          setPlanGateMessage(error.message);
          return;
        }
        show(
          error instanceof Error ? error.message : "Erro ao salvar modelo de ata.",
          "error"
        );
      } finally {
        setIsUploading(false);
      }
    },
    [show]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        await deleteTemplate(id);
        setTemplates((prev) => prev.filter((template) => template.id !== id));
        show("Modelo removido.", "success");
      } catch (error) {
        show(
          error instanceof Error ? error.message : "Erro ao remover modelo de ata.",
          "error"
        );
      } finally {
        setDeletingId(null);
      }
    },
    [show]
  );

  if (isLoading) return <LoadingState />;
  if (planGateMessage) return <PlanGate message={planGateMessage} />;

  const customTemplates = templates.filter((template) => template.editable);

  return (
    <div className="flex flex-col gap-6">
      <PlaceholdersGuide />
      <UploadForm
        isUploading={isUploading}
        invalidPlaceholders={invalidPlaceholders}
        onUpload={(file, name) => { void handleUpload(file, name); }}
      />
      {customTemplates.length > 0 ? (
        <TemplatesList
          templates={customTemplates}
          deletingId={deletingId}
          onDelete={(id) => { void handleDelete(id); }}
        />
      ) : (
        <EmptyState
          title="Nenhum modelo personalizado ainda"
          description="Envie um arquivo .docx para criar seu primeiro modelo de ata."
        />
      )}
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <ToastProvider>
      <PageShell>
        <PageHeader
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Modelos de Ata" }]}
          title="Modelos de Ata"
          description="Personalize o modelo usado para gerar suas atas em .docx."
          descriptionClassName="max-w-none"
          actions={<Sparkles className="size-6 text-primary" />}
        />
        <TemplatesPageContent />
      </PageShell>
    </ToastProvider>
  );
}
