"use client";

import { useEffect, useRef } from "react";
import type { Controller } from "./approved-mascot-motion";

/** Decorative Playful cast. Layout and all question/chat interactions stay outside it. */
export function CampusCritters() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let closed = false;
    let scene: Controller | undefined;
    const target = canvas.current;
    if (!target) return;

    void import("./approved-mascot-motion")
      .then(async ({ startMascotScene }) => {
        if (closed) return;
        const loaded = await startMascotScene(target);
        if (closed) loaded.dispose();
        else scene = loaded;
      })
      .catch((error: unknown) => {
        if (!closed)
          console.warn("Playful mascot artwork could not load", error);
      });

    return () => {
      closed = true;
      scene?.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
    />
  );
}
