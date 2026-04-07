"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function formatSignupError(error: unknown): string {
  if (!error || typeof error !== "object") return "Ocorreu um erro inesperado. Tente novamente.";
  const message = "message" in error && typeof error.message === "string" ? error.message : null;
  const status = "status" in error && (typeof error.status === "number" || typeof error.status === "string") ? String(error.status) : null;
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

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) { setError("Você precisa aceitar os Termos de Uso e Privacidade."); return; }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (authError) { setError(authError.message); return; }
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
    <div className="bg-[#f8f9fc] text-[#191c1e] min-h-screen flex overflow-x-hidden">
      {/* Left: Visual */}
      <section className="hidden lg:flex w-1/2 relative bg-[#630ed4] items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            alt="Abstract 3D shapes"
            className="w-full h-full object-cover opacity-60"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA11R4rorXzS-u8lBjM9lYb0tdRJ2DgjZQGu4fnd-77HuA1BL6nu-j20Rjd-ZQQmZXftvvMvHTdYoVE_14UKbDhE_Fm-v1ov5p57g5QmXV7rAJJ42LBEIHoCj1VsYzeJBCC8AbpCzj4SwQTeL5xxxNuhntilmjCPf1JJT_dpD7A7ecLoTeAtMrhZtMqUV7lfpXen5pFCvRS0-AfI8kbd3DA9OklxmhR85R_G4SNWQMP6mrE9OU4zqjyd6MjpFyF_Jcf940uM75GLcI"
          />
        </div>
        <div className="relative z-10 p-12 max-w-xl">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <span
                className="material-symbols-outlined text-[#630ed4] text-3xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
            </div>
            <span className="text-3xl font-extrabold tracking-tight text-white">Notura AI</span>
          </div>
          <h2 className="text-5xl font-extrabold text-white leading-tight mb-6 tracking-tight">
            Transforme conversas em decisões inteligentes.
          </h2>
          <p className="text-[#ede0ff] text-xl leading-relaxed opacity-90">
            A plataforma editorial para reuniões modernas, focada em clareza, automação e organização impecável.
          </p>
          <div className="mt-12 flex gap-4 items-center">
            <div className="flex -space-x-3">
              <img alt="User" className="w-10 h-10 rounded-full border-2 border-[#630ed4]" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAYckIGO9sXN9b7SoxpE8C5XhdcH_VlzwzWbNbI64AwFWpdckaCmFmb597UFM7vyt9mpiRz-ret3JLMc8xsPlHov75bp4UxSP39bB97l1jbHdmwIZbt6dMcQ-EOa3cY7ZnLHwvEAVXFeFAyVAUwucJiU9ZFfYSlmo0lUHyTrvdRiy0v2cXA04bftIYHoG90py2ptjHPd3p2a6gbMz0R0QgThcOSmbF1OOp8kI6-s7dYRJdGyuWSLGQL16Zfc8smVyzd5Yx4ibg7vEE" />
              <img alt="User" className="w-10 h-10 rounded-full border-2 border-[#630ed4]" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJRdfiQEng3Jn7-VtA5LiAGap5aBWIM3lMDUFQ7iMnbgSWuFF8QrXJwRSo7_e7GLzjPnUJIOg4ftRwDAqk4Hc06AR_hwrY2xzjibgahIseHgd12iGCdZh-GoEFlm7QdREa0U9wBVR4JF33kgwBiwfpzFTf1SRNSxEZwtMYcGj_i_VOX04hK9aEAkJwXcuSYHzdHmm-vpl-w702EzIJZ116QIaIjtenAiRG3AOiuHkmu203rY_lkAbC6fSQs3mfLUe6NFoGzU9Iq9M" />
              <img alt="User" className="w-10 h-10 rounded-full border-2 border-[#630ed4]" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDDGdg7GDsX41LAbeKnBHsjEX99iyGR38Gr7FUYv7iEqBmuYEDc-YGDfqT_2aG40TxEZ8Ez392NConLuuYSdd4IQS34MkmMg0qYcdyB--k4pL8owgSzdXXCWyKt7I2ZeefUlUq6_5yE3wh4yj8URe821nCSI9TLZDez4KqCc0-h69kWtR5U_mZ2YOMLG04VYuw2JlO-8Et_HWt7Y0Q-ELlys9d_lRS33A75lZfpEJ31jcBreeY0GHq7N7i0NrqURd67kkIQ1HjLyP0" />
            </div>
            <div className="text-[#ede0ff] text-sm">
              <span className="font-bold text-white">Mais de 10.000</span> mentes criativas<br />já utilizam o Notura hoje.
            </div>
          </div>
        </div>
        {/* Glow */}
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#2fd9f4] rounded-full blur-[120px] opacity-20 -mb-48 -mr-48 pointer-events-none" />
      </section>

      {/* Right: Form */}
      <section className="w-full lg:w-1/2 flex items-center justify-center bg-[#f8f9fc] p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <span
              className="material-symbols-outlined text-[#630ed4] text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
            <span className="text-xl font-bold tracking-tight text-[#630ed4]">Notura</span>
          </div>

          <div className="mb-10">
            <h1 className="text-3xl font-extrabold text-[#191c1e] mb-3 tracking-tight">
              Crie sua conta no Notura
            </h1>
            <p className="text-[#4a4455] text-base">
              Junte-se a mentes criativas e organize suas reuniões com IA.
            </p>
          </div>

          {/* Social */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
              onClick={handleGoogleAuth}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-white border border-[#ccc3d8]/20 rounded-xl hover:bg-[#f2f3f6] transition-all duration-200 group"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="text-sm font-semibold text-[#191c1e] group-hover:text-[#630ed4] transition-colors">Google</span>
            </button>
            <button
              disabled
              className="flex items-center justify-center gap-2 py-3 px-4 bg-white border border-[#ccc3d8]/20 rounded-xl transition-all duration-200 opacity-50 cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.96.95-2.21 1.72-4.05 1.72-3.13 0-5.46-2.43-5.46-5.83 0-3.32 2.27-5.83 5.46-5.83 1.8 0 3.03.74 3.96 1.63l1.32-1.33c-1.28-1.23-3.04-2.18-5.28-2.18-4.22 0-7.46 3.22-7.46 7.71s3.16 7.71 7.46 7.71c2.42 0 4.34-1.03 5.75-2.48l-1.76-2.13zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
              </svg>
              <span className="text-sm font-semibold text-[#191c1e]">Apple</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center gap-4 mb-8">
            <div className="flex-grow h-px bg-[#ccc3d8]/30" />
            <span className="text-xs font-bold text-[#7b7487] uppercase tracking-widest shrink-0">
              Ou use seu e-mail
            </span>
            <div className="flex-grow h-px bg-[#ccc3d8]/30" />
          </div>

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-xs font-bold text-[#4a4455] uppercase tracking-widest mb-2 px-1">
                Nome completo
              </label>
              <input
                id="name"
                type="text"
                placeholder="Como devemos te chamar?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-white border border-[#ccc3d8]/30 rounded-xl text-[#191c1e] placeholder:text-[#7b7487]/50 focus:outline-none focus:ring-2 focus:ring-[#630ed4]/20 focus:border-[#630ed4] transition-all duration-200"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-bold text-[#4a4455] uppercase tracking-widest mb-2 px-1">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-white border border-[#ccc3d8]/30 rounded-xl text-[#191c1e] placeholder:text-[#7b7487]/50 focus:outline-none focus:ring-2 focus:ring-[#630ed4]/20 focus:border-[#630ed4] transition-all duration-200"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-[#4a4455] uppercase tracking-widest mb-2 px-1">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3.5 pr-12 bg-white border border-[#ccc3d8]/30 rounded-xl text-[#191c1e] placeholder:text-[#7b7487]/50 focus:outline-none focus:ring-2 focus:ring-[#630ed4]/20 focus:border-[#630ed4] transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#7b7487] hover:text-[#630ed4] transition-colors text-[20px]"
                >
                  {showPassword ? "visibility_off" : "visibility"}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3 py-2">
              <input
                id="terms"
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-[#ccc3d8]/30 text-[#630ed4] focus:ring-[#630ed4]/20 bg-white"
              />
              <label htmlFor="terms" className="text-sm text-[#4a4455] leading-tight">
                Ao se inscrever, você concorda com nossos{" "}
                <a href="#" className="text-[#630ed4] font-semibold hover:underline">Termos de Uso</a>{" "}
                e{" "}
                <a href="#" className="text-[#630ed4] font-semibold hover:underline">Privacidade</a>.
              </label>
            </div>

            {error && <p className="text-sm text-[#ba1a1a]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-br from-[#630ed4] to-[#7c3aed] text-white font-bold rounded-full shadow-lg shadow-[#630ed4]/20 hover:shadow-[#630ed4]/30 active:scale-[0.98] transition-all duration-200 mt-4 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? "Criando conta..." : "Criar conta gratuitamente"}
              {!loading && (
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-sm text-[#4a4455]">
            Já tem uma conta?{" "}
            <Link href="/login" className="text-[#630ed4] font-bold hover:underline ml-1">
              Entrar
            </Link>
          </p>
        </div>
      </section>

      {/* Support FAB */}
      <div className="fixed bottom-8 right-8 z-50">
        <button className="flex items-center gap-2 bg-white border border-[#ccc3d8]/20 py-2 px-4 rounded-full shadow-xl hover:bg-[#f2f3f6] transition-all duration-200 group">
          <span className="material-symbols-outlined text-[#630ed4] group-hover:scale-110 transition-transform">help_outline</span>
          <span className="text-sm font-semibold text-[#4a4455]">Suporte</span>
        </button>
      </div>
    </div>
  );
}
