import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { articulatedPoint } from "../features/onboarding/shared/scenes/artwork-rig";
import {
  crossingAt,
  flightClockAt,
  motionAt,
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

test("accepted expressions and body artwork remain the approved seven assets", () => {
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
  for (const [viewport, panelWidth, h] of [
    [1280, 672, 72],
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
  for (const key of ["sun-phoenix", "eagle", "harvester-bee"]) {
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
