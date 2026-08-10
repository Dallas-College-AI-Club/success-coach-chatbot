// The Dallas College campus mascots (vectors from public/mascots/), brought to
// life beside the note card. They live in the VISIBLE left band — clear of the
// chat card — which on desktop is a narrow but tall strip. So instead of a bottom
// row (which would crowd and overlap in the narrow width), they're scattered down
// the strip at distinct heights in a gentle left-right zigzag: each mascot sits at
// its own height, so they never pile up, and each floats on its own beat.
// Small original flourishes (a lightning spark on the Thunderduck, sparkles by the
// Sun) are drawn beside the logos. All motion is transform/opacity only and
// desynced per instance — see .critter in globals.css for the float/breathe/bank
// cycle, and the flourishes below for the motion-safe: opacity blinks.
import Image from "next/image";
import { type CSSProperties, type ReactNode } from "react";

// `w`/`h` are the SVG viewBox dimensions, so Next's Image holds the aspect ratio.
// Mascots are vector art, so `unoptimized` skips the raster optimizer (which also
// declines SVGs by default) — Image still gives us the standard component and
// caching in place of a raw <img>.
const Badge = ({
  src,
  alt,
  w,
  h,
}: {
  src: string;
  alt: string;
  w: number;
  h: number;
}) => (
  <Image
    src={src}
    alt={alt}
    width={w}
    height={h}
    unoptimized
    loading="eager"
    draggable={false}
    className="h-full w-auto object-contain drop-shadow-[0_3px_5px_rgba(30,42,58,.22)]"
  />
);

// A mascot that hangs in the band — one body on one clock: it floats, breathes
// with the float, and banks a beat behind it (see .critter in globals.css). The
// whole character moves together; no part animates on its own, because a single
// appendage moving on an otherwise rigid body reads as a rendering fault rather
// than as life. `phase` is negative so each starts mid-cycle — no mount hiccup.
const Floater = ({
  src,
  alt,
  w,
  h,
  className,
  beat,
  phase,
  flourish,
}: {
  src: string;
  alt: string;
  w: number;
  h: number;
  className: string;
  beat: number;
  phase: number;
  flourish?: ReactNode;
}) => (
  <div
    className={`critter absolute h-11 sm:h-12 ${className}`}
    style={{ "--beat": `${beat}s`, "--phase": `${phase}s` } as CSSProperties}
  >
    <Badge src={src} alt={alt} w={w} h={h} />
    {flourish}
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
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 right-0 z-10 overflow-hidden sm:right-[500px]"
    >
      <Floater
        src="/mascots/sun.svg"
        alt="Cedar Valley Suns"
        w={143}
        h={143}
        className="top-[2%] left-[7%]"
        beat={4.5}
        phase={-0.0}
        flourish={<Sparkles delay={0} />}
      />
      <Floater
        src="/mascots/eagle.svg"
        alt="El Centro Eagles"
        w={297}
        h={161}
        className="top-[16%] right-[3%]"
        beat={6}
        phase={-2.3}
      />
      <Floater
        src="/mascots/bee.svg"
        alt="Eastfield Harvester Bees"
        w={189}
        h={183}
        className="top-[30%] left-[9%]"
        beat={5.5}
        phase={-4.1}
      />
      <Floater
        src="/mascots/duck.svg"
        alt="Richland Thunderducks"
        w={182}
        h={209}
        className="top-[44%] right-[5%]"
        beat={5}
        phase={-1.2}
        flourish={<Lightning delay={-0.4} />}
      />
      <Floater
        src="/mascots/lion.svg"
        alt="Mountain View Lions"
        w={190}
        h={148}
        className="top-[58%] left-[6%]"
        beat={5.2}
        phase={-3.4}
      />
      <Floater
        src="/mascots/bear.svg"
        alt="Brookhaven Bears"
        w={183}
        h={224}
        className="top-[72%] right-[7%]"
        beat={4.8}
        phase={-0.7}
      />
      <Floater
        src="/mascots/blazer.svg"
        alt="North Lake Blazers"
        w={223}
        h={174}
        className="bottom-[3%] left-[11%]"
        beat={5.4}
        phase={-2.9}
      />
    </div>
  );
}
