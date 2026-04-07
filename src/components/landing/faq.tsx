const faqs = [
  {
    question: "Os meus dados estão seguros?",
    answer:
      "Sim, utilizamos criptografia de ponta a ponta e estamos em conformidade com a LGPD. Seus áudios são processados e excluídos permanentemente após a transcrição.",
  },
  {
    question: "Como funciona a integração com o WhatsApp?",
    answer:
      "Após configurar sua conta, você vincula seu número. O Notura enviará o resumo e as tarefas diretamente no seu chat assim que a reunião for processada.",
  },
  {
    question: "Quais formatos de áudio são suportados?",
    answer:
      "Suportamos MP3, WAV, M4A e formatos nativos de gravação do Zoom, Google Meet e Microsoft Teams.",
  },
];

export function FAQ() {
  return (
    <section className="py-24 bg-surface">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-16 text-on-surface">
          Perguntas Frequentes
        </h2>
        <div className="space-y-6">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10"
            >
              <summary className="list-none font-bold text-lg cursor-pointer flex justify-between items-center text-on-surface">
                {faq.question}
                <span className="material-symbols-outlined transition-transform group-open:rotate-180 shrink-0">
                  expand_more
                </span>
              </summary>
              <p className="mt-4 text-on-surface-variant leading-relaxed">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
