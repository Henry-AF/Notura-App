import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
}

function Logo({ className, size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Notura"
    >
      {/* Rounded square container */}
      <rect width="40" height="40" rx="10" fill="#0F6E56" />
      {/* Stylized N with a play-triangle integrated into the right stroke */}
      <path
        d="M12 30V10L21 22V10"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Play/record circle accent */}
      <circle cx="28" cy="20" r="5" fill="white" opacity="0.9" />
      <path
        d="M26.5 17.5L30.5 20L26.5 22.5V17.5Z"
        fill="#0F6E56"
      />
    </svg>
  );
}

interface LogoFullProps {
  className?: string;
  iconSize?: number;
}

function LogoFull({ className, iconSize = 32 }: LogoFullProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo size={iconSize} />
      <span
        className="font-display text-xl font-semibold tracking-tight text-notura-ink"
        style={{ lineHeight: 1 }}
      >
        Notura
      </span>
    </div>
  );
}

export { Logo, LogoFull };
