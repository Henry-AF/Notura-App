"use client";

import React, { useEffect, useState } from "react";
import { Loader2, MessageSquare, Mic, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatWhatsappNumberForDisplay,
  getWhatsappNumberValidationError,
  maskBrazilianPhoneInput,
  normalizeWhatsappNumber,
} from "@/lib/meetings/whatsapp-number";

type WhatsappNumberSource = "account" | "custom";

export interface RecordingSetupValues {
  clientName: string;
  whatsappNumber: string;
}

interface RecordingSetupCardProps {
  accountWhatsappNumber?: string;
  isStarting: boolean;
  onStart: (values: RecordingSetupValues) => void;
  onValidationError: (message: string) => void;
}

const labelClassName =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground";

export function RecordingSetupCard({
  accountWhatsappNumber = "",
  isStarting,
  onStart,
  onValidationError,
}: RecordingSetupCardProps) {
  const [clientName, setClientName] = useState("");
  const [whatsappSource, setWhatsappSource] =
    useState<WhatsappNumberSource>("account");
  const [customWhatsappNumber, setCustomWhatsappNumber] = useState("");
  const [hasTouchedWhatsappSource, setHasTouchedWhatsappSource] = useState(false);

  const accountWhatsappNumberNormalized = normalizeWhatsappNumber(
    accountWhatsappNumber
  );
  const accountWhatsappDisplay = formatWhatsappNumberForDisplay(
    accountWhatsappNumberNormalized
  );
  const hasAccountWhatsappNumber = accountWhatsappDisplay.length > 0;

  useEffect(() => {
    if (!hasAccountWhatsappNumber && whatsappSource === "account") {
      setWhatsappSource("custom");
      return;
    }

    if (hasAccountWhatsappNumber && !hasTouchedWhatsappSource) {
      setWhatsappSource("account");
    }
  }, [hasAccountWhatsappNumber, hasTouchedWhatsappSource, whatsappSource]);

  const selectedWhatsappRaw =
    whatsappSource === "account"
      ? accountWhatsappNumberNormalized
      : customWhatsappNumber;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!clientName.trim()) {
      onValidationError("Preencha o nome do cliente.");
      return;
    }

    const whatsappError = getWhatsappNumberValidationError(selectedWhatsappRaw);
    if (whatsappError) {
      onValidationError(whatsappError);
      return;
    }

    onStart({
      clientName: clientName.trim(),
      whatsappNumber: normalizeWhatsappNumber(selectedWhatsappRaw),
    });
  }

  return (
    <Card className="rounded-2xl border-border/80 bg-card/95 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="font-display text-base font-semibold text-card-foreground">
          Informações da gravação
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Defina quem vai receber o sumário e inicie a gravação quando estiver tudo pronto.
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className={labelClassName}>Nome do cliente</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Ex: Tech Solutions Inc."
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className={labelClassName}>Número WhatsApp para resumo</label>
            <Select
              value={whatsappSource}
              onValueChange={(value) => {
                setHasTouchedWhatsappSource(true);
                setWhatsappSource(value as WhatsappNumberSource);
              }}
            >
              <SelectTrigger className="h-10 rounded-lg border-input bg-background text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="animate-none">
                <SelectItem value="account" disabled={!hasAccountWhatsappNumber}>
                  {hasAccountWhatsappNumber
                    ? accountWhatsappDisplay
                    : "Número da conta (não configurado)"}
                </SelectItem>
                <SelectItem value="custom">Número personalizado</SelectItem>
              </SelectContent>
            </Select>

            {whatsappSource === "custom" ? (
              <div className="relative mt-2">
                <MessageSquare className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={customWhatsappNumber}
                  onChange={(event) =>
                    setCustomWhatsappNumber(
                      maskBrazilianPhoneInput(event.target.value)
                    )
                  }
                  className="pl-9"
                />
              </div>
            ) : null}

            <p className="mt-1.5 text-[11px] text-muted-foreground">
              O número padrão da sua conta já vem selecionado, mas você pode enviar para outro contato.
            </p>
          </div>

          <Button
            type="submit"
            disabled={isStarting}
            className="h-11 w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Conectando microfone...
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                Iniciar gravação
              </>
            )}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            Ao encerrar, você poderá descartar ou gerar o sumário da reunião.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
