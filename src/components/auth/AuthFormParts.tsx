"use client";

import Link from "next/link";
import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const authInputClass =
  "h-[52px] rounded-lg border-border bg-card px-[22px] text-[13px] placeholder:text-muted-foreground";

const LEGAL_LINKS = [
  { label: "Termos de Uso", href: "/termos" },
  { label: "Privacidade", href: "/privacidade" },
] as const;

/** Placeholder-only text field used by the Login and Sign Up screens. */
export const AuthInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <Input ref={ref} className={cn(authInputClass, className)} {...props} />
  )
);
AuthInput.displayName = "AuthInput";

interface AuthPasswordInputProps extends Omit<InputProps, "type"> {
  showPassword: boolean;
  onTogglePassword: () => void;
}

/** Password field with the eye toggle aligned to the right. */
export function AuthPasswordInput({
  showPassword,
  onTogglePassword,
  className,
  ...props
}: AuthPasswordInputProps) {
  return (
    <div className="relative">
      <AuthInput
        type={showPassword ? "text" : "password"}
        className={cn("pr-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={onTogglePassword}
        className="absolute right-[18px] top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
      >
        {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

interface AuthPrimaryButtonProps {
  label: string;
  loading: boolean;
  loadingLabel: string;
  disabled?: boolean;
}

/** Full-width purple submit button with a soft purple shadow. */
export function AuthPrimaryButton({
  label,
  loading,
  loadingLabel,
  disabled = false,
}: AuthPrimaryButtonProps) {
  return (
    <Button
      type="submit"
      disabled={loading || disabled}
      className="h-12 w-full rounded-lg shadow-[0_6px_16px_rgba(104,81,255,0.3)]"
    >
      {loading ? loadingLabel : label}
    </Button>
  );
}

/** "──── ou ────" divider. */
export function AuthOrDivider() {
  return (
    <div className="flex items-center gap-4">
      <div className="h-px flex-1 bg-border" />
      <span className="text-sm text-muted-foreground">ou</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

interface AuthGoogleButtonProps {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

/** Outlined "Continue com o Google" button with the colored Google logo. */
export function AuthGoogleButton({ disabled, loading, onClick }: AuthGoogleButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-12 w-full rounded-lg bg-card"
      onClick={onClick}
      disabled={loading || disabled}
    >
      {loading ? (
        "Redirecionando..."
      ) : (
        <>
          <GoogleIcon />
          Continue com o Google
        </>
      )}
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

interface AuthSwitchLinkProps {
  prefix: string;
  action: string;
  href: string;
}

/** "Novo por aqui? Crie um **Cadastro**" — bold purple action. */
export function AuthSwitchLink({ prefix, action, href }: AuthSwitchLinkProps) {
  return (
    <p className="text-center text-sm text-foreground">
      {prefix}
      <Link href={href} className="font-bold text-primary hover:underline">
        {action}
      </Link>
    </p>
  );
}

/** "Termos de Uso · Privacidade" footer links. */
export function AuthLegalLinks() {
  return (
    <nav className="flex justify-center gap-6 pt-2 text-xs text-foreground">
      {LEGAL_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
