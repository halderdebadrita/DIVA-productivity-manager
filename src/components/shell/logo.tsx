export function DivaMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="rgb(var(--accent))" />
      <path d="M10 8h6.2c5 0 8.3 3.2 8.3 8s-3.3 8-8.3 8H10V8Z" fill="rgb(var(--accent-fg))" />
      <circle cx="16.4" cy="16" r="3.2" fill="rgb(var(--accent))" />
    </svg>
  );
}
