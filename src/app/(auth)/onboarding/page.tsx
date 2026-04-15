"use client";

import Link from "next/link";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  MessageCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/app";
import {
  APP_PLAN_IDS,
  getPlanDisplayName,
  getPlanPriceLabel,
  getPlanUsageShortLabel,
  isPlan,
} from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { Plan } from "@/types/database";
import { saveOnboardingProfile } from "./actions";
import {
  ensureAbacatepayCustomer,
  startOnboardingCheckout,
  verifyOnboardingPayment,
} from "./onboarding-api";

type OnboardingStep = 1 | 2 | 3;

interface OnboardingPlan {
  id: Plan;
  name: string;
  price: string;
  desc: string;
  popular?: boolean;
}

interface SearchParamsReader {
  get(name: string): string | null;
}

interface StepIntroProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface PhoneStepProps {
  phone: string;
  error: string | null;
  loading: boolean;
  onPhoneChange: (value: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}

interface PlanStepProps {
  error: string | null;
  loading: boolean;
  paymentVerifying: boolean;
  selectedPlan: Plan;
  onPlanChange: (plan: Plan) => void;
  onContinue: () => void;
}

interface SuccessStepProps {
  onContinue: () => void;
}

interface PlanOptionButtonProps {
  plan: OnboardingPlan;
  selected: boolean;
  onSelect: (plan: Plan) => void;
}

interface PaymentRedirectOptions {
  pathname: string;
  searchParams: SearchParamsReader;
  setError: (value: string | null) => void;
  setLoading: (value: boolean) => void;
  setPaymentVerifying: (value: boolean) => void;
  setSelectedPlan: (value: Plan) => void;
  setStep: (value: OnboardingStep) => void;
}

const plans = APP_PLAN_IDS.map((planId) => ({
  id: planId,
  name: getPlanDisplayName(planId),
  price: `${getPlanPriceLabel(planId)}/mês`,
  desc: getPlanUsageShortLabel(planId),
  popular: planId === "pro",
})) satisfies readonly OnboardingPlan[];

const onboardingHighlights = [
  {
    label: "Setup em poucos minutos",
    description:
      "Conecte o canal principal e entre no dashboard com o fluxo inicial resolvido.",
  },
  {
    label: "WhatsApp como canal padrão",
    description:
      "Os resumos e próximos passos já saem prontos para o número configurado.",
  },
  {
    label: "Plano flexível",
    description:
      "Você pode começar no free e subir quando o volume das reuniões crescer.",
  },
] as const;

const successChecklist = [
  "Faça upload do áudio da reunião",
  "Espere a IA processar (2-3 minutos)",
  "Receba o resumo no WhatsApp",
] as const;

function clearCurrentSearch(pathname: string) {
  window.history.replaceState({}, "", pathname);
}

function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(104,81,255,0.14),transparent_45%)] bg-background px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between pb-6">
        <Link href="/" className="inline-flex items-center gap-2 text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-display text-xl font-bold">Notura</span>
        </Link>
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-start">
        <Card className="hidden overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-background lg:block">
          <CardContent className="flex min-h-[640px] flex-col justify-between p-8">
            <div className="space-y-6">
              <span className="inline-flex w-fit items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-primary">
                Configuração inicial
              </span>

              <div className="space-y-3">
                <h1 className="font-display text-4xl font-bold leading-tight text-foreground">
                  Ajuste a experiência do Notura antes da primeira reunião.
                </h1>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                  Defina o WhatsApp, escolha o plano ideal e siga para o dashboard
                  com tudo pronto para receber resumos e decisões.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {onboardingHighlights.map((highlight) => (
                <div
                  key={highlight.label}
                  className="rounded-2xl border border-border/70 bg-background/85 p-4"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {highlight.label}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {highlight.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 bg-card shadow-lg shadow-primary/5">
          <CardContent className="p-5 sm:p-8">
            <div className="mx-auto w-full max-w-lg">{children}</div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function StepIndicator({ step }: { step: OnboardingStep }) {
  return (
    <div className="flex items-center justify-center gap-2.5 sm:justify-start">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className={cn(
            "h-2 rounded-full transition-all",
            item === step
              ? "w-10 bg-notura-primary"
              : item < step
                ? "w-2 bg-notura-primary"
                : "w-2 bg-notura-border"
          )}
        />
      ))}
    </div>
  );
}

function StepIntro({ icon: Icon, title, description }: StepIntroProps) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
        <Icon className="h-6 w-6 text-violet-600" />
      </div>
      <PageHeader
        title={title}
        description={description}
        className="text-center"
        titleClassName="text-notura-ink"
        descriptionClassName="max-w-none text-notura-ink-secondary"
      />
    </div>
  );
}

