import Link from "next/link";
import { LogoFull } from "@/components/logo";

export function Footer() {
  return (
    <footer className="border-t border-[#F3F4F6] bg-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
          <div className="flex flex-col items-center gap-3 md:items-start">
            <LogoFull iconSize={28} />
            <p className="text-sm text-notura-secondary">
              IA para reuniões, feita no Brasil 🇧🇷
            </p>
          </div>

          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-notura-secondary">
            <Link href="/signup" className="hover:text-notura-primary transition-colors">
              Criar conta
            </Link>
            <Link href="/login" className="hover:text-notura-primary transition-colors">
              Entrar
            </Link>
            <Link href="#pricing" className="hover:text-notura-primary transition-colors">
              Preços
            </Link>
          </nav>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2 border-t border-[#F3F4F6] pt-6 text-xs text-notura-secondary">
          <p>Notura &copy; {new Date().getFullYear()}. Todos os direitos reservados.</p>
          <a
            href="https://www.perplexity.ai/computer"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-notura-primary transition-colors"
          >
            Created with Perplexity Computer
          </a>
        </div>
      </div>
    </footer>
  );
}
