import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600"],
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
      className={`${GeistSans.variable} ${GeistMono.variable} ${dmSans.variable}`}
    >
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
