"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const plans = [
  {
    id: "free" as const,
    name: "Free",
    price: "R$0",
    desc: "3 reuniões/mês",
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "R$79/mês",
    desc: "30 reuniões + WhatsApp",
    popular: true,
  },
  {
    id: "team" as const,
    name: "Equipe",
    price: "R$49/usuário",
    desc: "Reuniões ilimitadas",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<"free" | "pro" | "team">("free");
  const [loading, setLoading] = useState(false);

  async function handleSavePhone() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ whatsapp_number: phone })
          .eq("id", user.id);
      }
    } catch {
      // Silently continue — profile will be completed later
    } finally {
      setLoading(false);
      setStep(2);
    }
  }

  async function handleSelectPlan() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ plan: selectedPlan })
          .eq("id", user.id);
      }
    } catch {
      // Continue
    } finally {
      setLoading(false);
      setStep(3);
    }
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "h-2 rounded-full transition-all",
              s === step ? "w-8 bg-notura-green" : s < step ? "w-2 bg-notura-green" : "w-2 bg-notura-border"
            )}
          />
        ))}
      </div>

      {/* Step 1 — WhatsApp */}
      {step === 1 && (
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-notura-green-light">
            <MessageCircle className="h-6 w-6 text-notura-green" />
          </div>
          <h1 className="mt-5 text-center font-display text-2xl font-semibold text-notura-ink">
            Seu número de WhatsApp
          </h1>
          <p className="mt-2 text-center text-sm text-notura-muted">
            É para lá que enviaremos os resumos das reuniões.
          </p>

          <div className="mt-8">
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-notura-ink">
              Número com DDD
            </label>
            <div className="flex gap-2">
              <div className="flex h-10 items-center rounded-md border border-notura-border bg-notura-surface px-3 text-sm text-notura-muted">
                +55
              </div>
              <Input
                id="phone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          <Button
            className="mt-6 w-full"
            onClick={handleSavePhone}
            disabled={loading || !phone}
          >
            {loading ? "Salvando..." : "Continuar"}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>

          <button
            onClick={() => setStep(2)}
            className="mt-3 w-full text-center text-sm text-notura-muted hover:text-notura-ink"
          >
            Pular por enquanto
          </button>
        </div>
      )}

      {/* Step 2 — Plan */}
      {step === 2 && (
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-notura-green-light">
            <Sparkles className="h-6 w-6 text-notura-green" />
          </div>
          <h1 className="mt-5 text-center font-display text-2xl font-semibold text-notura-ink">
            Escolha seu plano
          </h1>
          <p className="mt-2 text-center text-sm text-notura-muted">
            Você pode mudar a qualquer momento.
          </p>

          <div className="mt-8 space-y-3">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={cn(
                  "cursor-pointer transition-all",
                  selectedPlan === plan.id
                    ? "border-notura-green ring-1 ring-notura-green/20"
                    : "hover:border-notura-muted/40"
                )}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                      selectedPlan === plan.id
                        ? "border-notura-green bg-notura-green"
                        : "border-notura-border"
                    )}
                  >
                    {selectedPlan === plan.id && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-notura-ink">
                        {plan.name}
                      </span>
                      {plan.popular && (
                        <span className="rounded-full bg-notura-green px-2 py-0.5 text-[10px] font-medium text-white">
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-notura-muted">{plan.desc}</p>
                  </div>
                  <span className="text-sm font-semibold text-notura-ink">
                    {plan.price}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button
            className="mt-6 w-full"
            onClick={handleSelectPlan}
            disabled={loading}
          >
            {loading ? "Salvando..." : "Continuar"}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Step 3 — Tutorial */}
      {step === 3 && (
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-notura-green-light">
            <Check className="h-7 w-7 text-notura-green" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-semibold text-notura-ink">
            Tudo pronto!
          </h1>
          <p className="mt-2 text-sm text-notura-muted">
            Agora é só fazer upload da gravação da sua reunião. Em poucos minutos, o resumo com
            decisões e tarefas chega no seu WhatsApp.
          </p>

          <div className="mx-auto mt-8 max-w-xs space-y-3 text-left">
            {[
              "Faça upload do áudio da reunião",
              "Espere a IA processar (2-3 minutos)",
              "Receba o resumo no WhatsApp",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-notura-green text-xs font-medium text-white">
                  {i + 1}
                </span>
                <p className="text-sm text-notura-ink">{item}</p>
              </div>
            ))}
          </div>

          <Button
            className="mt-8 w-full"
            onClick={() => router.push("/dashboard")}
          >
            Ir para o dashboard
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
