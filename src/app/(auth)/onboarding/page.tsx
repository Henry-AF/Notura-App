"use client";

import Link from "next/link";
import {
  Suspense,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
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
import posthog from "posthog-js";
import {
  BillingCycleProvider,
  useBillingCycle,
} from "@/components/pricing/BillingCycleProvider";
import { PricingToggle } from "@/components/pricing/PricingToggle";
import { UpgradeButton } from "@/components/pricing/UpgradeButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/app";
import {
  createCheckoutSelection,
  getBillingCycleLabel,
  getPlanPriceLabel,
  getPricingPlan,
  isCheckoutPlan,
  isPricingPlan,
  resolvePricingPlanFromInternalPlan,
  type BillingCycle,
  type PricingPlanType,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { saveOnboardingProfile } from "./actions";
import {
  ensureOnboardingBillingCustomer,
  startOnboardingCheckout,
  verifyOnboardingPayment,
} from "./onboarding-api";
import { isOnboardingCheckoutBlocked } from "./onboarding-checkout-state";

type OnboardingStep = 1 | 2 | 3;

interface OnboardingPlan {
  id: PricingPlanType;
  name: string;
  price: string;
  desc: string;
  popular?: boolean;
  contactHref?: string;
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
  billingCycle: BillingCycle;
  error: string | null;
  loading: boolean;
  paymentVerifying: boolean;
  prewarmReady: boolean;
  selectedPlan: PricingPlanType;
  onBillingCycleChange: (value: BillingCycle) => void;
  onPlanChange: (plan: PricingPlanType) => void;
  onContinue: () => void;
}

interface SuccessStepProps {
  onContinue: () => void;
}

interface PlanOptionButtonProps {
  plan: OnboardingPlan;
  selected: boolean;
  onSelect: (plan: PricingPlanType) => void;
}

interface PaymentRedirectOptions {
  setBillingCycle: (value: BillingCycle) => void;
  pathname: string;
  searchParams: SearchParamsReader;
  dispatch: Dispatch<OnboardingAction>;
}

type OnboardingState = {
  step: OnboardingStep;
  phone: string;
  selectedPlan: PricingPlanType;
  loading: boolean;
  error: string | null;
  paymentVerifying: boolean;
};

type OnboardingAction =
  | { type: "phoneChanged"; value: string }
  | { type: "planChanged"; value: PricingPlanType }
  | { type: "stepChanged"; value: OnboardingStep }
  | { type: "requestStarted" }
  | { type: "requestFinished" }
  | { type: "errorChanged"; value: string | null }
  | { type: "paymentCanceled" }
  | { type: "paymentVerificationStarted" }
  | { type: "paymentVerified" }
  | { type: "paymentVerificationFailed"; message: string }
  | { type: "paymentVerificationFinished" };

const initialOnboardingState: OnboardingState = {
  step: 1,
  phone: "",
  selectedPlan: "free",
  loading: false,
  error: null,
  paymentVerifying: false,
};

function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction
): OnboardingState {
  switch (action.type) {
    case "phoneChanged":
      return { ...state, phone: action.value };
    case "planChanged":
      return { ...state, selectedPlan: action.value };
    case "stepChanged":
      return { ...state, step: action.value };
    case "requestStarted":
      return { ...state, loading: true, error: null };
    case "requestFinished":
      return { ...state, loading: false };
    case "errorChanged":
      return { ...state, error: action.value };
    case "paymentCanceled":
      return {
        ...state,
        step: 2,
        error: "Pagamento cancelado. Você pode tentar novamente quando quiser.",
      };
    case "paymentVerificationStarted":
      return {
        ...state,
        step: 2,
        paymentVerifying: true,
        loading: true,
        error: null,
      };
    case "paymentVerified":
      return { ...state, step: 3 };
    case "paymentVerificationFailed":
      return { ...state, step: 2, error: action.message };
    case "paymentVerificationFinished":
      return { ...state, paymentVerifying: false, loading: false };
  }
}

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
          <Sparkles className="size-5 text-primary" />
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
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-violet-100">
        <Icon className="size-6 text-violet-600" />
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
            <ArrowRight className="ml-1 size-4" />
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
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            selected ? "border-violet-500 bg-violet-600" : "border-notura-border"
          )}
        >
          {selected ? <Check className="size-3 text-white" /> : null}
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
  billingCycle,
  error,
  loading,
  paymentVerifying,
  prewarmReady,
  selectedPlan,
  onBillingCycleChange,
  onPlanChange,
  onContinue,
}: PlanStepProps) {
  const isPaidSelection = isCheckoutPlan(selectedPlan);
  const isEnterprise = selectedPlan === "enterprise";
  const buttonLabel = paymentVerifying
    ? "Confirmando pagamento..."
    : loading
      ? selectedPlan === "free"
        ? "Continuando..."
        : isEnterprise
          ? "Abrindo contato..."
          : "Redirecionando para pagamento..."
      : selectedPlan === "free"
        ? "Continuar"
        : isEnterprise
          ? "Falar com a equipe"
          : !prewarmReady
          ? "Preparando checkout..."
        : "Ir para pagamento";

  const plans = useMemo(
    () =>
      (["free", "starter", "pro", "enterprise"] as const).map((planId) => {
        const plan = getPricingPlan(planId);

        return {
          id: plan.id,
          name: plan.displayName,
          price:
            plan.id === "enterprise"
              ? "Consultar"
              : `${getPlanPriceLabel(plan.id, billingCycle)}/mês`,
          desc: plan.usageShortLabel,
          popular: Boolean(plan.badgeLabel),
          contactHref: plan.contactHref,
        } satisfies OnboardingPlan;
      }),
    [billingCycle]
  );

  return (
    <div className="space-y-8">
      <StepIntro
        icon={Sparkles}
        title="Escolha seu plano"
        description="Você pode mudar a qualquer momento."
      />

      <div className="space-y-4">
        <div className="flex justify-center">
          <PricingToggle billingCycle={billingCycle} onChange={onBillingCycleChange} />
        </div>

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
          {isEnterprise
            ? "Enterprise não usa checkout automático. Vamos abrir o contato comercial para você."
            : `${getBillingCycleLabel(billingCycle)}. O plano válido só muda após confirmação do pagamento pelo gateway.`}
        </p>

        {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}

        <UpgradeButton
          className="bg-notura-primary text-white disabled:bg-notura-primary/80"
          onClick={onContinue}
          disabled={isOnboardingCheckoutBlocked({
            loading,
            paymentVerifying,
            prewarmReady,
            selectedPlan,
          })}
          label={buttonLabel}
          loading={loading && isPaidSelection}
        />
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
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">
              {index + 1}
            </span>
            <p className="text-sm text-notura-ink">{item}</p>
          </div>
        ))}
      </div>

      <Button className="w-full rounded-full" onClick={onContinue}>
        Ir para o dashboard
        <ArrowRight className="ml-1 size-4" />
      </Button>
    </div>
  );
}

