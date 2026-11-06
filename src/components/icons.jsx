// Ikon khusus futsal (gaya garis, kompatibel dengan ikon lucide: prop size, strokeWidth, className)
function Svg({ size = 24, strokeWidth = 2, className, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>
  );
}

export function Ball(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 8.8l3.04 2.21-1.16 3.58h-3.76l-1.16-3.58z" />
      <path d="M12 2.5v6.3M21.04 9.06l-6-2.05M17.58 19.69l-3.7-5.1M6.42 19.69l3.7-5.1M2.96 9.06l6-2.05" />
    </Svg>
  );
}

export function Pitch(props) {
  return (
    <Svg {...props}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M12 5v14" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M2 9.5h3.5v5H2M22 9.5h-3.5v5H22" />
    </Svg>
  );
}
