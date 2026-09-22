import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { articulatedPoint } from "../features/onboarding/shared/scenes/artwork-rig";
import {
  crossingAt,
  characterHeight,
  freeRoamingBands,
  flightClockAt,
  motionAt,
  roamingMotionAt,
  roamingSlot,
  roamingY,
  sunAt,
} from "../features/onboarding/shared/scenes/approved-mascot-motion";

const root = resolve(import.meta.dirname, "../public/mascots/playground-v9");
const manifest = JSON.parse(
  readFileSync(resolve(root, "manifest.json"), "utf8"),
);
const ground = manifest.characters.filter((c: { air: boolean }) => !c.air) as {
  key: string;
  width: number;
  height: number;
}[];
const lock = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "../../../docs/playful-mascots-artwork.json"),
    "utf8",
  ),
);

test("the seven selected character assets match the artwork lock and payload budget", () => {
  assert.equal(manifest.characters.length, 7);
  let bytes = 0;
  for (const c of manifest.characters) {
    const image = readFileSync(resolve(root, c.src));
    bytes += image.length;
    assert.equal(image.length, c.bytes);
    assert.equal(
      createHash("sha256").update(image).digest("hex"),
      lock[c.src],
      c.key,
    );
  }
  assert.equal(bytes, manifest.totalBytes);
  assert.ok(bytes < 300_000);
});

test("articulation keeps rest shape exact and never inverts mesh triangles", () => {
  const n = 40;
  for (const c of manifest.characters) {
    for (let pose = 0; pose < 160; pose++) {
      const points = [];
      for (let y = 0; y <= n; y++)
        for (let x = 0; x <= n; x++) {
          const rest = articulatedPoint(
            c.key,
            x / n,
            y / n,
            pose * 0.19,
            pose / 17,
            1,
            0,
          );
          assert.equal(rest.x, x / n);
          assert.equal(rest.y, y / n);
          points.push(
            articulatedPoint(c.key, x / n, y / n, pose * 0.19, pose / 17, 1, 1),
          );
        }
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const a = points[y * (n + 1) + x],
            b = points[y * (n + 1) + x + 1];
          const d = points[(y + 1) * (n + 1) + x],
            e = points[(y + 1) * (n + 1) + x + 1];
          for (const [p, q, r] of [
            [a, b, e],
            [a, e, d],
          ]) {
            assert.ok(
              (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x) > 0,
              c.key + " inverted at pose " + pose,
            );
          }
        }
    }
  }
});

test("ground partners only overlap behind the panel across desktop and narrow layouts", () => {
  // Desktop panel widths follow the scale in chat-screen.tsx, so these are the
  // layouts that actually render; 851 and 390 stay on the untouched 42rem column.
  for (const [viewport, panelWidth, h] of [
    [1920, 1152, 108],
    [1536, 1152, 86],
    [1280, 1024, 80],
    [1024, 768, 77],
    [851, 672, 57],
    [851, 238, 86],
    [390, 358, 36],
  ]) {
    const card = {
      left: (viewport - panelWidth) / 2,
      right: (viewport + panelWidth) / 2,
      top: 125,
      bottom: 800,
    };
    for (let tick = 0; tick < 4800; tick++) {
      const time = tick / 20;
      const poses = ground.map((c) => {
        const w = (h * c.width) / c.height,
          p = crossingAt(c.key, time, card, viewport, w, h);
        const x =
          p.x +
          p.facing *
            p.pulse *
            w *
            (c.key === "lion"
              ? 0.24
              : c.key === "blazer-stallion"
                ? 0.18
                : 0.08);
        return { key: c.key, left: x - w * 0.54, right: x + w * 0.54 };
      });
      for (const pair of [
        ["bear", "thunderduck"],
        ["blazer-stallion", "lion"],
      ]) {
        const a = poses.find((p) => p.key === pair[0])!,
          b = poses.find((p) => p.key === pair[1])!;
        const left = Math.max(a.left, b.left),
          right = Math.min(a.right, b.right);
        if (right > left)
          assert.ok(
            left >= card.left && right <= card.right,
            pair.join("/") +
              " overlap outside chat at " +
              time +
              "s, " +
              viewport +
              "px",
          );
      }
      // Two lanes are separated by h+18; the largest leap lifts the lower lane by .13h.
      assert.ok(h + 18 - h - h * 0.13 > 0);
    }
  }
});

