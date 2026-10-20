export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary" fill="none" aria-hidden>
        {/* a small notebook with an apple-leaf mark */}
        <rect x="4" y="3" width="14" height="18" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 3v18" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11 9v6h4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M19 4c1.5 0 2 1 2 1s-.5 1-2 1" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <span className="font-display text-xl text-foreground">Lawtrack</span>
    </span>
  );
}
