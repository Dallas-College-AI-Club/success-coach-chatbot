"use client";

import { useEffect, useRef } from "react";

/**
 * Move keyboard focus to a heading when `dep` changes — pass the step index to
 * refocus on each step, or a constant (e.g. `null`) to focus once on mount. Keeps
 * the flow navigable: every screen announces its heading. `preventScroll` avoids
 * a jump when focus lands.
 */
export function useHeadingFocus(dep: unknown) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [dep]);
  return ref;
}