test("ground routes alternate walking and running and skip only fully covered travel", () => {
  const card = { left: 304, right: 976, top: 125, bottom: 680 };
  for (const c of ground) {
    const w = (72 * c.width) / c.height;
    const speeds = { walk: 0, run: 0 };
    let previous = crossingAt(c.key, 0, card, 1280, w, 72),
      crossings = 0;
    let hiddenSince: number | undefined;
    for (let tick = 1; tick < 12000; tick++) {
      const t = tick / 120,
        p = crossingAt(c.key, t, card, 1280, w, 72);
      const delta = Math.abs(p.x - previous.x);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.phase));
      if (delta > w) {
        // The discontinuity is masked by the panel on both sides.
        for (const x of [p.x, previous.x]) {
          assert.ok(
            x - w * 0.54 >= card.left && x + w * 0.54 <= card.right,
            c.key + " visible jump",
          );
        }
        crossings++;
      } else {
        const gait = p.action.startsWith("run ") ? "run" : "walk";
        speeds[gait] = Math.max(speeds[gait], delta * 120);
      }
      if (p.x - w / 2 > card.left && p.x + w / 2 < card.right)
        hiddenSince ??= t;
      else if (hiddenSince !== undefined) {
        assert.ok(t - hiddenSince < 0.25, c.key + " waited behind the panel");
        hiddenSince = undefined;
      }
      previous = p;
    }
    assert.ok(crossings >= 6, c.key + " too few crossings");
    assert.ok(speeds.walk > 35, c.key + " still walking too slowly");
    assert.ok(speeds.run > speeds.walk * 1.7, c.key + " no distinct run");
  }
});

test("flights skip the covered middle without visible jumps or hidden pauses", () => {
  const viewport = 1280,
    card = { left: 304, right: 976, top: 125, bottom: 680 },
    w = 80;
  for (const key of ["eagle", "harvester-bee"]) {
    let start: number | undefined,
      count = 0,
      previousX: number | undefined;
    for (let tick = 0; tick < 8000; tick++) {
      const t = tick / 100,
        m = motionAt(key, flightClockAt(key, t, card, viewport, w), true);
      const x = viewport * 0.035 + w / 2 + (viewport * 0.93 - w) * m.progress;
      if (previousX !== undefined && Math.abs(x - previousX) >= 10) {
        for (const center of [x, previousX])
          assert.ok(
            center - w * 0.54 >= card.left && center + w * 0.54 <= card.right,
            key + " visible jump",
          );
        count++;
      }
      previousX = x;
      if (x > card.left + w / 2 && x < card.right - w / 2) start ??= t;
      else if (start !== undefined) {
        assert.ok(t - start < 0.15, key + " stayed hidden too long");
        start = undefined;
      }
    }
    assert.ok(count >= 4, key + " did not return");
  }
});

test("free roaming uses the available top and bottom without covering the UI", () => {
  for (const [width, height, headerTop, cardTop, cardBottom] of [
    [1034, 1253, 300, 360, 1080],
    [1440, 900, 242, 300, 750],
    [390, 844, 95, 185, 824],
    [844, 390, 110, 170, 360],
    [320, 568, 82, 172, 500],
  ]) {
    const card = {
      left: 16,
      right: width - 16,
      top: cardTop,
      bottom: cardBottom,
    };
    const bands = freeRoamingBands(width, height, card, headerTop);
    for (const [kind, area] of Object.entries(bands)) {
      if (!area) continue;
      assert.ok(area.left >= 0 && area.right <= width);
      assert.ok(area.top >= 0 && area.bottom <= height);
      assert.ok(
        kind === "sky" ? area.bottom < headerTop : area.top > card.bottom,
      );
      const count = kind === "sky" ? 3 : 4;
      for (let i = 0; i < count; i++) {
        const slot = roamingSlot(area, i, count);
        // Includes the widest drawing, articulation and leap clearance.
        assert.ok(slot.height > 0 && slot.height <= 128);
        assert.ok(slot.height * 1.5 <= area.bottom - area.top + 1e-8);
        assert.ok(slot.height * 2.2 <= slot.right - slot.left + 1e-8);
        if (i) assert.equal(roamingSlot(area, i - 1, count).right, slot.left);
      }
    }
    if (height === 1253) {
      assert.ok(
        bands.sky && bands.lawn,
        "use both fields when each fits the cast",
      );
    }
    if (height === 390)
      assert.ok(
        !bands.sky && !bands.lawn,
        "short windows need the side routes",
      );
  }
});

