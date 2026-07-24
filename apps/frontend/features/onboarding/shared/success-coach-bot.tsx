// The Success Coach robot, in Dallas College colours: a friendly rounded bot with
// a light blue-grey head, a soft blue face screen, red side ears, and — on the dot
// atop its antenna — a Dallas College "D" badge. Pure markup (no hooks), so it can
// render in a server component. Decorative; hidden from the accessibility tree.
export function SuccessCoachBot({ className = "size-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 ${className}`} role="img" aria-hidden>
      {/* antenna */}
      <line x1="32" y1="19" x2="32" y2="14" stroke="#003385" strokeWidth="2.4" strokeLinecap="round" />
      {/* Dallas College "D" badge on top of the head */}
      <circle cx="32" cy="8" r="6.4" fill="#003385" stroke="#FFFFFF" strokeWidth="1.4" />
      <text
        x="32"
        y="8.4"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="8.6"
        fontWeight="700"
        fill="#FFFFFF"
      >
        D
      </text>
      {/* side ears — Dallas red */}
      <rect x="5.5" y="30" width="7" height="15" rx="3.5" fill="#E52626" stroke="#003385" strokeWidth="2" />
      <rect x="51.5" y="30" width="7" height="15" rx="3.5" fill="#E52626" stroke="#003385" strokeWidth="2" />
      {/* head */}
      <rect x="12" y="19" width="40" height="33" rx="13" fill="#C3D0E6" stroke="#003385" strokeWidth="2.6" />
      {/* face screen */}
      <rect x="17" y="26" width="30" height="20" rx="9" fill="#EAF1FB" stroke="#003385" strokeWidth="2" />
      {/* eyes + shine */}
      <circle cx="26" cy="35" r="3.4" fill="#003385" />
      <circle cx="38" cy="35" r="3.4" fill="#003385" />
      <circle cx="27.2" cy="33.8" r="1.1" fill="#FFFFFF" />
      <circle cx="39.2" cy="33.8" r="1.1" fill="#FFFFFF" />
      {/* smile */}
      <path d="M28 40.5 q4 2.6 8 0" stroke="#003385" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
