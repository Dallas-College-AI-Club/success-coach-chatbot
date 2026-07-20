// Focus mode art: a calm mountain climb. A marker follows the trail higher with
// every answer and a flag is planted at the summit on the last step — growth as
// reaching the top. Decorative; the shell carries the real state. The marker
// moves via a transform transition, so the climb is one smooth motion.

// Trail waypoints, base → summit. The marker is placed a fraction of the way
// along this polyline, so it climbs smoothly regardless of question count.
const TRAIL: [number, number][] = [
  [58, 286],
  [92, 244],
  [108, 198],
  [126, 152],
  [138, 104],
];

function pointAlong(t: number): [number, number] {
  const segLen = TRAIL.slice(1).map((p, i) =>
    Math.hypot(p[0] - TRAIL[i][0], p[1] - TRAIL[i][1]),
  );
  const total = segLen.reduce((a, b) => a + b, 0);
  let d = t * total;
  for (let i = 0; i < segLen.length; i++) {
    if (d <= segLen[i] || i === segLen.length - 1) {
      const r = segLen[i] ? d / segLen[i] : 0;
      return [
        TRAIL[i][0] + (TRAIL[i + 1][0] - TRAIL[i][0]) * r,
        TRAIL[i][1] + (TRAIL[i + 1][1] - TRAIL[i][1]) * r,
      ];
    }
    d -= segLen[i];
  }
  return TRAIL[TRAIL.length - 1];
}

export const FocusMountain = ({
  stepIdx,
  total,
  done = false,
}: {
  stepIdx: number;
  total: number;
  done?: boolean;
}) => {
  // The climb tracks progress through the questions, but the summit — and the
  // planted flag — is the finish line, reached when everything is answered, not
  // while still on the last question. So the questions ride up to CLIMB_TOP and
  // the final leg to the peak plays on completion.
  const CLIMB_TOP = 0.72;
  const legs = Math.max(1, total - 1);
  const frac = done ? 1 : Math.min(CLIMB_TOP, (stepIdx / legs) * CLIMB_TOP);
  const [mx, my] = pointAlong(frac);
  const summited = done;

  return (
    <svg
      viewBox="0 0 200 320"
      className="h-full w-full"
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label={`Climbing toward your plan — step ${stepIdx + 1} of ${total}`}
    >
      <defs>
        <linearGradient id="mtnSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E6EEF4" />
          <stop offset="100%" stopColor="#F6EFE4" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="200" height="320" fill="url(#mtnSky)" />
      {/* soft sun */}
      <circle cx="150" cy="60" r="20" fill="#F7E6C8" className="motion-safe:animate-[drift_7s_ease-in-out_infinite]" />

      {/* far ridges */}
      <path d="M0 210 L52 150 L96 196 L150 132 L200 190 L200 320 L0 320 Z" fill="#C3D0DD" />
      <path d="M0 250 L60 196 L120 240 L172 200 L200 224 L200 320 L0 320 Z" fill="#AEBFCF" />

      {/* main mountain */}
      <path d="M20 306 L118 92 L138 92 L196 306 Z" fill="#7C93AC" />
      {/* shaded face */}
      <path d="M128 92 L118 92 L64 306 L118 306 Z" fill="#6C859F" opacity="0.55" />
      {/* snow cap */}
      <path d="M118 92 L138 92 L152 138 Q134 126 122 138 Q110 128 96 140 Z" fill="#F4F7FA" />
      <path d="M118 92 L128 92 L120 138 Q110 130 100 139 Z" fill="#DDE6EE" opacity="0.7" />

      {/* trail (dashed, winding to the summit) */}
      <path
        d="M58 286 Q78 262 92 244 Q104 218 108 198 Q118 172 126 152 Q134 126 138 104"
        fill="none"
        stroke="#EFE7D6"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="1 7"
        opacity="0.85"
      />

      {/* base pines */}
      {[
        [34, 292, 1],
        [176, 296, 0.85],
        [22, 300, 0.7],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <rect x="-2" y="0" width="4" height="10" rx="1" fill="#6E5A45" />
          <path d="M0 -22 L11 2 L-11 2 Z" fill="#5E7E6A" />
          <path d="M0 -12 L9 6 L-9 6 Z" fill="#6B8C77" />
        </g>
      ))}

      {/* summit flag — raises when the top is reached */}
      <g
        style={{
          transformBox: "fill-box",
          transformOrigin: "left bottom",
          transform: summited ? "scale(1)" : "scale(0)",
          opacity: summited ? 1 : 0,
          transition: "transform 500ms cubic-bezier(.34,1.4,.5,1), opacity 300ms",
        }}
      >
        <line x1="138" y1="104" x2="138" y2="80" stroke="#33415c" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M138 82 L156 88 L138 95 Z" fill="#EC5F56" />
      </g>

      {/* the climber marker */}
      <g
        style={{
          transform: `translate(${mx}px, ${my}px)`,
          transition: "transform 750ms cubic-bezier(.16,1,.3,1)",
        }}
      >
        <circle cx="0" cy="0" r="7.5" fill="#EC5F56" opacity="0.18" />
        <circle cx="0" cy="0" r="4.5" fill="#EC5F56" stroke="#fff" strokeWidth="1.6" />
      </g>
    </svg>
  );
};

