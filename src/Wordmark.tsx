/** ロゴ「pachi」。p と a のボウルが目。まばたきする */
export function Wordmark({ height = 28 }: { height?: number }) {
  return (
    <svg class="wm" viewBox="0 0 520 200" style={{ height: `${height}px`, width: `${height * 2.6}px` }} role="img" aria-label="pachi">
      <rect x="18" y="70" width="24" height="108" rx="12" fill="currentColor" />
      <g class="wm-eye"><ellipse cx="72" cy="111" rx="36" ry="41" fill="currentColor" /><ellipse cx="79" cy="116" rx="12" ry="18" fill="var(--bg)" /></g>
      <g class="wm-eye"><ellipse cx="160" cy="111" rx="36" ry="41" fill="currentColor" /><ellipse cx="167" cy="116" rx="12" ry="18" fill="var(--bg)" /></g>
      <rect x="190" y="70" width="24" height="82" rx="12" fill="currentColor" />
      <text x="226" y="150" font-family="Nunito, 'Zen Kaku Gothic New', sans-serif" font-weight="800" font-size="150" fill="currentColor">chi</text>
    </svg>
  )
}