function usePaymentRedirect({
  setBillingCycle,
  pathname,
  searchParams,
  dispatch,
}: PaymentRedirectOptions) {
  useEffect(() => {
    const payment = searchParams.get("payment");
    const providerParam = searchParams.get("provider");
    const sessionId = searchParams.get("session_id");
    const planParam = searchParams.get("plan");
    const billingCycleParam = searchParams.get("billingCycle");
    const provider =
      providerParam === "stripe" || sessionId
        ? "stripe"
        : "abacatepay";

    const pricingPlan = isPricingPlan(planParam)
      ? planParam
      : resolvePricingPlanFromInternalPlan(planParam);
    if (pricingPlan) {
      dispatch({ type: "planChanged", value: pricingPlan });
    }

    if (billingCycleParam === "monthly" || billingCycleParam === "yearly") {
      setBillingCycle(billingCycleParam);
    }

    if (payment === "canceled") {
      dispatch({ type: "paymentCanceled" });
      clearCurrentSearch(pathname);
      return;
    }

    if (payment !== "success") {
      return;
    }

    let cancelled = false;

    async function runVerification() {
      dispatch({ type: "paymentVerificationStarted" });

      try {
        await verifyOnboardingPayment({
          provider,
          sessionId,
        });

        if (!cancelled) {
          dispatch({ type: "paymentVerified" });
          clearCurrentSearch(pathname);
        }
      } catch (verifyError) {
        if (!cancelled) {
          const message =
            verifyError instanceof Error
              ? verifyError.message
              : "Pagamento não confirmado.";
          dispatch({ type: "paymentVerificationFailed", message });
          clearCurrentSearch(pathname);
        }
      } finally {
        if (!cancelled) {
          dispatch({ type: "paymentVerificationFinished" });
        }
      }
    }

    void runVerification();

    return () => {
      cancelled = true;
    };
  }, [
    setBillingCycle,
    pathname,
    searchParams,
    dispatch,
  ]);
}

