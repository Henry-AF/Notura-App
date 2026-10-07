"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { buildOAuthCallbackUrl } from "@/lib/auth-redirect";
import { readReferralCookie } from "@/lib/referral-cookie";
import { trackSignupCompleted } from "@/lib/onboarding-funnel/analytics";
import { loadFunnelState } from "@/lib/onboarding-funnel/storage";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  AuthGoogleButton,
  AuthInput,
  AuthOrDivider,
  AuthPasswordInput,
  AuthPrimaryButton,
  AuthSwitchLink,
} from "@/components/auth/AuthFormParts";
import { Checkbox } from "@/components/ui/checkbox";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/** True when the visitor arrives from the acquisition funnel (Aha Moment already seen in this browser). */
function useCameFromFunnel(): boolean {
  const [cameFromFunnel, setCameFromFunnel] = useState(false);
  useEffect(() => {
    setCameFromFunnel(loadFunnelState()?.completed === true);
  }, []);
  return cameFromFunnel;
}

export default function SignupPage() {
  const router = useRouter();
  const cameFromFunnel = useCameFromFunnel();
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
      const referral = readReferralCookie();
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            ...(referral && {
              referral_code: referral.code,
              referral_clicked_at: referral.clickedAt,
            }),
          },
        },
      });

      if (authError) {
        dispatch({ type: "errorChanged", value: authError.message });
        return;
      }

      if (data.user) {
        posthog.capture("user_signed_up", { method: "email" });
        trackSignupCompleted(data.user.id, loadFunnelState(), "email");
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

  const isFormValid =
    name.trim().length > 0 && EMAIL_PATTERN.test(email.trim()) && password.length >= 8;

  return (
    <AuthShell
      variant="centered"
      title={cameFromFunnel ? "Vamos salvar sua experiência no Notura." : "Crie sua conta"}
      description={
        cameFromFunnel
          ? "Crie sua conta para começar a organizar suas próprias reuniões."
          : "Comece a organizar reuniões e tarefas com o padrão Notura."
      }
      sideTitle="Padronize suas decisões em um só lugar."
      sideDescription="Da gravação ao plano de ação, você acompanha tudo com clareza e consistência visual em qualquer dispositivo."
    >
      <form onSubmit={handleSignup} className="space-y-4">
        <AuthInput
          id="name"
          type="text"
          placeholder="Nome completo"
          autoComplete="name"
          value={name}
          onChange={(event) =>
            dispatch({ type: "fieldChanged", field: "name", value: event.target.value })
          }
          required
        />
        <AuthInput
          id="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(event) =>
            dispatch({ type: "fieldChanged", field: "email", value: event.target.value })
          }
          required
        />
        <AuthPasswordInput
          id="password"
          placeholder="Senha (mínimo 8 caracteres)"
          autoComplete="new-password"
          value={password}
          onChange={(event) =>
            dispatch({ type: "fieldChanged", field: "password", value: event.target.value })
          }
          showPassword={showPassword}
          onTogglePassword={() => dispatch({ type: "showPasswordToggled" })}
          minLength={8}
          required
        />

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

        <AuthPrimaryButton
          label="Criar conta gratuitamente"
          loading={loading}
          loadingLabel="Criando conta..."
          disabled={!isFormValid}
        />
      </form>

      <AuthOrDivider />
      <AuthGoogleButton disabled={loading} loading={googleLoading} onClick={handleGoogleAuth} />
      <AuthSwitchLink prefix="Já tem uma conta? " action="Entrar" href="/login" />
    </AuthShell>
  );
}
