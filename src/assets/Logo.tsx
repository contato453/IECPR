/**
 * Logomarca circular da igreja, usada no login e no cabeçalho de impressão.
 * Placeholder vetorial — substitua por `logo.png` real quando disponível
 * (basta trocar este componente por uma tag <img src="/logo.png" />).
 */
export function Logo({ className = "size-16" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Logomarca IECPR">
      <circle cx="50" cy="50" r="48" fill="var(--color-primary)" stroke="var(--color-accent)" strokeWidth="3" />
      <path
        d="M50 22 L50 78 M32 38 L68 38"
        stroke="var(--color-accent)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <text
        x="50"
        y="92"
        textAnchor="middle"
        fontFamily="var(--font-serif)"
        fontSize="10"
        fill="var(--color-primary)"
      >
        IECPR
      </text>
    </svg>
  );
}
