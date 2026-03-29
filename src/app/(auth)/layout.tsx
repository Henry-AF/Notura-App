import Link from "next/link";
import { LogoFull } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center bg-gradient-mesh px-4 py-12 overflow-hidden">
      {/* Decorative blobs */}
      <div className="mesh-blob -right-32 -top-32 h-80 w-80 bg-violet-200/50" />
      <div className="mesh-blob -bottom-20 -left-20 h-64 w-64 bg-violet-300/20" />
      <Link href="/" className="relative z-10 mb-10">
        <LogoFull iconSize={36} />
      </Link>
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#F3F4F6] bg-white/80 backdrop-blur-sm p-8 shadow-xl">{children}</div>
    </div>
  );
}
