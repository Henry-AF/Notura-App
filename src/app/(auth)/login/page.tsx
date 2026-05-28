"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { buildOAuthCallbackUrl } from "@/lib/auth-redirect";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const loginBreadcrumbs = [{ label: "Acesso" }, { label: "Entrar" }];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      posthog.identify(email, { email });
      posthog.capture("user_logged_in", { method: "email" });
      router.replace("/dashboard");
    } catch {
      setError("Ocorreu um erro inesperado. Tente novamente.");
      setLoading(false);
    }
  }

  function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    void handleLogin(event);
  }

  async function handleGoogleAuth() {
    setGoogleLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildOAuthCallbackUrl(window.location.origin, "/dashboard"),
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setGoogleLoading(false);
      }
    } catch {
      setError("Não foi possível conectar com o Google. Tente novamente.");
      setGoogleLoading(false);
    }
  }

  function handleGoogleClick() {
    void handleGoogleAuth();
  }

  return (
    <AuthShell
      breadcrumbs={loginBreadcrumbs}
      title="Bem-vindo de volta"
      description="Entre na sua conta para continuar organizando suas reuniões."
      sideTitle="Transforme reuniões em decisões acionáveis."
      sideDescription="Notura organiza tudo para você com IA, mantendo contexto, tarefas e próximos passos sempre centralizados."
      footer={<LoginFooter />}
    >
      <LoginForm
        email={email} error={error} loading={loading} password={password}
        showPassword={showPassword} onEmailChange={setEmail}
        onPasswordChange={setPassword} onSubmit={handleLoginSubmit}
        onTogglePassword={() => setShowPassword((value) => !value)}
      />
      <AuthDivider />
      <GoogleAuthButton disabled={loading} loading={googleLoading} onClick={handleGoogleClick} />
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
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <EmailField email={email} onEmailChange={onEmailChange} />
      <PasswordField
        password={password}
        showPassword={showPassword}
        onPasswordChange={onPasswordChange}
        onTogglePassword={onTogglePassword}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <SubmitButton loading={loading} />
    </form>
  );
}

interface EmailFieldProps {
  email: string;
  onEmailChange: (value: string) => void;
}

function EmailField({ email, onEmailChange }: EmailFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
          onChange={(event) => onEmailChange(event.target.value)}
          className="pl-9"
          required
        />
      </div>
    </div>
  );
}

interface PasswordFieldProps {
  password: string;
  showPassword: boolean;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
}

function PasswordField({
  password,
  showPassword,
  onPasswordChange,
  onTogglePassword,
}: PasswordFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Senha
        </label>
        <Link
          href="/forgot-password"
          className="text-xs font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
        >
          Esqueceu a senha?
        </Link>
      </div>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="password"
          type={showPassword ? "text" : "password"}
          name="password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          className="pl-9 pr-9"
          required
        />
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <Button type="submit" className="w-full rounded-full" disabled={loading}>
      {loading ? "Entrando..." : "Entrar"}
      <ArrowRight className="h-4 w-4" />
    </Button>
  );
}

function AuthDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Ou continue com
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

interface GoogleAuthButtonProps {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

function GoogleAuthButton({ disabled, loading, onClick }: GoogleAuthButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full rounded-full"
      onClick={onClick}
      disabled={loading || disabled}
    >
      {loading ? (
        "Redirecionando..."
      ) : (
        <>
          <GoogleIcon />
          Continuar com Google
        </>
      )}
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
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
  );
}

function LoginFooter() {
  return (
    <p className="text-center">
      Não tem uma conta?{" "}
      <Link href="/signup" className="font-semibold text-primary hover:underline">
        Criar conta
      </Link>
    </p>
  );
}
