// components/Wordmark.tsx — "LENS" + an optical reticle glyph (PLAN §6/§16).
// The reticle (ring + crosshair + ticks) reads as a forensic optical instrument, not a
// generic AI logo. Decorative, so aria-hidden; the wordmark text carries the name.

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="text-scan"
      >
        <circle cx="16" cy="16" r="11.5" stroke="currentColor" strokeWidth="1.4" opacity="0.9" />
        <circle cx="16" cy="16" r="3.2" stroke="currentColor" strokeWidth="1.4" />
        {/* crosshair ticks reaching toward the ring */}
        <path d="M16 1.5V8M16 24v6.5M1.5 16H8M24 16h6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        {/* diagonal corner ticks */}
        <path d="M7 7l2.4 2.4M25 7l-2.4 2.4M7 25l2.4-2.4M25 25l-2.4-2.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
      </svg>
      <span className="font-display text-[1.35rem] font-bold leading-none tracking-tight text-text">
        LENS
      </span>
    </div>
  );
}
