"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

function buildResetRedirectUrl(): string {
  return `${window.location.origin}/reset-password`;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: buildResetRedirectUrl(),
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Nao foi possivel enviar o link de recuperacao. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      breadcrumbs={[
        { label: "Acesso" },
        { label: "Recuperar senha" },
      ]}
      title="Recupere sua senha"
      description="Envie um link de recuperacao para voltar a acessar sua conta."
      sideTitle="Volte ao fluxo da sua operacao sem perder contexto."
      sideDescription="A Notura centraliza reunioes, tarefas e proximos passos. Se voce perdeu a senha, a gente te ajuda a retomar rapido."
      footer={
        <p className="text-center">
          Lembrou sua senha?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Voltar para o login
          </Link>
        </p>
      }
    >
      {success ? (
        <div className="space-y-4 rounded-3xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center gap-3 text-primary">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-semibold">Link enviado</p>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Se existir uma conta para <span className="font-semibold text-foreground">{email}</span>,
            voce vai receber um e-mail com os proximos passos para redefinir a senha.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              E-mail
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="nome@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" className="w-full rounded-full" disabled={loading}>
            {loading ? "Enviando..." : "Enviar link de recuperacao"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
