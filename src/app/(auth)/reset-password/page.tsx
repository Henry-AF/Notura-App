"use client";

import Link from "next/link";
import { useEffect, useReducer } from "react";
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

type ResetPasswordState = {
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  loading: boolean;
  error: string | null;
  success: boolean;
  hasRecoverySession: boolean | null;
};

type ResetPasswordAction =
  | { type: "fieldChanged"; field: "password" | "confirmPassword"; value: string }
  | { type: "showPasswordToggled" }
  | { type: "submitStarted" }
  | { type: "submitFinished" }
  | { type: "errorChanged"; value: string | null }
  | { type: "passwordUpdated" }
  | { type: "sessionChecked"; hasRecoverySession: boolean; error?: string };

const initialResetPasswordState: ResetPasswordState = {
  password: "",
  confirmPassword: "",
  showPassword: false,
  loading: false,
  error: null,
  success: false,
  hasRecoverySession: null,
};

function resetPasswordReducer(
  state: ResetPasswordState,
  action: ResetPasswordAction
): ResetPasswordState {
  switch (action.type) {
    case "fieldChanged":
      return { ...state, [action.field]: action.value };
    case "showPasswordToggled":
      return { ...state, showPassword: !state.showPassword };
    case "submitStarted":
      return { ...state, loading: true, error: null };
    case "submitFinished":
      return { ...state, loading: false };
    case "errorChanged":
      return { ...state, error: action.value };
    case "passwordUpdated":
      return { ...state, success: true };
    case "sessionChecked":
      return {
        ...state,
        hasRecoverySession: action.hasRecoverySession,
        error: action.error ?? state.error,
      };
  }
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, dispatch] = useReducer(
    resetPasswordReducer,
    initialResetPasswordState
  );
  const {
    password,
    confirmPassword,
    showPassword,
    loading,
    error,
    success,
    hasRecoverySession,
  } = state;

  useEffect(() => {
    const supabase = createClient();

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        dispatch({
          type: "sessionChecked",
          hasRecoverySession: false,
          error: sessionError.message,
        });
        return;
      }

      dispatch({
        type: "sessionChecked",
        hasRecoverySession: Boolean(data.session),
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        dispatch({
          type: "sessionChecked",
          hasRecoverySession: Boolean(session),
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      dispatch({ type: "errorChanged", value: getPasswordLengthMessage() });
      return;
    }

    if (password !== confirmPassword) {
      dispatch({ type: "errorChanged", value: getPasswordMismatchMessage() });
      return;
    }

    dispatch({ type: "submitStarted" });

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        dispatch({ type: "errorChanged", value: updateError.message });
        return;
      }

      dispatch({ type: "passwordUpdated" });
      setTimeout(() => router.push("/login"), 1200);
    } catch {
      dispatch({
        type: "errorChanged",
        value: "Nao foi possivel redefinir sua senha. Tente novamente.",
      });
    } finally {
      dispatch({ type: "submitFinished" });
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
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) =>
                  dispatch({
                    type: "fieldChanged",
                    field: "password",
                    value: event.target.value,
                  })
                }
                className="pl-9 pr-9"
                minLength={MIN_PASSWORD_LENGTH}
                placeholder="Minimo 8 caracteres"
                required
              />
              <button
                type="button"
                onClick={() => dispatch({ type: "showPasswordToggled" })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) =>
                  dispatch({
                    type: "fieldChanged",
                    field: "confirmPassword",
                    value: event.target.value,
                  })
                }
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
            <ArrowRight className="size-4" />
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