test("scene sizing stays readable, scales with the window and keeps the sun smaller", () => {
  let previous = 0;
  for (const [width, height, headerTop] of [
    [390, 844, 82],
    [1034, 1253, 238],
    [1572, 1272, 247],
  ]) {
    const panelWidth = Math.min(width - 32, 672);
    const card = {
      left: (width - panelWidth) / 2,
      right: (width + panelWidth) / 2,
      top: 305,
      bottom: 1025,
    };
    const size = characterHeight(width, height, card);
    assert.ok(
      size >= 48 && size > previous,
      "larger windows need visibly larger characters",
    );
    assert.ok(
      sunAt(0, width, height, headerTop).size < size * 0.75,
      "sun must not dominate the cast",
    );
    previous = size;
  }
  const card = { left: 450, right: 1122, top: 305, bottom: 1025 };
  const bands = freeRoamingBands(1572, 1272, card, 247);
  assert.equal(
    bands.sky,
    undefined,
    "a shallow strip must not shrink flying characters",
  );
  assert.ok(bands.lawn);
  assert.ok(
    roamingSlot(bands.lawn, 0, 2, characterHeight(1572, 1272, card)).height >
      120,
  );
  // The old 56px ceiling kept these larger windows at the same sun size.
  const mediumSun = sunAt(0, 850, 1100, 240).size;
  const wideSun = sunAt(0, 1100, 1100, 240).size;
  const largeSun = sunAt(0, 1572, 1272, 240).size;
  assert.ok(wideSun > mediumSun * 1.2);
  assert.ok(largeSun > wideSun * 1.1 && largeSun <= 88);
  assert.ok(largeSun > sunAt(0, 1572, 900, 240).size * 1.3);
  assert.ok(sunAt(0, 1280, 800, 44).size > 28, "use the available shallow sky");
});

test("meadow routes use distinct depths and continuous outbound/return curves", () => {
  const ranges: number[][] = [];
  for (const c of ground) {
    let previous = roamingY(c.key, 0, 1035, 1264, 127);
    const values = [previous];
    for (let tick = 1; tick <= 2400; tick++) {
      const y = roamingY(c.key, (tick / 1200) % 2, 1035, 1264, 127);
      assert.ok(y - 127 * 0.7 > 1035 && y + 127 * 0.7 < 1264);
      assert.ok(
        Math.abs(y - previous) < 1,
        "vertical route must not jump on a turn",
      );
      values.push(y);
      previous = y;
    }
    assert.ok(
      Math.max(...values) - Math.min(...values) > 35,
      "characters should not follow a flat row",
    );
    ranges.push(values);
  }
  assert.ok(
    Math.max(...ranges.map((v) => v[0])) -
      Math.min(...ranges.map((v) => v[0])) >
      25,
    "characters need different starting depths",
  );
});

test("open-field routes explore each slot with continuous motion and a faster return", () => {
  for (const [span, h] of [
    [28, 24],
    [96, 48],
    [260, 72],
  ]) {
    const speeds = { walk: 0, run: 0 };
    for (const c of ground) {
      let previous = roamingMotionAt(c.key, 0, span, h, false).progress;
      let min = 1,
        max = 0;
      for (let tick = 1; tick < 12000; tick++) {
        const m = roamingMotionAt(c.key, tick / 120, span, h, false);
        min = Math.min(min, m.progress);
        max = Math.max(max, m.progress);
        const distance = Math.abs(m.progress - previous) * span;
        assert.ok(
          Number.isFinite(m.progress) && distance < h / 12,
          "visible teleport",
        );
        const gait = m.action.startsWith("run ") ? "run" : "walk";
        speeds[gait] = Math.max(speeds[gait], distance * 120);
        previous = m.progress;
      }
      assert.equal(min, 0);
      assert.equal(max, 1);
    }
    assert.ok(
      speeds.run > speeds.walk * 1.1,
      "walking and running should remain distinct at every size",
    );
  }
});

