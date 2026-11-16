import Link from "next/link";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  href?: string;
}

export function ImpactGraphLogoMark({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-1 text-[var(--accent-coral)] shadow-sm shrink-0 ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-full h-full"
      >
        {/* Central node */}
        <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2" />
        {/* 4 Connected Satellite Nodes */}
        <circle cx="12" cy="4" r="1.75" fill="currentColor" />
        <circle cx="20" cy="12" r="1.75" fill="currentColor" />
        <circle cx="12" cy="20" r="1.75" fill="currentColor" />
        <circle cx="4" cy="12" r="1.75" fill="currentColor" />
        {/* Connection rays */}
        <line x1="12" y1="7" x2="12" y2="9" stroke="currentColor" strokeWidth="1.75" />
        <line x1="17" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1.75" />
        <line x1="12" y1="17" x2="12" y2="15" stroke="currentColor" strokeWidth="1.75" />
        <line x1="7" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    </div>
  );
}

export function ImpactGraphLogo({
  className = "",
  iconOnly = false,
  href = "/",
}: LogoProps) {
  const content = (
    <span className={`inline-flex items-center gap-2.5 select-none no-underline ${className}`}>
      <ImpactGraphLogoMark className="w-7 h-7 sm:w-8 sm:h-8" />
      {!iconOnly && (
        <span className="text-[17px] sm:text-[18px] font-bold tracking-tight text-[var(--text-primary)]">
          ImpactGraph
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-coral)] rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
}
