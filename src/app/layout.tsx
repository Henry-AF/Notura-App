import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Notura — Nunca mais perca o que foi decidido em reunião",
  description:
    "IA transcreve, resume e envia as tarefas direto no WhatsApp — em português, em minutos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${plusJakarta.variable} ${inter.variable}`}
    >
      <head>
        {/* Restore saved theme before first paint to avoid flash on dashboard */}
        <script>{`(function(){try{var t=localStorage.getItem('notura-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})()`}</script>
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
