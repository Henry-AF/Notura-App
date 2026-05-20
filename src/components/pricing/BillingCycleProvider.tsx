"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_BILLING_CYCLE,
  resolveBillingCycle,
  type BillingCycle,
} from "@/lib/pricing";

const BILLING_CYCLE_STORAGE_KEY = "notura-billing-cycle";

interface BillingCycleContextValue {
  billingCycle: BillingCycle;
  isHydrated: boolean;
  setBillingCycle: (value: BillingCycle) => void;
}

const BillingCycleContext = createContext<BillingCycleContextValue | null>(null);

export function BillingCycleProvider({ children }: { children: React.ReactNode }) {
  const [billingCycle, setBillingCycleState] = useState<BillingCycle>(DEFAULT_BILLING_CYCLE);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(BILLING_CYCLE_STORAGE_KEY);
      setBillingCycleState(resolveBillingCycle(stored));
    } catch {
      setBillingCycleState(DEFAULT_BILLING_CYCLE);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const setBillingCycle = useCallback((value: BillingCycle) => {
    setBillingCycleState(value);

    try {
      window.localStorage.setItem(BILLING_CYCLE_STORAGE_KEY, value);
    } catch {
      // Ignore storage failures and keep the in-memory selection.
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      billingCycle,
      isHydrated,
      setBillingCycle,
    }),
    [billingCycle, isHydrated, setBillingCycle]
  );

  return (
    <BillingCycleContext.Provider value={contextValue}>
      {children}
    </BillingCycleContext.Provider>
  );
}

export function useBillingCycle() {
  const context = useContext(BillingCycleContext);

  if (!context) {
    throw new Error("useBillingCycle must be used within <BillingCycleProvider>");
  }

  return context;
}