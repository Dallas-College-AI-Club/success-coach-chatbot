// Playful mode art: a bright, STYLISED Dallas College campus — familiar, never
// photoreal. Clean modern buildings (a curved "disc-roof" hall, a glass block, a
// stepped mail-tower) sit under a cheerful sky with soft colour blobs, drifting
// clouds and twinkling sparkles. It is kept light and uncluttered so the note
// card and its text stay crisp — UX first. The shell pans it one stretch per
// question, so answering strolls you further across campus, and the vector
// mascots roam on top. Motion is transform/opacity only, gated behind motion-safe.

import { type ReactNode } from "react";

const Tree = ({ x, s = 1 }: { x: number; s?: number }) => (
  <g transform={`translate(${x} 0) scale(${s})`}>
    <ellipse cx="0" cy="312" rx="40" ry="9" fill="#46557A" opacity="0.1" />
    <rect x="-5" y="270" width="11" height="46" rx="5" fill="#A9764A" />
    <circle cx="0" cy="252" r="34" fill="#84C078" />
    <circle cx="-22" cy="264" r="22" fill="#75B36A" />
    <circle cx="22" cy="262" r="20" fill="#95CE8B" />
    <circle cx="-4" cy="238" r="24" fill="#A2D598" />
  </g>
);

const Cloud = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g
    transform={`translate(${x} ${y}) scale(${s})`}
    fill="#FFFFFF"
    className="motion-safe:animate-[drift_9s_ease-in-out_infinite]"
  >
    <ellipse cx="0" cy="0" rx="40" ry="14" opacity="0.85" />
    <ellipse cx="30" cy="7" rx="28" ry="11" opacity="0.7" />
    <ellipse cx="-28" cy="8" rx="24" ry="10" opacity="0.65" />
  </g>
);

const Star = ({ x, y, r, delay }: { x: number; y: number; r: number; delay: number }) => (
  <path
    d={`M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z`}
    fill="#FFFFFF"
    className="motion-safe:animate-[twinkle_3s_ease-in-out_infinite]"
    style={{ animationDelay: `${delay}s`, transformBox: "fill-box", transformOrigin: "center" }}
  />
);

// A clean modern glass wing — rounded top, grid of windows, a few warm-lit.
const GlassWing = ({ x, w, h, lit = [] as number[] }: { x: number; w: number; h: number; lit?: number[] }) => {
  const cols = Math.round(w / 26);
  const rows = Math.round(h / 24);
  const cw = w / cols;
  const ch = h / rows;
  const y = 300 - h;
  const cells: ReactNode[] = [];
  let idx = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const on = lit.includes(idx);
      cells.push(
        <rect
          key={idx}
          x={x + c * cw + 2}
          y={y + r * ch + 2}
          width={cw - 4}
          height={ch - 4}
          rx="2"
          fill={on ? "#FFE6B8" : "#C6DEF4"}
        />,
      );
      idx++;
    }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10" fill="#AECFEF" />
      {cells}
    </g>
  );
};