function PhoneStep({
  phone,
  error,
  loading,
  onPhoneChange,
  onContinue,
  onSkip,
}: PhoneStepProps) {
  return (
    <div className="space-y-8">
      <StepIntro
        icon={MessageCircle}
        title="Seu número de WhatsApp"
        description="É para lá que enviaremos os resumos das reuniões."
      />

      <div className="space-y-5">
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-notura-ink">
            Número com DDD
          </label>
          <div className="flex items-stretch gap-2 sm:gap-3">
            <div className="flex h-11 w-[72px] shrink-0 items-center justify-center rounded-md border-[1.5px] border-notura-border bg-gray-50 px-3 text-sm text-notura-secondary">
              +55
            </div>
            <Input
              id="phone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(event) => onPhoneChange(event.target.value)}
              className="min-w-0 flex-1"
            />
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="space-y-3">
          <Button className="w-full rounded-full" onClick={onContinue} disabled={loading || !phone}>
            {loading ? "Salvando..." : "Continuar"}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>

          <button
            type="button"
            onClick={onSkip}
            className="w-full text-center text-sm text-notura-secondary transition-colors hover:text-notura-ink"
          >
            Pular por enquanto
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanOptionButton({ plan, selected, onSelect }: PlanOptionButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(plan.id)}
      className={cn(
        "w-full rounded-2xl border bg-card text-left shadow-sm transition-all",
        selected
          ? "border-violet-500 ring-1 ring-violet-200"
          : "border-border/80 hover:border-notura-muted/40"
      )}
    >
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <div
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            selected ? "border-violet-500 bg-violet-600" : "border-notura-border"
          )}
        >
          {selected ? <Check className="h-3 w-3 text-white" /> : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-notura-ink">{plan.name}</span>
            {plan.popular ? (
              <span className="rounded-full bg-notura-primary px-2 py-0.5 text-[10px] font-semibold text-white">
                Popular
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-notura-secondary">{plan.desc}</p>
        </div>

        <span className="text-sm font-semibold text-notura-ink sm:ml-auto">
          {plan.price}
        </span>
      </div>
    </button>
  );
}

function PlanStep({
  error,
  loading,
  paymentVerifying,
  selectedPlan,
  onPlanChange,
  onContinue,
}: PlanStepProps) {
  const buttonLabel = paymentVerifying
    ? "Confirmando pagamento..."
    : loading
      ? selectedPlan === "free"
        ? "Continuando..."
        : "Redirecionando para pagamento..."
      : selectedPlan === "free"
        ? "Continuar"
        : "Ir para pagamento";

  return (
    <div className="space-y-8">
      <StepIntro
        icon={Sparkles}
        title="Escolha seu plano"
        description="Você pode mudar a qualquer momento."
      />

      <div className="space-y-4">
        <div className="space-y-3">
          {plans.map((plan) => (
            <PlanOptionButton
              key={plan.id}
              plan={plan}
              selected={selectedPlan === plan.id}
              onSelect={onPlanChange}
            />
          ))}
        </div>

        <p className="text-center text-xs leading-relaxed text-notura-muted">
          Esta etapa não libera acesso pago sozinha. O plano válido só muda após
          confirmação do pagamento pelo gateway.
        </p>

        {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}

        <Button
          className="w-full rounded-full"
          onClick={onContinue}
          disabled={loading || paymentVerifying}
        >
          {buttonLabel}
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SuccessStep({ onContinue }: SuccessStepProps) {
  return (
    <div className="space-y-8 text-center">
      <StepIntro
        icon={Check}
        title="Tudo pronto!"
        description="Agora é só fazer upload da gravação da sua reunião. Em poucos minutos, o resumo com decisões e tarefas chega no seu WhatsApp."
      />

      <div className="mx-auto max-w-sm space-y-3 text-left">
        {successChecklist.map((item, index) => (
          <div key={item} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">
              {index + 1}
            </span>
            <p className="text-sm text-notura-ink">{item}</p>
          </div>
        ))}
      </div>

      <Button className="w-full rounded-full" onClick={onContinue}>
        Ir para o dashboard
        <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}

function usePaymentRedirect({
  pathname,
  searchParams,
  setError,
  setLoading,
  setPaymentVerifying,
  setSelectedPlan,
  setStep,
}: PaymentRedirectOptions) {
  useEffect(() => {
    const payment = searchParams.get("payment");
    const planParam = searchParams.get("plan");

    if (isPlan(planParam)) {
      setSelectedPlan(planParam);
    }

    if (payment === "canceled") {
      setStep(2);
      setError("Pagamento cancelado. Você pode tentar novamente quando quiser.");
      clearCurrentSearch(pathname);
      return;
    }

    if (payment !== "success") {
      return;
    }

    let cancelled = false;

    async function runVerification() {
      setStep(2);
      setPaymentVerifying(true);
      setLoading(true);
      setError(null);

      try {
        await verifyOnboardingPayment();

        if (!cancelled) {
          setStep(3);
          clearCurrentSearch(pathname);
        }
      } catch (verifyError) {
        if (!cancelled) {
          const message =
            verifyError instanceof Error
              ? verifyError.message
              : "Pagamento não confirmado.";
          setError(message);
          setStep(2);
          clearCurrentSearch(pathname);
        }
      } finally {
        if (!cancelled) {
          setPaymentVerifying(false);
          setLoading(false);
        }
      }
    }

    void runVerification();

    return () => {
      cancelled = true;
    };
  }, [
    pathname,
    searchParams,
    setError,
    setLoading,
    setPaymentVerifying,
    setSelectedPlan,
    setStep,
  ]);
}

function useCheckoutPrewarm(step: OnboardingStep) {
  const currentStepRef = useRef(step);
  const prewarmStartedRef = useRef(false);
  const prewarmRetriedRef = useRef(false);
  const retryTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    currentStepRef.current = step;
  }, [step]);

  useEffect(() => {
    if (step !== 2 || prewarmStartedRef.current) {
      return;
    }

    prewarmStartedRef.current = true;
    let cancelled = false;

    async function runPrewarm(isRetry: boolean) {
      try {
        const ready = await ensureAbacatepayCustomer();
        if (ready) {
          return;
        }
      } catch {
        // Retry once below if the customer prewarm is temporarily unavailable.
      }

      if (!isRetry && !cancelled && !prewarmRetriedRef.current) {
        prewarmRetriedRef.current = true;
        retryTimeoutRef.current = window.setTimeout(() => {
          if (currentStepRef.current === 2) {
            void runPrewarm(true);
          }
        }, 2000);
      }
    }

    void runPrewarm(false);

    return () => {
      cancelled = true;

      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [step]);
}

function OnboardingFallback() {
  return (
    <OnboardingShell>
      <div className="py-12 text-center text-sm text-notura-secondary">
        Carregando onboarding...
      </div>
    </OnboardingShell>
  );
}

function OnboardingPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentVerifying, setPaymentVerifying] = useState(false);

  usePaymentRedirect({
    pathname,
    searchParams,
    setError,
    setLoading,
    setPaymentVerifying,
    setSelectedPlan,
    setStep,
  });
  useCheckoutPrewarm(step);

  async function handleSavePhone() {
    setLoading(true);
    setError(null);

    try {
      const result = await saveOnboardingProfile({ whatsappNumber: phone });

      if (!result.success) {
        setError(result.error ?? "Não foi possível salvar seu número.");
        return;
      }

      setStep(2);
    } catch {
      setError("Ocorreu um erro inesperado ao salvar seu número.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPlan() {
    setLoading(true);
    setError(null);

    if (selectedPlan === "free") {
      setLoading(false);
      setStep(3);
      return;
    }

    try {
      const checkout = await startOnboardingCheckout(selectedPlan);

      if (checkout.alreadyActive) {
        setStep(3);
        return;
      }

      if (checkout.checkoutUrl) {
        window.location.assign(checkout.checkoutUrl);
      }
    } catch (checkoutError) {
      const message =
        checkoutError instanceof Error
          ? checkoutError.message
          : "Falha ao iniciar o pagamento.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingShell>
      <div className="space-y-8">
        <div className="space-y-3 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Etapa {step} de 3
          </p>
          <StepIndicator step={step} />
        </div>

        {step === 1 ? (
          <PhoneStep
            phone={phone}
            error={error}
            loading={loading}
            onPhoneChange={setPhone}
            onContinue={handleSavePhone}
            onSkip={() => setStep(2)}
          />
        ) : step === 2 ? (
          <PlanStep
            error={error}
            loading={loading}
            paymentVerifying={paymentVerifying}
            selectedPlan={selectedPlan}
            onPlanChange={setSelectedPlan}
            onContinue={handleSelectPlan}
          />
        ) : (
          <SuccessStep onContinue={() => router.push("/dashboard")} />
        )}
      </div>
    </OnboardingShell>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingPageContent />
    </Suspense>
  );
}
