"use client";

import Link from "next/link";
import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { buildOAuthCallbackUrl } from "@/lib/auth-redirect";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

function formatSignupError(error: unknown): string {
  if (!error || typeof error !== "object") return "Ocorreu um erro inesperado. Tente novamente.";
  const message =
    "message" in error && typeof error.message === "string" ? error.message : null;
  const status =
    "status" in error &&
    (typeof error.status === "number" || typeof error.status === "string")
      ? String(error.status)
      : null;
  const code = "code" in error && typeof error.code === "string" ? error.code : null;

  if (!message) return "Ocorreu um erro inesperado. Tente novamente.";

  const details = [code, status ? `status ${status}` : null].filter(Boolean);
  return details.length > 0 ? `${message} (${details.join(" | ")})` : message;
}

type SignupState = {
  name: string;
  email: string;
  password: string;
  showPassword: boolean;
  agreed: boolean;
  loading: boolean;
  googleLoading: boolean;
  error: string | null;
};

type SignupAction =
  | { type: "fieldChanged"; field: "name" | "email" | "password"; value: string }
  | { type: "showPasswordToggled" }
  | { type: "agreementChanged"; value: boolean }
  | { type: "loadingChanged"; value: boolean }
  | { type: "googleLoadingChanged"; value: boolean }
  | { type: "errorChanged"; value: string | null };

const initialSignupState: SignupState = {
  name: "",
  email: "",
  password: "",
  showPassword: false,
  agreed: false,
  loading: false,
  googleLoading: false,
  error: null,
};

function signupReducer(state: SignupState, action: SignupAction): SignupState {
  switch (action.type) {
    case "fieldChanged":
      return { ...state, [action.field]: action.value };
    case "showPasswordToggled":
      return { ...state, showPassword: !state.showPassword };
    case "agreementChanged":
      return { ...state, agreed: action.value };
    case "loadingChanged":
      return { ...state, loading: action.value };
    case "googleLoadingChanged":
      return { ...state, googleLoading: action.value };
    case "errorChanged":
      return { ...state, error: action.value };
  }
}

export default function SignupPage() {
  const router = useRouter();
  const [state, dispatch] = useReducer(signupReducer, initialSignupState);
  const {
    name,
    email,
    password,
    showPassword,
    agreed,
    loading,
    googleLoading,
    error,
  } = state;

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();

    if (!agreed) {
      dispatch({
        type: "errorChanged",
        value: "Você precisa aceitar os Termos de Uso e Privacidade.",
      });
      return;
    }

    dispatch({ type: "loadingChanged", value: true });
    dispatch({ type: "errorChanged", value: null });

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
        },
      });

      if (authError) {
        dispatch({ type: "errorChanged", value: authError.message });
        return;
      }

      if (data.user) {
        posthog.identify(data.user.id);
        posthog.capture("user_signed_up", { method: "email" });
      }
      router.push("/onboarding");
    } catch (signupError) {
      dispatch({ type: "errorChanged", value: formatSignupError(signupError) });
    } finally {
      dispatch({ type: "loadingChanged", value: false });
    }
  }

  async function handleGoogleAuth() {
    if (!agreed) {
      dispatch({
        type: "errorChanged",
        value: "Você precisa aceitar os Termos de Uso e Privacidade para continuar.",
      });
      return;
    }
    dispatch({ type: "googleLoadingChanged", value: true });
    dispatch({ type: "errorChanged", value: null });
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildOAuthCallbackUrl(window.location.origin, "/onboarding"),
        },
      });
      if (oauthError) dispatch({ type: "errorChanged", value: oauthError.message });
    } catch {
      dispatch({
        type: "errorChanged",
        value: "Não foi possível conectar com o Google. Tente novamente.",
      });
    } finally {
      dispatch({ type: "googleLoadingChanged", value: false });
    }
  }

  return (
    <AuthShell
      breadcrumbs={[
        { label: "Acesso" },
        { label: "Criar conta" },
      ]}
      title="Crie sua conta"
      description="Comece a organizar reuniões e tarefas com o padrão Notura."
      sideTitle="Padronize suas decisões em um só lugar."
      sideDescription="Da gravação ao plano de ação, você acompanha tudo com clareza e consistência visual em qualquer dispositivo."
      footer={
        <p className="text-center">
          Já tem uma conta?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Entrar
          </Link>
        </p>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={handleGoogleAuth}
          disabled={googleLoading || loading}
        >
          {googleLoading ? (
            "Redirecionando..."
          ) : (
            <>
              <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continuar com Google
            </>
          )}
        </Button>
        <Button type="button" variant="outline" className="rounded-full" disabled>
          Apple (em breve)
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Ou use seu e-mail
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSignup} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="name" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Nome completo
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name"
              type="text"
              placeholder="Como devemos te chamar?"
              value={name}
              onChange={(event) =>
                dispatch({
                  type: "fieldChanged",
                  field: "name",
                  value: event.target.value,
                })
              }
              className="pl-9"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            E-mail
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="nome@empresa.com"
              value={email}
              onChange={(event) =>
                dispatch({
                  type: "fieldChanged",
                  field: "email",
                  value: event.target.value,
                })
              }
              className="pl-9"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Senha
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(event) =>
                dispatch({
                  type: "fieldChanged",
                  field: "password",
                  value: event.target.value,
                })
              }
              className="pl-9 pr-9"
              minLength={8}
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

        <div className="flex items-start gap-3">
          <Checkbox
            id="terms"
            checked={agreed}
            onCheckedChange={(value) =>
              dispatch({ type: "agreementChanged", value: Boolean(value) })
            }
            className="mt-0.5"
          />
          <label htmlFor="terms" className="text-sm leading-relaxed text-muted-foreground">
            Ao se inscrever, você concorda com nossos{" "}
            <span className="font-semibold text-foreground">Termos de Uso</span> e{" "}
            <span className="font-semibold text-foreground">Privacidade</span>.
          </label>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" className="w-full rounded-full" disabled={loading}>
          {loading ? "Criando conta..." : "Criar conta gratuitamente"}
          <ArrowRight className="size-4" />
        </Button>
      </form>
    </AuthShell>
  );
}