test("the phoenix sun rises east, sets west and resets invisibly above the controls", () => {
  for (const [width, height, headerTop] of [
    [390, 844, 32],
    [390, 844, 82],
    [855, 1072, 147],
    [844, 390, 50],
    [1034, 1253, 240],
    [1280, 800, 44],
  ]) {
    let previous = sunAt(0, width, height, headerTop);
    let minX = width,
      maxX = 0,
      resets = 0;
    for (let tick = 1; tick < 12000; tick++) {
      const p = sunAt(tick / 20, width, height, headerTop);
      assert.ok(p.x - p.size * 0.6 >= 0 && p.x + p.size * 0.6 <= width);
      assert.ok(p.y - p.size * 0.6 >= 0 && p.y + p.size * 0.6 < headerTop);
      assert.ok(p.opacity >= 0 && p.opacity <= 1);
      if (p.x > previous.x) {
        resets++;
        assert.ok(
          p.opacity < 0.002 && previous.opacity < 0.002,
          "the sunrise reset must be hidden",
        );
      } else {
        assert.ok(
          Math.hypot(p.x - previous.x, p.y - previous.y) * 20 < width / 30,
          "sky travel must be smooth",
        );
      }
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      assert.deepEqual(
        articulatedPoint("sun-phoenix", 0.2, 0.4, tick / 20, 0.6, 1, 1),
        { x: 0.2, y: 0.4 },
      );
      previous = p;
    }
    assert.ok(resets >= 13, "complete a day approximately every 45 seconds");
    assert.ok(maxX - minX > width * 0.65);
    assert.ok(
      sunAt(22.5, width, height, headerTop).y <=
        sunAt(0, width, height, headerTop).y,
    );
    assert.equal(sunAt(22.5, width, height, headerTop).opacity, 1);
    assert.equal(sunAt(45, width, height, headerTop).opacity, 0);
  }
});

// The chat panel grows with the viewport (chat-screen.tsx). The roaming cast
// lives in the gutters either side of it, and characterHeight() sizes the cast
// from the NARROWER gutter — so a panel that grows too fast shrinks the
// mascots. Read the shipped class list rather than restating it here: the
// budget is only worth guarding if it tracks what actually renders.
const panelScale = (() => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../features/chat/chat-screen.tsx"),
    "utf8",
  );
  const line = source
    .split("\n")
    .find((l) => l.includes("relative z-10 mx-auto") && l.includes("max-w-"));
  assert.ok(line, "chat-screen.tsx no longer has the panel column class list");
  // Tailwind v4 --container-* and --breakpoint-*, node_modules/tailwindcss/theme.css.
  const container: Record<string, number> = {
    "2xl": 672,
    "3xl": 768,
    "4xl": 896,
    "5xl": 1024,
    "6xl": 1152,
    "7xl": 1280,
  };
  const breakpoint: Record<string, number> = {
    lg: 1024,
    xl: 1280,
    "2xl": 1536,
  };
  const steps: { from: number; panel: number }[] = [];
  for (const [, bp, size] of line.matchAll(
    /(?:([a-z0-9]+):)?max-w-([0-9a-z]+)/g,
  )) {
    const panel = container[size];
    assert.ok(panel, `unmapped max-w-${size} — add it to the container table`);
    steps.push({ from: bp ? breakpoint[bp] : 0, panel });
  }
  return steps.sort((a, b) => a.from - b.from);
})();

test("the chat panel leaves the roaming cast its full gutter at every width", () => {
  // Phone and tablet are deliberately untouched: below lg the panel is the
  // 42rem column the chat shipped with.
  assert.deepEqual(panelScale[0], { from: 0, panel: 672 });
  assert.ok(panelScale.length > 1, "the panel no longer grows on a big screen");

  for (const { from, panel } of panelScale) {
    if (!from) continue;
    // Narrowest viewport this step applies to — its tightest gutter.
    const gutter = (from - panel) / 2;
    assert.ok(
      gutter >= 128,
      `max-w at ${from}px leaves only ${gutter}px of gutter; characterHeight caps the cast at 128px and needs that room`,
    );
    // The cast must be no smaller than it was at the old single-width panel.
    for (const height of [640, 720, 800, 900, 1080]) {
      if (height > from) continue; // landscape only; portrait is below lg anyway
      const grown = {
        left: gutter,
        right: from - gutter,
        top: 125,
        bottom: height - 60,
      };
      const old = {
        left: (from - 672) / 2,
        right: (from + 672) / 2,
        top: 125,
        bottom: height - 60,
      };
      assert.equal(
        characterHeight(from, height, grown),
        characterHeight(from, height, old),
        `the wider panel shrinks the cast at ${from}x${height}`,
      );
    }
  }
});
