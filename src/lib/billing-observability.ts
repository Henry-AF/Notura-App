import * as Sentry from "@sentry/nextjs";

type BillingSpanAttributeValue = string | number | boolean;

type BillingSpanAttributes = Record<
  string,
  BillingSpanAttributeValue | undefined
>;

export interface BillingSpan {
  setAttribute(key: string, value: BillingSpanAttributeValue | undefined): unknown;
}

interface BillingSpanOptions {
  name: string;
  op: string;
  attributes?: BillingSpanAttributes;
}

function compactAttributes(
  attributes: BillingSpanAttributes
): Record<string, BillingSpanAttributeValue> {
  const compacted: Record<string, BillingSpanAttributeValue> = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined) {
      compacted[key] = value;
    }
  }

  return compacted;
}

export function withBillingSpan<T>(
  options: BillingSpanOptions,
  callback: (span: BillingSpan) => T
): T {
  return Sentry.startSpan(
    {
      name: options.name,
      op: options.op,
      attributes: compactAttributes({
        "billing.provider": "abacatepay",
        ...(options.attributes ?? {}),
      }),
    },
    (span) => callback(span)
  );
}

export function setBillingSpanAttribute(
  span: BillingSpan,
  key: string,
  value: BillingSpanAttributeValue | undefined
): void {
  span.setAttribute(key, value);
}
