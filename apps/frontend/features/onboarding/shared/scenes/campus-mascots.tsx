// The real Dallas College campus mascots — the official athletics logos, served
// from public/mascots/. Shown together as a school-spirit band so every campus
// is represented. Decorative; the shell carries the real state. Each badge
// drifts gently on its own beat.

const MASCOTS = [
  { src: "/mascots/bears.png", alt: "Brookhaven Bears" },
  { src: "/mascots/suns.png", alt: "Cedar Valley Suns" },
  { src: "/mascots/bees.png", alt: "Eastfield Harvester Bees" },
  { src: "/mascots/eagles.png", alt: "El Centro Eagles" },
  { src: "/mascots/lions.png", alt: "Mountain View Lions" },
  { src: "/mascots/blazers.png", alt: "North Lake Blazers" },
  { src: "/mascots/thunderducks.png", alt: "Richland Thunderducks" },
];

export function MascotBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-1 sm:gap-2 ${className}`}>
      {MASCOTS.map((m, i) => (
        <div
          key={m.src}
          className="flex h-full min-w-0 flex-1 items-center justify-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.src}
            alt={m.alt}
            className="max-h-full max-w-full object-contain drop-shadow-sm motion-safe:animate-[drift_3.4s_ease-in-out_infinite]"
            style={{ animationDelay: `${(i % 5) * 0.18}s` }}
          />
        </div>
      ))}
    </div>
  );
}
