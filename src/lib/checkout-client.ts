import { normalizeError, parseJson } from "@/lib/api-client";
import {
  resolveInternalPlanForCheckout,
  type BillingCycle,
  type CheckoutPlanType,
} from "@/lib/pricing";
import { buildSupportWhatsAppUrl } from "@/lib/support-contact";

export interface StartCheckoutRequest {
  plan: CheckoutPlanType;
  billingCycle: BillingCycle;
  price: number;
  source: "onboarding" | "settings";
}

interface StartCheckoutResponse {
  checkoutUrl?: string;
  alreadyActive?: boolean;
  error?: string;
  errorCode?: string;
  supportWhatsappUrl?: string;
}

export interface CheckoutStartResult {
  checkoutUrl: string | null;
  alreadyActive: boolean;
}

export class CheckoutSupportRequiredError extends Error {
  constructor(
    message: string,
    public readonly whatsappUrl: string
  ) {
    super(message);
    this.name = "CheckoutSupportRequiredError";
  }
}

export async function startPlanCheckout(
  request: StartCheckoutRequest
): Promise<CheckoutStartResult> {
  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan: resolveInternalPlanForCheckout(request.plan),
      billingCycle: request.billingCycle,
      source: request.source,
    }),
  });
  const body = await parseJson<StartCheckoutResponse>(response);

  if (!response.ok) {
    if (body.errorCode === "payment_received_plan_pending") {
      throw new CheckoutSupportRequiredError(
        normalizeError(
          body.error,
          "Recebemos o pagamento da sua assinatura, mas o plano ainda nao foi aplicado automaticamente."
        ),
        body.supportWhatsappUrl ?? buildSupportWhatsAppUrl()
      );
    }

    throw new Error(normalizeError(body.error, "Falha ao iniciar o checkout."));
  }

  if (body.alreadyActive) {
    return {
      checkoutUrl: null,
      alreadyActive: true,
    };
  }

  if (!body.checkoutUrl) {
    throw new Error("Checkout não retornou URL de redirecionamento.");
  }

  return {
    checkoutUrl: body.checkoutUrl,
    alreadyActive: false,
  };
}
