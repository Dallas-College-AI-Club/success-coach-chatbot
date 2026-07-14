"use client";

import { anton, dancingScript } from "@/features/onboarding/variants/fonts";
import { useEffect, useRef, useState } from "react";

// The Success Coach cover. Uses the club's own artwork at
// public/success-coach-cover.png when present; otherwise falls back to a coded
// version in Dallas College colors (blue script "Success" over a red "COACH"
// block with a blue CHAT BOT bar).
export function SuccessCoachCover({ className = "" }: { className?: string }) {
  const [imgOk, setImgOk] = useState(true);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setImgOk(false);
  }, []);

  if (imgOk) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={ref}
        src="/title.png"
        alt="Success Coach chat bot"
        width={1182}
        height={852}
        className={`h-auto w-72 max-w-full md:w-96 ${className}`}
        onError={() => setImgOk(false)}
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth === 0) setImgOk(false);
        }}
      />
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <span
        className={`${dancingScript.className} relative z-10 -mb-4 text-5xl leading-none text-[#003385] md:-mb-6 md:text-6xl`}
      >
        Success
      </span>
      <span
        className={`${anton.className} text-6xl leading-[0.9] tracking-tight text-[#E52626] md:text-7xl`}
      >
        COACH
      </span>
      <span className="mt-2 bg-[#003385] px-5 py-1 text-xs font-medium tracking-[0.42em] text-white">
        CHAT&nbsp;BOT
      </span>
    </div>
  );
}

// The Success Coach wordmark at header size. Uses public/title.png when present;
// falls back to a compact coded lockup (blue script "Success" + red "COACH") so a
// missing image never shows a broken-image icon.
export function SuccessCoachWordmark({
  height = 46,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  const [ok, setOk] = useState(true);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setOk(false);
  }, []);
  if (ok) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={ref}
        src="/title.png"
        alt="Success Coach"
        width={1182}
        height={852}
        style={{ height, width: "auto" }}
        className={className}
        onError={() => setOk(false)}
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth === 0) setOk(false);
        }}
      />
    );
  }
  return (
    <span
      aria-label="Success Coach"
      className={`flex items-center gap-1 leading-none ${className}`}
      style={{ height }}
    >
      <span className={`${dancingScript.className} text-2xl text-[#003385]`}>
        Success
      </span>
      <span className={`${anton.className} text-xl tracking-tight text-[#E52626]`}>
        COACH
      </span>
    </span>
  );
}

// The Dallas College AI Club logo, linking to the club site. Falls back to a
// text lockup until the image is added at public/logo.png.
export function AiClubLogo({ className = "" }: { className?: string }) {
  const [ok, setOk] = useState(true);
  const ref = useRef<HTMLImageElement>(null);
  // The image can finish (and fail) before React attaches onError during
  // hydration; catch that already-broken state on mount.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setOk(false);
  }, []);
  return (
    <a
      href="https://dallasai.club/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Dallas College AI Club — opens in a new tab"
      className={`inline-flex items-center ${className}`}
    >
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={ref}
          src="/logo.png"
          alt="Dallas College AI Club"
          width={356}
          height={380}
          style={{ height: 44, width: "auto" }}
          className="object-contain"
          onError={() => setOk(false)}
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth === 0) setOk(false);
          }}
        />
      ) : (
        <span className="text-xs font-semibold leading-tight tracking-wide text-current opacity-80">
          Dallas College
          <br />
          AI Club
        </span>
      )}
    </a>
  );
}
