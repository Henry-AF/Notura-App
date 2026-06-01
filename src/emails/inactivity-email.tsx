import { Text } from "react-email";
import * as React from "react";
import {
  EmailButton,
  NoturaEmailShell,
  paragraphStyle,
} from "@/emails/notura-email-shell";

interface InactivityEmailProps {
  name: string;
  ctaLabel: string;
  ctaUrl: string;
  quotaCopy: string;
  savedTimeCopy: string;
  upgradeCopy: string | null;
}

export function InactivityEmail({
  name,
  ctaLabel,
  ctaUrl,
  quotaCopy,
  savedTimeCopy,
  upgradeCopy,
}: InactivityEmailProps) {
  return (
    <NoturaEmailShell
      preview="Volte para transformar reuniões em decisões, tarefas e próximos passos."
      title="Faz alguns dias que você não acessa o Notura"
    >
      <Text style={paragraphStyle}>Olá, {name}.</Text>
      <Text style={paragraphStyle}>
        Faz alguns dias que você não acessa o Notura. Suas reuniões podem
        continuar virando resumos, decisões, tarefas e próximos passos sem você
        precisar organizar tudo manualmente.
      </Text>
      <Text style={paragraphStyle}>{savedTimeCopy}</Text>
      <Text style={paragraphStyle}>{quotaCopy}</Text>
      {upgradeCopy ? <Text style={paragraphStyle}>{upgradeCopy}</Text> : null}
      <EmailButton href={ctaUrl}>{ctaLabel}</EmailButton>
    </NoturaEmailShell>
  );
}
