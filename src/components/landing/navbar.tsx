"use client";

import Link from "next/link";

export function Navbar() {
  return (
    <header className="fixed top-0 w-full z-50 bg-[#f8f9fc]/80 backdrop-blur-xl shadow-[0_10px_30px_rgba(124,58,237,0.08)]">
      <nav className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
        <div className="text-2xl font-bold tracking-tighter text-[#191c1e]">Notura</div>
        <div className="hidden md:flex gap-8 items-center">
          <a
            href="#funcionalidades"
            className="font-medium tracking-tight text-[#191c1e] opacity-70 hover:opacity-100 hover:text-[#7C3AED] transition-all"
          >
            Funcionalidades
          </a>
          <a
            href="#como-funciona"
            className="font-medium tracking-tight text-[#191c1e] opacity-70 hover:opacity-100 hover:text-[#7C3AED] transition-all"
          >
            Como Funciona
          </a>
          <a
            href="#precos"
            className="font-medium tracking-tight text-[#191c1e] opacity-70 hover:opacity-100 hover:text-[#7C3AED] transition-all"
          >
            Preços
          </a>
        </div>
        <div className="flex gap-4 items-center">
          <Link
            href="/login"
            className="hidden sm:block text-[#191c1e] font-medium px-4 py-2 opacity-80 hover:opacity-100"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="bg-gradient-to-br from-[#630ed4] to-[#7c3aed] text-white px-6 py-2.5 rounded-full font-bold shadow-lg transform hover:scale-95 transition-all"
          >
            Começar Agora
          </Link>
        </div>
      </nav>
    </header>
  );
}
