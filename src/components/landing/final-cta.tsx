import Link from "next/link";

export function FinalCTA() {
  return (
    <section className="py-24 px-6 bg-surface">
      <div className="max-w-5xl mx-auto bg-on-surface rounded-[2rem] p-12 text-center text-surface relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            Pronto para dominar sua rotina?
          </h2>
          <p className="text-xl opacity-80 mb-10 max-w-2xl mx-auto">
            Comece agora gratuitamente e sinta a diferença na sua produtividade desde a primeira
            reunião.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-primary text-white px-10 py-5 rounded-full font-black text-xl shadow-2xl hover:scale-105 transition-transform"
          >
            Começar Gratuitamente
          </Link>
        </div>
        {/* Aesthetic orbs */}
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/20 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-tertiary-container/20 blur-[100px] pointer-events-none" />
      </div>
    </section>
  );
}
