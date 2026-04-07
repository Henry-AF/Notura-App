"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError(authError.message); return; }
      router.push("/dashboard");
    } catch {
      setError("Ocorreu um erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  }

  return (
    <div className="bg-[#f8f9fc] text-[#191c1e] min-h-screen flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="w-full absolute top-0 left-0 flex items-center justify-between px-8 py-6 z-50">
        <Link href="/" className="text-2xl font-black text-[#191c1e] tracking-tight">
          Notura
        </Link>
      </header>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center relative p-6 min-h-screen">
        {/* Background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[60%] bg-[#630ed4]/5 rounded-full blur-[120px]" />
          <div className="absolute top-[20%] -right-[10%] w-[35%] h-[55%] bg-[#a2eeff]/10 rounded-full blur-[100px]" />
        </div>

        <div className="w-full max-w-[1100px] grid lg:grid-cols-2 gap-0 overflow-hidden bg-white rounded-2xl shadow-[0_10px_30px_rgba(124,58,237,0.08)] border border-[#ccc3d8]/15">
          {/* Visual side */}
          <div className="hidden lg:flex relative flex-col justify-end p-12 bg-[#f2f3f6] overflow-hidden">
            <div className="absolute inset-0 z-0">
              <img
                className="w-full h-full object-cover opacity-90"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB1SLEVuI-wafawZvgkHFdJ1XVFEDNsMyCroqj-_WuDmAnqQgNvYZKE0v8K-PkRwXvoQ7QwYLgPUrdSV4s7T2fE7kSRfoGAJyGoZSu5TShB_op82Rm2rpkJCKWl7qL4FtL6M9km64YYKqbVfO-L1lIJweUCQEfRa6G9xoMfIai5Zx7Oz692j6CS6Wzj-4RQep-d0KDr08wDKRkCKrL7EmSEK-v24MFFMlhsrYMD0B4k7GjbW1BrMgj5QRAck8Ba5MsEGkmXwldUDX0"
                alt="Abstract 3D shapes in purple and cyan"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#f2f3f6] via-transparent to-transparent" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#a2eeff] text-[#001f25] text-[10px] font-bold tracking-widest uppercase">
                Inteligência Artificial
              </div>
              <h2 className="text-3xl font-bold text-[#191c1e] tracking-tight leading-tight">
                Transforme suas conversas em decisões estratégicas.
              </h2>
              <p className="text-[#4a4455] text-sm max-w-md leading-relaxed">
                Utilizamos IA de ponta para capturar cada detalhe, permitindo que você foque no que realmente importa: a conexão humana.
              </p>
            </div>
          </div>

          {/* Form side */}
          <div className="p-8 md:p-12 lg:p-16 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full space-y-8">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-[#191c1e] tracking-tight">
                  Bem-vindo de volta
                </h1>
                <p className="text-[#4a4455] text-sm leading-relaxed">
                  Entre na sua conta para gerenciar suas reuniões e insights.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-4">
                  {/* Email */}
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="block text-[10px] font-bold tracking-widest uppercase text-[#7b7487] ml-1"
                    >
                      E-mail
                    </label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#7b7487] group-focus-within:text-[#630ed4] transition-colors text-[20px]">
                        mail
                      </span>
                      <input
                        id="email"
                        type="email"
                        name="email"
                        placeholder="nome@exemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full pl-12 pr-4 py-3.5 bg-[#f2f3f6] border-0 focus:outline-none focus:ring-2 focus:ring-[#630ed4]/20 rounded-xl text-[#191c1e] placeholder:text-[#7b7487]/50 transition-all"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label
                        htmlFor="password"
                        className="block text-[10px] font-bold tracking-widest uppercase text-[#7b7487]"
                      >
                        Senha
                      </label>
                      <button
                        type="button"
                        className="text-[10px] font-bold tracking-widest uppercase text-[#5a00c6] hover:text-[#630ed4] transition-colors"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#7b7487] group-focus-within:text-[#630ed4] transition-colors text-[20px]">
                        lock
                      </span>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-12 pr-12 py-3.5 bg-[#f2f3f6] border-0 focus:outline-none focus:ring-2 focus:ring-[#630ed4]/20 rounded-xl text-[#191c1e] placeholder:text-[#7b7487]/50 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#7b7487] hover:text-[#191c1e] transition-colors text-[20px]"
                      >
                        {showPassword ? "visibility_off" : "visibility"}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-[#ba1a1a]">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#630ed4] to-[#7c3aed] py-4 rounded-full text-white font-bold tracking-tight hover:shadow-lg hover:shadow-[#630ed4]/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span>{loading ? "Entrando..." : "Entrar"}</span>
                  {!loading && (
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative flex items-center gap-4 py-2">
                <div className="flex-grow h-px bg-[#ccc3d8]/30" />
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#7b7487] shrink-0">
                  Ou entre com
                </span>
                <div className="flex-grow h-px bg-[#ccc3d8]/30" />
              </div>

              {/* Social */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleGoogleAuth}
                  className="flex items-center justify-center gap-3 py-3 px-4 bg-[#f2f3f6] hover:bg-[#e1e2e5] transition-colors rounded-xl font-medium text-sm"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span className="text-[#4a4455] font-semibold">Google</span>
                </button>
                <button
                  disabled
                  className="flex items-center justify-center gap-3 py-3 px-4 bg-[#f2f3f6] hover:bg-[#e1e2e5] transition-colors rounded-xl font-medium text-sm opacity-50 cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.05 20.28c-.96.95-2.21 1.72-4.05 1.72-3.13 0-5.46-2.43-5.46-5.83 0-3.32 2.27-5.83 5.46-5.83 1.8 0 3.03.74 3.96 1.63l1.32-1.33c-1.28-1.23-3.04-2.18-5.28-2.18-4.22 0-7.46 3.22-7.46 7.71s3.16 7.71 7.46 7.71c2.42 0 4.34-1.03 5.75-2.48l-1.76-2.13zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                  </svg>
                  <span className="text-[#4a4455] font-semibold">Apple</span>
                </button>
              </div>

              {/* Footer link */}
              <div className="pt-4 text-center">
                <p className="text-sm text-[#4a4455]">
                  Não tem uma conta?{" "}
                  <Link
                    href="/signup"
                    className="text-[#630ed4] font-bold hover:underline underline-offset-4 decoration-[#630ed4]/30 transition-all ml-1"
                  >
                    Criar conta
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#f8f9fc] w-full py-12">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-lg font-bold text-[#191c1e]">Notura</div>
          <div className="flex flex-wrap justify-center gap-8">
            {["Privacy", "Terms", "Security", "Support"].map((item) => (
              <a
                key={item}
                href="#"
                className="text-slate-500 hover:text-[#7C3AED] transition-colors text-sm"
              >
                {item}
              </a>
            ))}
          </div>
          <div className="text-slate-500 text-sm">© 2024 Notura Inc. Built for clarity.</div>
        </div>
      </footer>
    </div>
  );
}
