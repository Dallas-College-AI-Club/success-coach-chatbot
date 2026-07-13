// The Dallas College campus mascots (vectors from public/mascots/), brought to
// life beside the note card. They stay in the VISIBLE left band — clear of the
// chat card — so they're always on screen instead of strolling behind it. Ground
// mascots hop in place with a squash-and-stretch bounce and a shadow that shifts
// with the hop; sky mascots drift and sway. Small original flourishes (a lightning
// spark, sun sparkles) are drawn beside the logos. All motion is transform/opacity
// only, desynced per instance, and gated behind motion-safe.
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

// A ground mascot that hops in place (squash & stretch) with a contact shadow
// that widens on the squash and shrinks when airborne, so the bounce has weight.
const Hopper = ({
  src,
  alt,
  className,
  delay,
  hop = 3.2,
  flourish,
}: {
  src: string;
  alt: string;
  className: string;
  delay: number;
  hop?: number;
  flourish?: ReactNode;
}) => {
  const hopVars = { "--h": `${hop}s`, animationDelay: `${delay}s` } as CSSProperties;
  return (
    <div className={`absolute h-14 sm:h-16 ${className}`}>
      <div
        className="h-full origin-bottom motion-safe:animate-[hop_var(--h)_cubic-bezier(.34,.62,.4,1)_infinite]"
        style={hopVars}
      >
        <Badge src={src} alt={alt} />
      </div>
      <div
        aria-hidden
        className="absolute -bottom-0.5 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-[50%] bg-[#1e2a3a] opacity-25 blur-[1.5px] motion-safe:animate-[land-shadow_var(--h)_cubic-bezier(.34,.62,.4,1)_infinite]"
        style={hopVars}
      />
      {flourish}
    </div>
  );
};

// A sky mascot that hovers in place — a gentle vertical drift plus a soft sway.
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
// and the mascots read behind the translucent scene.
export function CampusCritters() {
  return (
    <div
      aria-label="Dallas College campus mascots"
      className="pointer-events-none absolute inset-y-0 left-0 right-0 z-10 overflow-hidden sm:right-[500px]"
    >
      {/* sky — the three that fly */}
      <Floater
        src="/mascots/sun.svg"
        alt="Cedar Valley Suns"
        className="top-2 left-[3%]"
        drift={4.5}
        sway={5}
        flourish={<Sparkles delay={0} />}
      />
      <Floater
        src="/mascots/eagle.svg"
        alt="El Centro Eagles"
        className="top-[4%] left-[45%]"
        drift={6}
        sway={4.5}
      />
      <Floater
        src="/mascots/bee.svg"
        alt="Eastfield Harvester Bees"
        className="top-[20%] right-[4%]"
        drift={5.5}
        sway={4}
      />

      {/* ground — the four that walk, a cheering huddle along the bottom */}
      <Hopper
        src="/mascots/duck.svg"
        alt="Richland Thunderducks"
        className="bottom-2 left-[1%]"
        delay={-0.2}
        hop={2.9}
        flourish={<Lightning delay={-0.4} />}
      />
      <Hopper
        src="/mascots/lion.svg"
        alt="Mountain View Lions"
        className="bottom-2 left-[27%]"
        delay={-0.9}
        hop={3.1}
      />
      <Hopper
        src="/mascots/bear.svg"
        alt="Brookhaven Bears"
        className="bottom-2 left-[53%]"
        delay={-0.5}
        hop={3.4}
      />
      <Hopper
        src="/mascots/blazer.svg"
        alt="North Lake Blazers"
        className="bottom-2 right-[2%]"
        delay={-1.3}
        hop={2.7}
      />
    </div>
  );
}
