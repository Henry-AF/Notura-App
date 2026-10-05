"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReducer, type FormEvent } from "react";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { buildOAuthCallbackUrl } from "@/lib/auth-redirect";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  AuthGoogleButton,
  AuthInput,
  AuthOrDivider,
  AuthPasswordInput,
  AuthPrimaryButton,
  AuthSwitchLink,
} from "@/components/auth/AuthFormParts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type LoginState = {
  email: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  googleLoading: boolean;
  error: string | null;
};

type LoginAction =
  | { type: "fieldChanged"; field: "email" | "password"; value: string }
  | { type: "showPasswordToggled" }
  | { type: "loginStarted" }
  | { type: "loginFinished" }
  | { type: "googleStarted" }
  | { type: "googleFinished" }
  | { type: "errorChanged"; value: string | null };

const initialLoginState: LoginState = {
  email: "",
  password: "",
  showPassword: false,
  loading: false,
  googleLoading: false,
  error: null,
};

function loginReducer(state: LoginState, action: LoginAction): LoginState {
  switch (action.type) {
    case "fieldChanged":
      return { ...state, [action.field]: action.value };
    case "showPasswordToggled":
      return { ...state, showPassword: !state.showPassword };
    case "loginStarted":
      return { ...state, loading: true, error: null };
    case "loginFinished":
      return { ...state, loading: false };
    case "googleStarted":
      return { ...state, googleLoading: true, error: null };
    case "googleFinished":
      return { ...state, googleLoading: false };
    case "errorChanged":
      return { ...state, error: action.value };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [state, dispatch] = useReducer(loginReducer, initialLoginState);
  const { email, password, showPassword, loading, googleLoading, error } = state;

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch({ type: "loginStarted" });

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        dispatch({ type: "errorChanged", value: authError.message });
        dispatch({ type: "loginFinished" });
        return;
      }

      if (data.user) {
        posthog.identify(data.user.id);
        posthog.capture("user_logged_in", { method: "email" });
      }
      router.replace("/dashboard");
    } catch {
      dispatch({
        type: "errorChanged",
        value: "Ocorreu um erro inesperado. Tente novamente.",
      });
      dispatch({ type: "loginFinished" });
    }
  }

  function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    void handleLogin(event);
  }

  async function handleGoogleAuth() {
    dispatch({ type: "googleStarted" });
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildOAuthCallbackUrl(window.location.origin, "/dashboard"),
        },
      });
      if (oauthError) {
        dispatch({ type: "errorChanged", value: oauthError.message });
        dispatch({ type: "googleFinished" });
      }
    } catch {
      dispatch({
        type: "errorChanged",
        value: "Não foi possível conectar com o Google. Tente novamente.",
      });
      dispatch({ type: "googleFinished" });
    }
  }

  function handleGoogleClick() {
    void handleGoogleAuth();
  }

  return (
    <AuthShell
      variant="centered"
      title="Bem-vindo de volta!"
      description="Entre na sua conta para continuar organizando suas reuniões"
      sideTitle="Transforme reuniões em decisões acionáveis."
      sideDescription="Notura organiza tudo para você com IA, mantendo contexto, tarefas e próximos passos sempre centralizados."
    >
      <LoginForm
        email={email} error={error} loading={loading} password={password}
        showPassword={showPassword}
        onEmailChange={(value) =>
          dispatch({ type: "fieldChanged", field: "email", value })
        }
        onPasswordChange={(value) =>
          dispatch({ type: "fieldChanged", field: "password", value })
        }
        onSubmit={handleLoginSubmit}
        onTogglePassword={() => dispatch({ type: "showPasswordToggled" })}
      />
      <AuthOrDivider />
      <AuthGoogleButton disabled={loading} loading={googleLoading} onClick={handleGoogleClick} />
      <AuthSwitchLink prefix="Novo por aqui? Crie um " action="Cadastro" href="/signup" />
    </AuthShell>
  );
}

interface LoginFormProps {
  email: string;
  error: string | null;
  loading: boolean;
  password: string;
  showPassword: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTogglePassword: () => void;
}

function LoginForm({
  email,
  error,
  loading,
  password,
  showPassword,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onTogglePassword,
}: LoginFormProps) {
  const isFormValid = EMAIL_PATTERN.test(email.trim()) && password.length > 0;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <AuthInput
        id="email"
        type="email"
        name="email"
        placeholder="Email"
        autoComplete="email"
        autoCapitalize="none"
        value={email}
        onChange={(event) => onEmailChange(event.target.value)}
        required
      />
      <AuthPasswordInput
        id="password"
        name="password"
        placeholder="Senha"
        autoComplete="current-password"
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
        showPassword={showPassword}
        onTogglePassword={onTogglePassword}
        required
      />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-xs text-foreground hover:underline">
          Esqueceu a senha?
        </Link>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <AuthPrimaryButton
        label="Sign In"
        loading={loading}
        loadingLabel="Entrando..."
        disabled={!isFormValid}
      />
    </form>
  );
}
