"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();

    if (!agreed) {
      setError("Você precisa aceitar os Termos de Uso e Privacidade.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      router.push("/onboarding");
    } catch (signupError) {
      setError(formatSignupError(signupError));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/onboarding` },
    });
  }

  return (
    <AuthShell
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
        >
          Continuar com Google
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
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name"
              type="text"
              placeholder="Como devemos te chamar?"
              value={name}
              onChange={(event) => setName(event.target.value)}
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
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="nome@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pl-9 pr-9"
              minLength={8}
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

        <div className="flex items-start gap-3">
          <Checkbox
            id="terms"
            checked={agreed}
            onCheckedChange={(value) => setAgreed(Boolean(value))}
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
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </AuthShell>
  );
}
