import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[#f2f3f6] w-full py-12 px-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 max-w-7xl mx-auto">
        <div className="text-xl font-black text-[#191c1e]">Notura</div>
        <div className="flex flex-wrap justify-center gap-6">
          <Link
            href="#"
            className="text-sm text-[#191c1e]/60 hover:text-[#7C3AED] transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="#"
            className="text-sm text-[#191c1e]/60 hover:text-[#7C3AED] transition-colors"
          >
            Terms of Service
          </Link>
          <Link
            href="#"
            className="text-sm text-[#191c1e]/60 hover:text-[#7C3AED] transition-colors"
          >
            Security
          </Link>
          <Link
            href="#"
            className="text-sm text-[#191c1e]/60 hover:text-[#7C3AED] transition-colors"
          >
            Status
          </Link>
          <Link
            href="#"
            className="text-sm text-[#191c1e]/60 hover:text-[#7C3AED] transition-colors"
          >
            Contact
          </Link>
        </div>
        <div className="text-sm text-[#191c1e]/60">
          © 2024 Notura AI. The Intelligent Canvas for Meetings.
        </div>
      </div>
    </footer>
  );
}



