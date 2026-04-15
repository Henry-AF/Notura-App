"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Square,
  Pause,
  Play,
  Mic,
  Users,
  UserPlus,
  Link2,
  Mail,
  Loader2,
  Check,
  X,
  ChevronDown,
  Copy,
} from "lucide-react";
import { PageHeader } from "@/components/ui/app";
import { cn } from "@/lib/utils";
import { fetchCurrentUser } from "../settings/settings-api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
}

interface TranscriptLine {
  id: string;
  text: string;
}

type Stage =
  | "setup"
  | "requesting"
  | "recording"
  | "stopping"
  | "uploading"
  | "done"
  | "error";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0)
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

const PARTICIPANT_COLORS = [
  "rgba(104,81,255,0.3)",
  "rgba(251,191,36,0.3)",
  "rgba(34,197,94,0.3)",
  "rgba(249,115,22,0.3)",
  "rgba(236,72,153,0.3)",
  "rgba(6,182,212,0.3)",
];

function makeParticipant(name: string, email: string, index: number): Participant {
  const initials = name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return {
    id: `${Date.now()}-${index}`,
    name: name.trim() || email.split("@")[0] || "Participante",
    email,
    initials: initials || email[0]?.toUpperCase() || "?",
    color: PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length],
  };
}

// ─── Waveform ─────────────────────────────────────────────────────────────────

const BAR_HEIGHTS = [
  0.35, 0.6, 0.85, 0.5, 0.75, 0.4, 0.9, 0.65, 0.45, 0.8, 0.55, 0.7,
  0.3, 0.95, 0.6, 0.4, 0.75, 0.5, 0.85, 0.45, 0.65, 0.8, 0.35, 0.9,
  0.55, 0.7, 0.4, 0.6, 0.85, 0.5, 0.75, 0.4,
];

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-16 items-end justify-center gap-[3px]" aria-hidden>
      {BAR_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className={cn(
            "w-[3px] rounded-full origin-bottom transition-opacity duration-300",
            active ? "opacity-100" : "opacity-30"
          )}
          style={{
            height: `${Math.round(h * 56 + 8)}px`,
            background: active
              ? "linear-gradient(to top, #6851FF, #8B7AFF)"
              : "rgb(var(--cn-border))",
            animation: active
              ? "waveBar 0.9s ease-in-out infinite alternate"
              : "none",
            animationDelay: `${(i * 37) % 900}ms`,
          }}
        />
      ))}
      <style>{`
        @keyframes waveBar { 0% { transform: scaleY(0.4); } 100% { transform: scaleY(1); } }
        @media (prefers-reduced-motion: reduce) { [style*="waveBar"] { animation: none !important; } }
      `}</style>
    </div>
  );
}

// ─── Stop Confirmation Dialog ─────────────────────────────────────────────────

function StopDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-t-2xl bg-notura-bg-secondary p-6 shadow-xl sm:rounded-2xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-notura-processing/15">
          <Square className="h-6 w-6 text-notura-processing" />
        </div>
        <h2 className="text-center font-manrope font-extrabold text-lg tracking-[-0.3px] text-notura-ink">
          Encerrar gravacao?
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-notura-ink-secondary">
          O audio sera enviado para a IA gerar o resumo e as tarefas. O resumo sera enviado via WhatsApp ao concluir.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-notura-border/40 py-2.5 text-sm font-medium text-notura-ink-secondary transition-colors hover:bg-notura-surface"
          >
            Continuar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-full bg-notura-processing py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            Encerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecordingPage() {
  const router = useRouter();

  // ── Setup form ────────────────────────────────────────────────────────────
  const [meetingTitle, setMeetingTitle] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(true);

  // ── Recording state ───────────────────────────────────────────────────────
  const [stage, setStage] = useState<Stage>("setup");
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showStop, setShowStop] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [meetingId, setMeetingId] = useState("");

  // ── Transcript ────────────────────────────────────────────────────────────
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [partialText, setPartialText] = useState("");
  const transcriptBottomRef = useRef<HTMLDivElement>(null);

  // ── Audio refs ────────────────────────────────────────────────────────────
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isPausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const user = await fetchCurrentUser();
        if (user.whatsappNumber) setWhatsappNumber(user.whatsappNumber);
        if (user.name) setParticipants([makeParticipant(user.name, "", 0)]);
      } catch {
        // ignore load failures and let the user fill the form manually
      }
    }
    void load();
  }, []);

  // ── Pre-fill title from URL ───────────────────────────────────────────────
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("title");
    if (t) setMeetingTitle(t);
  }, []);

  // ── Transcript scroll ─────────────────────────────────────────────────────
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptLines, partialText]);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "recording" || paused) return;
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage, paused]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => cleanupAudio(), []);

  // ─────────────────────────────────────────────────────────────────────────
  // Audio cleanup
  // ─────────────────────────────────────────────────────────────────────────

  function cleanupAudio() {
    if (timerRef.current) clearInterval(timerRef.current);
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioCtxRef.current?.close().catch(() => {});
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ terminate_session: true }));
      }
      wsRef.current?.close();
    } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Start recording
  // ─────────────────────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (!whatsappNumber.trim()) {
      setErrorMsg("Informe o numero WhatsApp para receber o resumo.");
      return;
    }
    setErrorMsg("");
    setStage("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setErrorMsg("Permissao de microfone negada. Habilite o microfone nas configuracoes do navegador.");
      setStage("setup");
      return;
    }
    streamRef.current = stream;

    let token: string;
    try {
      const res = await fetch("/api/assemblyai/token", { method: "POST" });
      if (!res.ok) throw new Error();
      token = ((await res.json()) as { token: string }).token;
    } catch {
      setErrorMsg("Falha ao conectar com o servico de transcricao. Tente novamente.");
      stream.getTracks().forEach((t) => t.stop());
      setStage("setup");
      return;
    }

    const ws = new WebSocket(
      `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`
    );
    wsRef.current = ws;
    isPausedRef.current = false;

    ws.onopen = () => {
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      sourceRef.current = src;
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = proc;
      proc.onaudioprocess = (e) => {
        if (isPausedRef.current || ws.readyState !== WebSocket.OPEN) return;
        const int16 = float32ToInt16(e.inputBuffer.getChannelData(0));
        ws.send(int16.buffer instanceof ArrayBuffer ? int16.buffer : new ArrayBuffer(0));
      };
      src.connect(proc);
      proc.connect(ctx.destination);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as { message_type: string; text?: string };
        if (msg.message_type === "PartialTranscript" && msg.text) {
          setPartialText(msg.text);
        } else if (msg.message_type === "FinalTranscript" && msg.text?.trim()) {
          setTranscriptLines((prev) => [...prev, { id: `${Date.now()}`, text: msg.text! }]);
          setPartialText("");
        }
      } catch {}
    };

    ws.onerror = () => setPartialText("");

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.start(1000);

    setStage("recording");
    setElapsed(0);
  }, [whatsappNumber]);

  // ─────────────────────────────────────────────────────────────────────────
  // Pause / Resume
  // ─────────────────────────────────────────────────────────────────────────

  const handlePause = useCallback(() => {
    isPausedRef.current = true;
    mediaRecorderRef.current?.pause();
    if (timerRef.current) clearInterval(timerRef.current);
    setPaused(true);
  }, []);

  const handleResume = useCallback(() => {
    isPausedRef.current = false;
    mediaRecorderRef.current?.resume();
    setPaused(false);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Stop & upload
  // ─────────────────────────────────────────────────────────────────────────

  const handleStop = useCallback(async () => {
    setShowStop(false);
    setStage("stopping");
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ terminate_session: true }));
      }
      wsRef.current?.close();
    } catch {}

    try {
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      await audioCtxRef.current?.close();
    } catch {}

    const audioBlob = await new Promise<Blob>((resolve) => {
      const rec = mediaRecorderRef.current;
      if (!rec || rec.state === "inactive") {
        resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
        return;
      }
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
      rec.stop();
    });

    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStage("uploading");

    const fd = new FormData();
    fd.append("audio", audioBlob, `recording-${Date.now()}.webm`);
    fd.append("client_name", meetingTitle.trim() || "Nova Reuniao");
    fd.append("whatsapp_number", whatsappNumber.trim());
    fd.append("meeting_date", new Date().toISOString().split("T")[0]);

    try {
      const res = await fetch("/api/meetings/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { meetingId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar reuniao.");
      setMeetingId(data.meetingId ?? "");
      setStage("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao enviar reuniao.");
      setStage("error");
    }
  }, [meetingTitle, whatsappNumber]);

  // ─────────────────────────────────────────────────────────────────────────
  // Participants
  // ─────────────────────────────────────────────────────────────────────────

  const addParticipant = useCallback(() => {
    const email = addEmail.trim();
    const name = addName.trim() || email.split("@")[0];
    if (!email && !name) return;
    setParticipants((prev) => {
      if (email && prev.some((p) => p.email === email)) return prev;
      return [...prev, makeParticipant(name, email, prev.length)];
    });
    setAddEmail("");
    setAddName("");
  }, [addEmail, addName]);

  const removeParticipant = useCallback((id: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const copyInviteLink = useCallback(() => {
    const title = meetingTitle.trim() || "Reuniao";
    const url = `${window.location.origin}/dashboard/recording?title=${encodeURIComponent(title)}`;
    navigator.clipboard.writeText(url).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
  }, [meetingTitle]);

  const isActive = stage === "recording" && !paused;

  // ═════════════════════════════════════════════════════════════════════════
  // SETUP STAGE
  // ═════════════════════════════════════════════════════════════════════════

  if (stage === "setup" || stage === "requesting") {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Reuniões", href: "/dashboard/meetings" },
            { label: "Ao vivo" },
          ]}
          title="Nova Reunião ao vivo"
          description="Configure e inicie a gravação."
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Meeting info + start */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-notura-border/30 bg-notura-surface p-5">
              <h2 className="mb-4 font-manrope font-bold text-base text-notura-ink">
                Informacoes da reuniao
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-notura-ink-secondary">
                    Titulo / Cliente
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Sprint Planning — Empresa X"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    className="w-full rounded-xl border border-notura-border/30 bg-notura-surface-2 px-3.5 py-2.5 text-sm text-notura-ink placeholder:text-notura-ink-secondary/50 outline-none focus:border-notura-primary/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-notura-ink-secondary">
                    WhatsApp para receber o resumo
                  </label>
                  <input
                    type="tel"
                    placeholder="+55 (11) 9 0000-0000"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="w-full rounded-xl border border-notura-border/30 bg-notura-surface-2 px-3.5 py-2.5 text-sm text-notura-ink placeholder:text-notura-ink-secondary/50 outline-none focus:border-notura-primary/60 transition-colors"
                  />
                </div>
              </div>
            </div>

            {errorMsg && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {errorMsg}
              </p>
            )}

            <button
              onClick={handleStart}
              disabled={stage === "requesting"}
              className={cn(
                "flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-base font-semibold text-white transition-all",
                stage === "requesting" ? "cursor-not-allowed opacity-70" : "hover:opacity-90 active:scale-[0.98]"
              )}
              style={{ background: "linear-gradient(135deg, #6851FF, #8B7AFF)", boxShadow: "0 8px 24px -4px rgba(104,81,255,0.4)" }}
            >
              {stage === "requesting" ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Conectando microfone...</>
              ) : (
                <><Mic className="h-5 w-5" /> Iniciar Gravacao</>
              )}
            </button>

            <p className="text-center text-xs text-notura-ink-secondary">
              O navegador pedira permissao para usar o microfone.
            </p>
          </div>

          {/* Participants */}
          <div className="rounded-2xl border border-notura-border/30 bg-notura-surface p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-notura-primary/15">
                <Users className="h-4 w-4 text-notura-primary" />
              </div>
              <h2 className="font-manrope font-bold text-base text-notura-ink">Participantes</h2>
              <span className="ml-auto inline-flex items-center rounded-full bg-notura-primary/15 px-2.5 py-0.5 text-xs font-medium text-notura-primary">
                {participants.length}
              </span>
            </div>

            <div className="mb-4 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-notura-ink-secondary" />
                  <input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addParticipant()}
                    className="w-full rounded-xl border border-notura-border/30 bg-notura-surface-2 pl-9 pr-3 py-2 text-sm text-notura-ink placeholder:text-notura-ink-secondary/50 outline-none focus:border-notura-primary/60 transition-colors"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Nome"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addParticipant()}
                  className="w-28 rounded-xl border border-notura-border/30 bg-notura-surface-2 px-3 py-2 text-sm text-notura-ink placeholder:text-notura-ink-secondary/50 outline-none focus:border-notura-primary/60 transition-colors"
                />
                <button
                  onClick={addParticipant}
                  disabled={!addEmail.trim() && !addName.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-notura-primary/15 text-notura-primary transition-all hover:bg-notura-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <UserPlus className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={copyInviteLink}
                className="flex w-full items-center gap-2 rounded-xl border border-notura-border/30 bg-notura-surface-2 px-3.5 py-2 text-left text-xs text-notura-ink-secondary transition-all hover:border-notura-primary/40 hover:text-notura-ink"
              >
                {inviteCopied ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-notura-success" />
                ) : (
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                )}
                {inviteCopied ? "Link copiado!" : "Copiar link de convite para esta reuniao"}
                <Copy className="ml-auto h-3 w-3 opacity-50" />
              </button>
            </div>

            <ul className="space-y-2">
              {participants.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl bg-notura-surface-2 px-3 py-2.5">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-notura-ink"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-notura-ink">{p.name}</p>
                    {p.email && <p className="truncate text-[11px] text-notura-ink-secondary">{p.email}</p>}
                  </div>
                  {i > 0 && (
                    <button
                      onClick={() => removeParticipant(p.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-notura-ink-secondary hover:bg-notura-surface hover:text-notura-ink transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {participants.length === 0 && (
              <p className="mt-2 text-center text-sm text-notura-ink-secondary">
                Adicione participantes por e-mail ou compartilhe o link.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UPLOADING / STOPPING
  // ═════════════════════════════════════════════════════════════════════════

  if (stage === "stopping" || stage === "uploading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(104,81,255,0.15)" }}>
          <Loader2 className="h-8 w-8 animate-spin text-notura-primary" />
        </div>
        <div>
          <h2 className="font-manrope font-extrabold text-xl text-notura-ink">
            {stage === "stopping" ? "Encerrando gravacao..." : "Enviando para processamento..."}
          </h2>
          <p className="mt-1 text-sm text-notura-ink-secondary">
            {stage === "uploading" ? "A IA ira gerar o resumo e enviar via WhatsApp em breve." : "Coletando audio final..."}
          </p>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // DONE
  // ═════════════════════════════════════════════════════════════════════════

  if (stage === "done") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(34,197,94,0.15)" }}>
          <Check className="h-8 w-8 text-notura-success" />
        </div>
        <div>
          <h2 className="font-manrope font-extrabold text-xl text-notura-ink">Reuniao enviada com sucesso!</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-notura-ink-secondary">
            A IA esta processando o audio, gerando o resumo e as tarefas. Voce recebera o resumo via WhatsApp em breve.
          </p>
        </div>
        <div className="flex gap-3">
          {meetingId && (
            <button
              onClick={() => router.push(`/dashboard/meetings/${meetingId}`)}
              className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #6851FF, #8B7AFF)" }}
            >
              Ver reuniao
            </button>
          )}
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-full border border-notura-border/40 px-6 py-2.5 text-sm font-medium text-notura-ink-secondary transition-colors hover:bg-notura-surface"
          >
            Ir para Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ERROR
  // ═════════════════════════════════════════════════════════════════════════

  if (stage === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(239,68,68,0.15)" }}>
          <X className="h-8 w-8 text-notura-error" />
        </div>
        <div>
          <h2 className="font-manrope font-extrabold text-xl text-notura-ink">Erro ao enviar reuniao</h2>
          <p className="mt-2 max-w-sm text-sm text-notura-ink-secondary">{errorMsg}</p>
        </div>
        <button
          onClick={() => { setStage("setup"); setErrorMsg(""); setElapsed(0); setTranscriptLines([]); setPartialText(""); }}
          className="rounded-full border border-notura-border/40 px-6 py-2.5 text-sm font-medium text-notura-ink-secondary transition-colors hover:bg-notura-surface"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // RECORDING STAGE
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Reuniões", href: "/dashboard/meetings" },
            { label: "Ao vivo" },
          ]}
          title={meetingTitle || "Nova Reunião"}
          description={
            participants.map((p) => p.name).join(", ") || "Gravação em andamento"
          }
          titleClassName="truncate"
          descriptionClassName="max-w-none text-xs text-notura-ink-secondary"
          actions={
            <button
              onClick={() => setShowStop(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-notura-surface text-notura-ink-secondary transition-colors hover:bg-notura-surface-2"
              aria-label="Encerrar gravação"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          }
        />

        {/* Recording card */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border transition-all duration-500",
            isActive ? "border-notura-primary/25 bg-notura-surface" : "border-notura-border/30 bg-notura-surface"
          )}
        >
          {isActive && (
            <div
              className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl"
              style={{ background: "rgba(104,81,255,0.07)" }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center px-6 pb-10 pt-10 sm:px-10">
            {/* Status badge */}
            <div className="mb-8">
              {paused ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-1.5 text-sm font-medium text-amber-400">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Pausado
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-white"
                  style={{ background: "linear-gradient(135deg, #6851FF, #8B7AFF)" }}
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                  </span>
                  Gravando
                </span>
              )}
            </div>

            {/* Timer */}
            <div
              className="mb-2 tabular-nums font-manrope font-extrabold tracking-tight text-notura-ink"
              style={{ fontSize: "clamp(3rem, 10vw, 5.5rem)", lineHeight: 1 }}
            >
              {formatTime(elapsed)}
            </div>
            <p className="mb-10 text-sm text-notura-ink-secondary">
              {paused ? "Gravacao pausada" : "Audio sendo processado em tempo real"}
            </p>

            {/* Waveform */}
            <div className="mb-10 w-full max-w-sm">
              <Waveform active={isActive} />
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={paused ? handleResume : handlePause}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-notura-border/40 bg-notura-surface text-notura-ink-secondary shadow-sm transition-all hover:bg-notura-surface-2 hover:text-notura-ink active:scale-95"
                title={paused ? "Retomar" : "Pausar"}
              >
                {paused ? <Play className="h-5 w-5 translate-x-0.5" /> : <Pause className="h-5 w-5" />}
              </button>
              <button
                onClick={() => setShowStop(true)}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-notura-processing text-white shadow-lg transition-all hover:opacity-90 active:scale-95"
                style={{ boxShadow: "0 8px 20px -4px rgba(228,55,144,0.4)" }}
                title="Encerrar gravacao"
              >
                <Square className="h-6 w-6 fill-white" />
              </button>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-notura-border/40 bg-notura-surface text-notura-ink-secondary shadow-sm">
                <Mic className={cn("h-5 w-5", isActive && "text-notura-primary")} />
              </div>
            </div>
          </div>
        </div>

        {/* Participants + Transcript */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Participants */}
          <div className="rounded-2xl border border-notura-border/30 bg-notura-surface p-5 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-notura-primary/15">
                <Users className="h-4 w-4 text-notura-primary" />
              </div>
              <h2 className="font-manrope font-extrabold tracking-[-0.2px] text-notura-ink">Participantes</h2>
              <span className="ml-auto inline-flex items-center rounded-full bg-notura-primary/15 px-2.5 py-0.5 text-xs font-medium text-notura-primary">
                {participants.length}
              </span>
            </div>
            <ul className="space-y-2.5">
              {participants.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl bg-notura-surface-2 px-3 py-2.5">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-notura-ink"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-notura-ink">{p.name}</p>
                    {p.email && <p className="truncate text-[11px] text-notura-ink-secondary">{p.email}</p>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-notura-border/30 pt-4">
              <p className="mb-2 text-xs font-medium text-notura-ink-secondary">Resumo sera enviado para</p>
              <div className="flex items-center gap-2.5 rounded-xl bg-notura-surface-2 px-3 py-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-notura-success/15">
                  <Mic className="h-3.5 w-3.5 text-notura-success" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-notura-ink">{participants[0]?.name ?? "Organizador"}</p>
                  <p className="text-[11px] text-notura-ink-secondary">{whatsappNumber}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-notura-success/15 px-2 py-0.5 text-[10px] font-medium text-notura-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-notura-success" />
                  WhatsApp
                </span>
              </div>
            </div>
          </div>

          {/* Live transcript */}
          <div className="rounded-2xl border border-notura-border/30 bg-notura-surface lg:col-span-3">
            <button
              onClick={() => setTranscriptOpen((v) => !v)}
              className="flex w-full items-center gap-2.5 p-5"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-notura-primary/15">
                <Mic className="h-4 w-4 text-notura-primary" />
              </div>
              <h2 className="flex-1 text-left font-manrope font-extrabold tracking-[-0.2px] text-notura-ink">
                Transcricao ao vivo
              </h2>
              {isActive && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-notura-primary/15 px-2.5 py-1 text-xs font-medium text-notura-primary">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute h-full w-full animate-ping rounded-full bg-notura-primary opacity-60" />
                    <span className="h-1.5 w-1.5 rounded-full bg-notura-primary" />
                  </span>
                  Ao vivo
                </span>
              )}
              <ChevronDown className={cn("ml-1 h-4 w-4 shrink-0 text-notura-ink-secondary transition-transform duration-200", transcriptOpen && "rotate-180")} />
            </button>

            {transcriptOpen && (
              <div className="relative h-72 border-t border-notura-border/30">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-notura-surface to-transparent" />
                <div className="h-full overflow-y-auto px-5 pb-4 pt-4">
                  {transcriptLines.length === 0 && !partialText ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                      <Mic className="h-8 w-8 text-notura-muted" />
                      <p className="text-sm text-notura-ink-secondary">
                        {paused ? "Transcricao pausada" : "Aguardando fala..."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transcriptLines.map((line) => (
                        <p key={line.id} className="text-sm leading-relaxed text-notura-ink">{line.text}</p>
                      ))}
                      {partialText && (
                        <p className="text-sm leading-relaxed text-notura-ink-secondary italic">{partialText}</p>
                      )}
                      {isActive && (
                        <div className="flex items-center gap-2">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="h-1.5 w-1.5 rounded-full bg-notura-primary"
                              style={{ animation: "typingDot 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }}
                            />
                          ))}
                          <span className="text-[11px] text-notura-ink-secondary">transcrevendo...</span>
                        </div>
                      )}
                      <div ref={transcriptBottomRef} />
                    </div>
                  )}
                </div>
                <style>{`
                  @keyframes typingDot { 0%,80%,100%{transform:scale(0.6);opacity:.4} 40%{transform:scale(1);opacity:1} }
                `}</style>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-notura-ink-secondary">
          Mantenha a guia aberta para garantir a gravacao continua. O resumo sera gerado e enviado via WhatsApp ao encerrar.
        </p>
      </div>

      {showStop && <StopDialog onConfirm={handleStop} onCancel={() => setShowStop(false)} />}
    </>
  );
}
