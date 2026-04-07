const testimonials = [
  {
    name: "Mariana Silva",
    role: "Product Manager @ TechFlow",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCN9OVVzembmO7n2I9VkDMZqCPLFO3vYJjnqYbTm8onUlQQ-J-rEtavJ7qt8iLPS3XvEsgT0g1tZpElDKThoAGGo98vw7SQ_LjgdogqDv5earWs63CHrwHLqKZdgHG77_v4d2gsOrl8D9dA9CWz4UA7uENgApHxPze7Yw7pj5njz_-mfkohte3flPM87HHXVNWtQkN5L1PeBxg4s5Dw4VE-B9oOmq_OkGoaKNb8IjhRXT3TNp6vdF8xhj4mwF6fY8pSQRdrfMEkReM",
    quote: "O Notura mudou drasticamente nossa cultura de reunioes. Agora todos estao 100% presentes, sabendo que os insights serao capturados.",
  },
  {
    name: "Ricardo Gomes",
    role: "Head of Sales @ GrowthX",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuC9_pLLX04460tHlHytnf7EzEMrL2LUqLvYM_4LsWpSKL0ffXTyCHmLfzp6qy08MO8BvPX3S50CRlBqY_VLckiLFWOKmgJRLfocU2igyGiYfGyZT4I5PPybfPaK5_oqWwNBGY9cwSfB599T2JAYnnx8DirwXkZon2gJwYXCXh5oYuv047LyWsK_YyDv9m9v6VMCjbUS62sIKVjQDQ30t-0AScR2HL9w3iOOhhyIbvc2568qeBzCbzveTL3G52VmSPPVA6uKyYufvgw",
    quote: "Receber os follow-ups direto no WhatsApp me poupa pelo menos 1 hora de administracao por dia. Indispensavel para quem lidera times.",
  },
  {
    name: "Juliana Costa",
    role: "Consultora Estrategica",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuA3izPa1_Ylxf0UG7__KFQDGZyZNKmPo-zBmbqzAg2kYe1ycVhI7tbP0ir8YbG_NEvRniY6hOT9GYHoFENTuW1mivk71yKMuOmVTulKI46h4Xev-Xnr4xhKUI02-u4CSbjE03eBT4dDMg-L4bg7bhdeT3E1mAD65hZhoLMK57cGDW6IRJmqkNiuX_Wv05Dm_zf4rfLGzrAZJWvk9dnW_L3ZUC970VYjJWTQqFN0DMBv9BCa1qWpdgNoOTD7u8nhNKwXjqP2k-x1h5Y",
    quote: "A precisao da transcricao em portugues e impressionante. O resumo consegue captar as nuances que outros softwares ignoram.",
  },
];

export function SocialProof() {
  return (
    <>
      {/* Numbers */}
      <section className="py-16 bg-on-surface text-surface">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div>
            <p className="text-5xl font-black text-primary-fixed-dim mb-2">2h+</p>
            <p className="text-lg opacity-80">Salvas por reuniao</p>
          </div>
          <div>
            <p className="text-5xl font-black text-primary-fixed-dim mb-2">15k+</p>
            <p className="text-lg opacity-80">Profissionais ativos</p>
          </div>
          <div>
            <p className="text-5xl font-black text-primary-fixed-dim mb-2">98%</p>
            <p className="text-lg opacity-80">De precisao em PT-BR</p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-center mb-16 text-on-surface">
            O que dizem os lideres
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-surface-container-lowest p-10 rounded-3xl shadow-[0_10px_30px_rgba(124,58,237,0.05)] border border-outline-variant/5"
              >
                <div className="flex items-center gap-4 mb-6">
                  <img
                    className="w-12 h-12 rounded-full object-cover"
                    src={t.avatar}
                    alt={t.name}
                  />
                  <div>
                    <p className="font-bold text-on-surface">{t.name}</p>
                    <p className="text-xs text-on-surface-variant">{t.role}</p>
                  </div>
                </div>
                <p className="text-on-surface-variant leading-relaxed">{t.quote}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
