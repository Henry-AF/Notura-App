"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

function getPasswordMismatchMessage(): string {
  return "As senhas nao coincidem.";
}

function getPasswordLengthMessage(): string {
  return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message);
        setHasRecoverySession(false);
        return;
      }

      setHasRecoverySession(Boolean(data.session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasRecoverySession(Boolean(session));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(getPasswordLengthMessage());
      return;
    }

    if (password !== confirmPassword) {
      setError(getPasswordMismatchMessage());
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 1200);
    } catch {
      setError("Nao foi possivel redefinir sua senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      breadcrumbs={[
        { label: "Acesso" },
        { label: "Nova senha" },
      ]}
      title="Defina uma nova senha"
      description="Crie uma nova senha para voltar ao painel com seguranca."
      sideTitle="Retome sua rotina com rapidez e clareza."
      sideDescription="Assim que a senha for atualizada, voce volta para a Notura com o mesmo contexto das suas reunioes e tarefas."
      footer={
        <p className="text-center">
          Prefere tentar de novo?{" "}
          <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
            Solicitar outro link
          </Link>
        </p>
      }
    >
      {success ? (
        <div className="space-y-3 rounded-3xl border border-primary/20 bg-primary/5 p-5">
          <p className="font-semibold text-primary">Senha atualizada com sucesso.</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Voce sera redirecionado para o login em instantes.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              Nova senha
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pl-9 pr-9"
                minLength={MIN_PASSWORD_LENGTH}
                placeholder="Minimo 8 caracteres"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              Confirmar senha
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="pl-9"
                minLength={MIN_PASSWORD_LENGTH}
                placeholder="Repita sua nova senha"
                required
              />
            </div>
          </div>

          {hasRecoverySession === false ? (
            <p className="text-sm text-destructive">
              Este link de recuperacao esta invalido ou expirou. Solicite um novo link para continuar.
            </p>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={loading || hasRecoverySession === false}
          >
            {loading ? "Atualizando..." : "Salvar nova senha"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
