"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileAudio,
  X,
  Monitor,
  Video,
  ArrowLeft,
  Chrome,
  ExternalLink,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// ─── File size formatter ────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const ACCEPTED_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
  "audio/wav",
  "audio/ogg",
  "video/mp4",
  "video/webm",
];

const ACCEPTED_EXTENSIONS = ".mp3,.mp4,.m4a,.webm,.wav,.ogg";

// ─── Upload Tab ─────────────────────────────────────────────────────────────

function UploadTab() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [meetingDate, setMeetingDate] = useState("");
  const [clientName, setClientName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (ACCEPTED_TYPES.includes(dropped.type) || dropped.name.match(/\.(mp3|mp4|m4a|webm|wav|ogg)$/i))) {
      setFile(dropped);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) setFile(selected);
    },
    []
  );

  const handleProcess = useCallback(() => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    const formData = new FormData();
    formData.append("audio", file);
    if (clientName.trim()) formData.append("client_name", clientName.trim());
    if (meetingDate) formData.append("meeting_date", meetingDate);
    formData.append("whatsapp_number", whatsappNumber.trim());

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 201) {
        const data = JSON.parse(xhr.responseText) as { meetingId: string };
        router.push(`/dashboard/meetings/${data.meetingId}`);
      } else {
        let message = "Erro ao enviar arquivo. Tente novamente.";
        try {
          const data = JSON.parse(xhr.responseText) as { error?: string };
          if (data.error) message = data.error;
        } catch { /* ignore */ }
        setUploadError(message);
        setUploading(false);
        setUploadProgress(0);
      }
    });

    xhr.addEventListener("error", () => {
      setUploadError("Falha de conexão. Verifique sua internet e tente novamente.");
      setUploading(false);
      setUploadProgress(0);
    });

    xhr.open("POST", "/api/meetings/upload");
    xhr.send(formData);
  }, [file, clientName, meetingDate, whatsappNumber, router]);

  const removeFile = useCallback(() => {
    setFile(null);
    setUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-all",
            dragActive
              ? "border-violet-400 bg-violet-50"
              : "border-notura-border bg-gray-50 hover:border-violet-300 hover:bg-violet-50/40"
          )}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-violet-100">
            <Upload className="h-6 w-6 text-violet-600" />
          </div>
          <p className="mt-4 text-sm font-medium text-notura-ink">
            Arraste o áudio aqui ou clique para escolher
          </p>
          <p className="mt-1.5 text-xs text-notura-secondary">
            MP3, MP4, M4A, WEBM, WAV, OGG — máx. 500MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      ) : (
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100">
              <FileAudio className="h-5 w-5 text-violet-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-notura-ink">
                {file.name}
              </p>
              <p className="text-xs text-notura-secondary">
                {formatFileSize(file.size)}
              </p>
              {uploading && (
                <div className="mt-2">
                  <Progress value={Math.min(uploadProgress, 100)} />
                  <p className="mt-1 text-xs text-notura-secondary">
                    {uploadProgress >= 100
                      ? "Upload concluído — processando..."
                      : `Enviando... ${Math.round(Math.min(uploadProgress, 100))}%`}
                  </p>
                </div>
              )}
            </div>
            {!uploading && (
              <button
                onClick={removeFile}
                className="shrink-0 rounded-md p-1.5 text-notura-secondary hover:bg-gray-100 hover:text-notura-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-notura-ink">
            Data
          </label>
          <Input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-notura-ink">
            Cliente
          </label>
          <Input
            placeholder="Nome do cliente (opcional)"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-notura-ink">
            WhatsApp para entrega
          </label>
          <Input
            placeholder="+55 (11) 99999-9999"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
          />
        </div>
      </div>

      {uploadError && (
        <p className="text-sm text-red-500">{uploadError}</p>
      )}

      <Button
        onClick={handleProcess}
        disabled={!file || uploading || !whatsappNumber.trim()}
        className="w-full gap-2 sm:w-auto"
      >
        <Upload className="h-4 w-4" />
        Processar reunião
      </Button>
    </div>
  );
}

// ─── Google Meet Tab ────────────────────────────────────────────────────────

function GoogleMeetTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Chrome className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">
                Instale a extensão Notura para Chrome
              </CardTitle>
              <CardDescription>
                Capture automaticamente suas reuniões no Google Meet
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="secondary" className="gap-2" asChild>
            <a href="#" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Baixar extensão do Chrome
            </a>
          </Button>

          <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
            <span className="text-sm text-notura-secondary">
              Extensão não detectada
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Monitor className="mx-auto h-8 w-8 text-notura-secondary" />
          <p className="mt-3 text-sm text-notura-secondary">
            Após instalar a extensão, suas reuniões do Google Meet aparecerão
            aqui automaticamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Zoom Tab ───────────────────────────────────────────────────────────────

function ZoomTab() {
  const [zoomUrl, setZoomUrl] = useState("");

  const steps = [
    "Acesse as configurações do Zoom e ative a gravação na nuvem",
    "Após a reunião, copie o link da gravação no portal do Zoom",
    'Cole o link abaixo e clique em "Importar gravação"',
  ];

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-notura-ink">
          Cole o link da gravação na nuvem do Zoom
        </label>
        <Input
          placeholder="https://zoom.us/rec/share/..."
          value={zoomUrl}
          onChange={(e) => setZoomUrl(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Como ativar a gravação em nuvem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
                  {i + 1}
                </span>
                <span className="text-sm text-notura-ink leading-relaxed">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Button disabled={!zoomUrl.trim()} className="gap-2">
        <Video className="h-4 w-4" />
        Importar gravação
      </Button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NewMeetingPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold text-notura-ink">
            Nova Reunião
          </h1>
          <p className="mt-0.5 text-sm text-notura-secondary">
            Escolha como deseja capturar sua reunião
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload de arquivo
          </TabsTrigger>
          <TabsTrigger value="meet" className="gap-2">
            <Monitor className="h-4 w-4" />
            Google Meet
          </TabsTrigger>
          <TabsTrigger value="zoom" className="gap-2">
            <Video className="h-4 w-4" />
            Zoom
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <UploadTab />
        </TabsContent>

        <TabsContent value="meet">
          <GoogleMeetTab />
        </TabsContent>

        <TabsContent value="zoom">
          <ZoomTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
