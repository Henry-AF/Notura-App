import Link from "next/link";
import { LogoFull } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-white px-4 py-12">
      <Link href="/" className="mb-10">
        <LogoFull iconSize={36} />
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
