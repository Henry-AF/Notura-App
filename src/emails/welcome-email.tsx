import { Text } from "react-email";
import * as React from "react";
import {
  EmailButton,
  NoturaEmailShell,
  paragraphStyle,
} from "@/emails/notura-email-shell";

interface WelcomeEmailProps {
  name: string;
  ctaUrl: string;
}

export function WelcomeEmail({ name, ctaUrl }: WelcomeEmailProps) {
  return (
    <NoturaEmailShell
      preview="Processe sua primeira reunião e organize decisões, tarefas e próximos passos."
      title="Bem-vindo ao Notura"
    >
      <Text style={paragraphStyle}>Olá, {name}.</Text>
      <Text style={paragraphStyle}>
        O Notura ajuda você a transformar reuniões em resumos claros, decisões
        registradas, tarefas organizadas e próximos passos prontos para execução.
      </Text>
      <Text style={paragraphStyle}>
        Comece processando sua primeira reunião para reduzir o tempo gasto
        escrevendo atas e manter o contexto do time em um só lugar.
      </Text>
      <EmailButton href={ctaUrl}>Processar primeira reunião</EmailButton>
    </NoturaEmailShell>
  );
}