// The panorama is 1200 wide (three landmark stops of ~400). Sky and ground run
// unbroken across it so panning reads as one continuous campus.
export const PlayfulScene = ({
  preserveAspectRatio = "xMidYMid slice",
}: {
  /** Overridable so the chat backdrop can bottom-anchor the crop
   *  (xMidYMax) while the wizard keeps the centred default. */
  preserveAspectRatio?: string;
} = {}) => (
  <svg
    viewBox="0 0 1200 400"
    className="h-full w-full"
    preserveAspectRatio={preserveAspectRatio}
    role="img"
    aria-hidden
  >
    <defs>
      <linearGradient id="csSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#CBE7FF" />
        <stop offset="55%" stopColor="#E3E6FB" />
        <stop offset="100%" stopColor="#FDEEDD" />
      </linearGradient>
      <radialGradient id="csSun" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFE9BE" stopOpacity="0.95" />
        <stop offset="60%" stopColor="#FFE3B2" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#FFE3B2" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="csGrassA" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#AAD796" />
        <stop offset="100%" stopColor="#99CB83" />
      </linearGradient>
      <linearGradient id="csGrassB" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#93C87F" />
        <stop offset="100%" stopColor="#83BC6F" />
      </linearGradient>
    </defs>

    {/* sky */}
    <rect x="0" y="0" width="1200" height="400" fill="url(#csSky)" />

    {/* soft playful colour blobs — a subtle nod to the dopamine palette */}
    <ellipse cx="380" cy="78" rx="120" ry="76" fill="#C9BEF7" opacity="0.35" />
    <ellipse cx="150" cy="120" rx="96" ry="64" fill="#FFC7BC" opacity="0.3" />
    <ellipse cx="820" cy="70" rx="120" ry="72" fill="#BFE0F5" opacity="0.4" />

    {/* sun */}
    <circle cx="1010" cy="74" r="110" fill="url(#csSun)" className="motion-safe:animate-[drift_10s_ease-in-out_infinite]" />
    <circle cx="1010" cy="74" r="26" fill="#FFEFC8" />

    <Cloud x={250} y={70} />
    <Cloud x={640} y={54} s={1.05} />
    <Cloud x={1120} y={96} s={0.85} />

    <Star x={470} y={70} r={5} delay={0} />
    <Star x={300} y={128} r={4} delay={1.1} />
    <Star x={720} y={60} r={5} delay={0.6} />
    <Star x={900} y={120} r={4} delay={1.5} />
    <Star x={70} y={70} r={4} delay={0.3} />

    {/* far, atmospheric treeline */}
    <path d="M0 252 Q 200 232 430 250 Q 660 268 900 246 Q 1060 232 1200 250 L1200 320 L0 320 Z" fill="#C4D9CF" />
    <g fill="#B7D3AE" opacity="0.9">
      <circle cx="330" cy="250" r="24" /><circle cx="360" cy="254" r="18" />
      <circle cx="760" cy="248" r="22" /><circle cx="790" cy="252" r="16" />
    </g>

    {/* ── stop 1: the curved "disc-roof" hall ── */}
    <g>
      <ellipse cx="220" cy="304" rx="150" ry="13" fill="#46557A" opacity="0.1" />
      {/* curved glass body */}
      <path d="M108 300 V216 Q108 198 136 196 H304 Q332 198 332 216 V300 Z" fill="#AECFEF" />
      {/* window grid */}
      <g stroke="#8CB3DD" strokeWidth="2" opacity="0.75">
        {[134, 160, 186, 212, 238, 264, 290].map((x) => (
          <line key={x} x1={x} y1="200" x2={x} y2="300" />
        ))}
        {[224, 250, 276].map((y) => (
          <line key={y} x1="108" y1={y} x2="332" y2={y} />
        ))}
      </g>
      <g fill="#FFE6B8">
        <rect x="136" y="226" width="22" height="22" rx="2" />
        <rect x="240" y="252" width="22" height="22" rx="2" />
        <rect x="188" y="226" width="22" height="22" rx="2" />
      </g>
      {/* stone panel + R logo (Richland purple/green) */}
      <rect x="296" y="208" width="40" height="92" fill="#EDE6D6" />
      <rect x="306" y="222" width="20" height="20" rx="2" fill="#7B4F9E" />
      <rect x="316" y="232" width="10" height="10" fill="#4FA06E" />
      {/* sweeping disc roof */}
      <path d="M72 198 Q 220 166 368 198 Q 368 210 356 212 Q 220 184 84 212 Q 72 210 72 198 Z" fill="#E7EBF1" />
      {/* entrance */}
      <path d="M198 300 V276 a24 24 0 0 1 44 0 V300 Z" fill="#2E4066" />
      <rect x="196" y="298" width="48" height="5" rx="2" fill="#DED6C4" />
    </g>

    {/* grass + a winding walkway */}
    <path d="M0 298 Q 300 282 600 298 T 1200 298 L1200 400 L0 400 Z" fill="url(#csGrassA)" />
    <path d="M-20 352 Q 300 340 600 350 T 1220 348 L1220 372 Q 900 362 600 372 T -20 376 Z" fill="#EADFC9" />
    <path d="M0 330 Q 300 316 600 330 T 1200 330 L1200 400 L0 400 Z" fill="url(#csGrassB)" />
    {/* path up to the hall entrance */}
    <path d="M206 352 L200 300 L242 300 L236 352 Z" fill="#EADFC9" />

    {/* ── stop 2: a clean glass block on a plaza ── */}
    <g>
      <ellipse cx="600" cy="302" rx="130" ry="12" fill="#46557A" opacity="0.1" />
      <GlassWing x={512} w={70} h={92} lit={[1, 6, 10, 15]} />
      <GlassWing x={588} w={100} h={116} lit={[2, 5, 9, 14, 20]} />
      {/* flat roof caps */}
      <rect x="508" y="204" width="78" height="8" rx="3" fill="#D7DEE8" />
      <rect x="584" y="180" width="108" height="8" rx="3" fill="#D7DEE8" />
      {/* small red pennant */}
      <line x1="638" y1="180" x2="638" y2="162" stroke="#003385" strokeWidth="3" strokeLinecap="round" />
      <path d="M638 164 L656 170 L638 176 Z" fill="#E52626" />
      {/* entrance */}
      <rect x="626" y="272" width="28" height="28" rx="4" fill="#2E4066" />
    </g>
    <Tree x={470} s={0.95} />

    {/* ── stop 3: the stepped mail-tower ── */}
    <g>
      <ellipse cx="1000" cy="304" rx="120" ry="12" fill="#46557A" opacity="0.1" />
      {/* stepped tiers */}
      <rect x="936" y="252" width="128" height="48" rx="4" fill="#E7EBF1" />
      <rect x="950" y="228" width="100" height="26" rx="3" fill="#EDF1F6" />
      <rect x="966" y="206" width="68" height="24" rx="3" fill="#E7EBF1" />
      {/* glass strips */}
      <rect x="946" y="262" width="108" height="12" rx="2" fill="#AECFEF" />
      <rect x="958" y="234" width="84" height="10" rx="2" fill="#AECFEF" />
      {/* tower + mail icon */}
      <rect x="984" y="172" width="32" height="40" rx="3" fill="#DDE4EC" />
      <rect x="988" y="178" width="24" height="12" fill="#F4C24A" />
      <rect x="988" y="190" width="24" height="14" fill="#5B9BD5" />
      <path d="M990 191 L1000 198 L1010 191" fill="none" stroke="#fff" strokeWidth="1.5" />
      {/* entrance */}
      <rect x="986" y="276" width="28" height="24" rx="3" fill="#2E4066" />
    </g>
    <Tree x={1120} s={1} />

    {/* foreground shrubs + flowers */}
    <g>
      <ellipse cx="72" cy="360" rx="24" ry="12" fill="#84C078" />
      <ellipse cx="90" cy="356" rx="16" ry="10" fill="#95CE8B" />
      <ellipse cx="540" cy="366" rx="22" ry="11" fill="#7EBB70" />
      <ellipse cx="880" cy="364" rx="24" ry="12" fill="#84C078" />
    </g>
  </svg>
);