function useCheckoutPrewarm(step: OnboardingStep): boolean {
  const [prewarmReady, setPrewarmReady] = useState(false);
  const currentStepRef = useRef(step);
  const retryTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    currentStepRef.current = step;
    if (step !== 2) {
      setPrewarmReady(false);
    }
  }, [step]);

  useEffect(() => {
    if (step !== 2) {
      return;
    }

    let cancelled = false;

    async function runPrewarm() {
      try {
        const ready = await ensureOnboardingBillingCustomer();
        if (ready) {
          if (!cancelled) {
            setPrewarmReady(true);
          }
          return;
        }
      } catch {
        // Retry below if the customer prewarm is temporarily unavailable.
      }

      if (!cancelled) {
        retryTimeoutRef.current = window.setTimeout(() => {
          if (currentStepRef.current === 2) {
            void runPrewarm();
          }
        }, 2000);
      }
    }

    void runPrewarm();

    return () => {
      cancelled = true;

      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [step]);

  return prewarmReady;
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
  const { billingCycle, setBillingCycle } = useBillingCycle();
  const [state, dispatch] = useReducer(onboardingReducer, initialOnboardingState);
  const { step, phone, selectedPlan, loading, error, paymentVerifying } = state;

  usePaymentRedirect({
    setBillingCycle,
    pathname,
    searchParams,
    dispatch,
  });
  const prewarmReady = useCheckoutPrewarm(step);

  async function handleSavePhone() {
    dispatch({ type: "requestStarted" });

    try {
      const result = await saveOnboardingProfile({ whatsappNumber: phone });

      if (!result.success) {
        dispatch({
          type: "errorChanged",
          value: result.error ?? "Não foi possível salvar seu número.",
        });
        return;
      }

      posthog.capture("onboarding_phone_saved");
      dispatch({ type: "stepChanged", value: 2 });
    } catch {
      dispatch({
        type: "errorChanged",
        value: "Ocorreu um erro inesperado ao salvar seu número.",
      });
    } finally {
      dispatch({ type: "requestFinished" });
    }
  }

  async function handleSelectPlan() {
    dispatch({ type: "requestStarted" });

    if (selectedPlan === "free") {
      posthog.capture("onboarding_plan_selected", { plan: "free", billing_cycle: billingCycle });
      dispatch({ type: "requestFinished" });
      dispatch({ type: "stepChanged", value: 3 });
      return;
    }

    if (selectedPlan === "enterprise") {
      posthog.capture("onboarding_plan_selected", { plan: "enterprise" });
      dispatch({ type: "requestFinished" });
      window.open(getPricingPlan("enterprise").contactHref, "_blank", "noopener,noreferrer");
      return;
    }

    if (!isCheckoutPlan(selectedPlan)) {
      dispatch({ type: "requestFinished" });
      dispatch({ type: "errorChanged", value: "Plano inválido para checkout." });
      return;
    }

    posthog.capture("onboarding_plan_selected", { plan: selectedPlan, billing_cycle: billingCycle });

    try {
      const checkout = await startOnboardingCheckout(
        createCheckoutSelection(selectedPlan, billingCycle)
      );

      if (checkout.alreadyActive) {
        dispatch({ type: "stepChanged", value: 3 });
        return;
      }

      if (checkout.checkoutUrl) {
        posthog.capture("onboarding_checkout_started", { plan: selectedPlan, billing_cycle: billingCycle });
        window.location.assign(checkout.checkoutUrl);
      }
    } catch (checkoutError) {
      const message =
        checkoutError instanceof Error
          ? checkoutError.message
          : "Falha ao iniciar o pagamento.";
      dispatch({ type: "errorChanged", value: message });
    } finally {
      dispatch({ type: "requestFinished" });
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
            onPhoneChange={(value) => dispatch({ type: "phoneChanged", value })}
            onContinue={handleSavePhone}
            onSkip={() => {
              posthog.capture("onboarding_phone_skipped");
              dispatch({ type: "stepChanged", value: 2 });
            }}
          />
        ) : step === 2 ? (
          <PlanStep
            billingCycle={billingCycle}
            error={error}
            loading={loading}
            paymentVerifying={paymentVerifying}
            prewarmReady={prewarmReady}
            selectedPlan={selectedPlan}
            onBillingCycleChange={setBillingCycle}
            onPlanChange={(plan) => dispatch({ type: "planChanged", value: plan })}
            onContinue={handleSelectPlan}
          />
        ) : (
          <SuccessStep onContinue={() => {
            posthog.capture("onboarding_completed");
            router.push("/dashboard");
          }} />
        )}
      </div>
    </OnboardingShell>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <BillingCycleProvider>
        <OnboardingPageContent />
      </BillingCycleProvider>
    </Suspense>
  );
}
