// The Dallas College campus mascots (vectors from public/mascots/), brought to
// life beside the note card. They live in the VISIBLE left band — clear of the
// chat card — which on desktop is a narrow but tall strip. So instead of a bottom
// row (which would crowd and overlap in the narrow width), they're scattered down
// the strip at distinct heights in a gentle left-right zigzag: each mascot sits at
// its own height, so they never pile up, and each drifts and sways on its own beat.
// Small original flourishes (a lightning spark on the Thunderduck, sparkles by the
// Sun) are drawn beside the logos. All motion is transform/opacity only, desynced
// per instance, and gated behind motion-safe.
import { type CSSProperties, type ReactNode } from "react";

const Badge = ({ src, alt }: { src: string; alt: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={src}
    alt={alt}
    draggable={false}
    className="h-full w-auto object-contain drop-shadow-[0_3px_5px_rgba(30,42,58,.22)]"
  />
);

// A mascot that hovers in place — a gentle vertical drift plus a soft sway.
const Floater = ({
  src,
  alt,
  className,
  drift,
  sway,
  flourish,
}: {
  src: string;
  alt: string;
  className: string;
  drift: number;
  sway: number;
  flourish?: ReactNode;
}) => (
  <div
    className={`absolute h-11 sm:h-12 motion-safe:animate-[drift_var(--dr)_ease-in-out_infinite] ${className}`}
    style={{ "--dr": `${drift}s` } as CSSProperties}
  >
    <div
      className="relative h-full motion-safe:animate-[sway_var(--sw)_ease-in-out_infinite]"
      style={{ "--sw": `${sway}s` } as CSSProperties}
    >
      <Badge src={src} alt={alt} />
      {flourish}
    </div>
  </div>
);

const Lightning = ({ delay }: { delay: number }) => (
  <span
    aria-hidden
    className="pointer-events-none absolute -top-1 right-0 h-5 w-3.5 motion-safe:animate-[zap_2.6s_ease-in-out_infinite]"
    style={{ animationDelay: `${delay}s` }}
  >
    <svg viewBox="0 0 14 22" className="h-full w-full">
      <path
        d="M8.5 0 1 12h4.8L3 22l10-13.2H7.6L11 0z"
        fill="#ffe14d"
        stroke="#e0a500"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

const Sparkles = ({ delay }: { delay: number }) => (
  <>
    {[
      { top: "2%", left: "-6%", d: 0 },
      { top: "-6%", left: "62%", d: 0.7 },
      { top: "48%", left: "98%", d: 1.3 },
    ].map((s, i) => (
      <span
        key={i}
        aria-hidden
        className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-[#ffd23f] shadow-[0_0_6px_2px_rgba(255,210,63,.7)] motion-safe:animate-[sparkle_2.4s_ease-in-out_infinite]"
        style={{ top: s.top, left: s.left, animationDelay: `${delay + s.d}s` }}
      />
    ))}
  </>
);

// The cast lives in the left band (clear of the card on sm+), so the mascots are
// always visible. On mobile the card is full-width, so the band spans the frame
// and the mascots read behind the translucent scene. Each sits at its own height
// down the strip, alternating left and right, so they stay spread out.
export function CampusCritters() {
  return (
    <div
      aria-label="Dallas College campus mascots"
      className="pointer-events-none absolute inset-y-0 left-0 right-0 z-10 overflow-hidden sm:right-[500px]"
    >
      <Floater
        src="/mascots/sun.svg"
        alt="Cedar Valley Suns"
        className="top-[2%] left-[7%]"
        drift={4.5}
        sway={5}
        flourish={<Sparkles delay={0} />}
      />
      <Floater
        src="/mascots/eagle.svg"
        alt="El Centro Eagles"
        className="top-[16%] right-[3%]"
        drift={6}
        sway={4.5}
      />
      <Floater
        src="/mascots/bee.svg"
        alt="Eastfield Harvester Bees"
        className="top-[30%] left-[9%]"
        drift={5.5}
        sway={4}
      />
      <Floater
        src="/mascots/duck.svg"
        alt="Richland Thunderducks"
        className="top-[44%] right-[5%]"
        drift={5}
        sway={4.5}
        flourish={<Lightning delay={-0.4} />}
      />
      <Floater
        src="/mascots/lion.svg"
        alt="Mountain View Lions"
        className="top-[58%] left-[6%]"
        drift={5.2}
        sway={4.2}
      />
      <Floater
        src="/mascots/bear.svg"
        alt="Brookhaven Bears"
        className="top-[72%] right-[7%]"
        drift={4.8}
        sway={5}
      />
      <Floater
        src="/mascots/blazer.svg"
        alt="North Lake Blazers"
        className="bottom-[3%] left-[11%]"
        drift={5.4}
        sway={4}
      />
    </div>
  );
}
