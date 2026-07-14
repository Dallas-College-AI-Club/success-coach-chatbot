import Image from "next/image";

// Success Coach cover + header wordmark, and the AI Club logo. All three are
// static assets committed to /public, so they always resolve — Next's Image gives
// optimization, caching, and correct responsive sizing. (No runtime broken-image
// fallback: the art is in the repo, so it can't go missing at request time.)

export function SuccessCoachCover({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/title.png"
      alt="Success Coach chat bot"
      width={1182}
      height={852}
      priority
      className={`h-auto w-72 max-w-full md:w-96 ${className}`}
    />
  );
}

// Header-sized wordmark. `height` sets the rendered height; width stays auto so
// the aspect ratio is preserved.
export function SuccessCoachWordmark({
  height = 46,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return (
    <Image
      src="/title.png"
      alt="Success Coach"
      width={1182}
      height={852}
      priority
      style={{ height, width: "auto" }}
      className={className}
    />
  );
}

// The Dallas College AI Club logo, linking to the club site.
export function AiClubLogo({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://dallasai.club/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Dallas College AI Club — opens in a new tab"
      className={`inline-flex items-center ${className}`}
    >
      <Image
        src="/logo.png"
        alt="Dallas College AI Club"
        width={356}
        height={380}
        priority
        className="h-11 w-auto object-contain"
      />
    </a>
  );
}
