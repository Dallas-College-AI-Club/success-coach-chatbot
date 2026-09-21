import { createArtworkRig, type RigDraw } from "./artwork-rig";
type Character = {
  key: string;
  name: string;
  src: string;
  width: number;
  height: number;
  bytes: number;
  air: boolean;
};
type Loaded = Character & { image: HTMLImageElement };
type Panel = { left: number; right: number; top: number; bottom: number };

function campusHorizonHeight(width: number, height: number, headerTop: number) {
  return Math.max(
    0,
    Math.min(width * 0.24, height * 0.24, 180, Math.max(96, headerTop - 4)),
  );
}

/** A 45-second day rises in the east (right) and sets in the west (left). */
export function sunAt(
  time: number,
  width: number,
  height: number,
  headerTop: number,
) {
  const horizon = campusHorizonHeight(width, height, headerTop);
  const preferredSize = clamp(Math.min(width, height) * 0.07, 28, 88);
  // Use the actual sky clearance instead of an arbitrary fraction of the header.
  // Crest + lower edge = 1.25 * size + 4; leave four pixels above the controls.
  const size = Math.max(12, Math.min(preferredSize, (headerTop - 8) / 1.25));
  const margin = size * 0.65 + 10;
  const progress = cycle(time, 45) / 45;
  const crest = size * 0.65 + 4;
  const baseline = Math.max(
    crest,
    Math.min(horizon, headerTop - 4) - size * 0.65,
  );
  return {
    size,
    x: width - margin - (width - margin * 2) * progress,
    y: baseline - Math.sin(progress * Math.PI) * (baseline - crest),
    // Hide the reset between sunset and the next sunrise.
    opacity: smooth(progress / 0.06) * smooth((1 - progress) / 0.06),
  };
}

/** Size the cast for the scene, never for a thin strip beside the chat. */
export function characterHeight(width: number, height: number, card: Panel) {
  const side = Math.min(card.left, width - card.right);
  return clamp(
    Math.min(width, height) * 0.1,
    Math.min(48, height * 0.1),
    Math.max(48, Math.min(128, side * 0.85)),
  );
}

/** Only use a free band when it has room for full-size, two-dimensional travel. */
export function freeRoamingBands(
  width: number,
  height: number,
  card: Panel,
  headerTop: number,
) {
  const sky = {
    left: 8,
    right: width - 8,
    top: campusHorizonHeight(width, height, headerTop) + 8,
    bottom: headerTop - 10,
  };
  const lawn = {
    left: 8,
    right: width - 8,
    top: card.bottom + 10,
    bottom: height - 8,
  };
  const size = characterHeight(width, height, card);
  return {
    sky: sky.bottom - sky.top >= size * 1.8 ? sky : undefined,
    lawn: lawn.bottom - lawn.top >= size * 1.8 ? lawn : undefined,
  };
}

export function roamingSlot(
  area: Panel,
  index: number,
  count: number,
  size = 128,
) {
  const span = (area.right - area.left) / count;
  return {
    left: area.left + span * index,
    right: area.left + span * (index + 1),
    top: area.top,
    bottom: area.bottom,
    height: Math.min(size, (area.bottom - area.top) / 1.8, span / 2.2),
  };
}

/** Outbound and return curves meet smoothly, with a different depth for each friend. */
export function roamingY(
  key: string,
  travel: number,
  top: number,
  bottom: number,
  size: number,
) {
  const phase =
    { bear: 0.3, "blazer-stallion": 2.1, lion: 4.2, thunderduck: 5.4 }[key] ??
    0;
  const middle = (top + bottom) / 2;
  const radius = Math.max(0, (bottom - top - size * 1.5) / 2);
  return middle + Math.sin(travel * Math.PI + phase) * radius;
}
export type Controller = {
  dispose: () => void;
  pause: (value: boolean) => void;
  inspect: (key: string | null) => void;
  seek: (seconds: number) => void;
};
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
const cycle = (v: number, p: number) => ((v % p) + p) % p;
const periods: Record<string, number> = {
  bear: 23,
  "blazer-stallion": 19,
  lion: 27,
  thunderduck: 21,
  "sun-phoenix": 20,
  eagle: 23,
  "harvester-bee": 13,
};
const personality: Record<string, string> = {
  bear: "warm welcome",
  "blazer-stallion": "eager explorer",
  lion: "cheerful playmate",
  thunderduck: "playful spark",
  "sun-phoenix": "warm sunshine",
  eagle: "friendly lookout",
  "harvester-bee": "delighted curiosity",
};
// Each phrase has a destination, a settle, and a return. Gait phase derives from
// distance, so accelerating the character also accelerates its foot cycle.
export function motionAt(key: string, time: number, air = false) {
  const period = periods[key] ?? 23,
    t = cycle(time, period),
    out = t < period * 0.5;
  const local = out ? t : t - period * 0.5,
    start = period * 0.07,
    duration = period * 0.3;
  const u = clamp((local - start) / duration),
    travel = smooth(u),
    speed = u > 0 && u < 1 ? (6 * u * (1 - u)) / duration : 0;
  const progress = out ? travel : 1 - travel,
    moving = speed > 0;
  const actions: Record<string, [string, string]> = {
    bear: ["stroll to watch the game", "pause and welcome"],
    "blazer-stallion": ["trot along the field", "look toward friends"],
    lion: ["follow the rolling ball", "settle beside the ball"],
    thunderduck: ["waddle toward the spark", "lightning flourish"],
    "sun-phoenix": ["shine above the campuses", "warm sunshine"],
    eagle: ["survey the field", "coast and look around"],
    "harvester-bee": ["visit the flowers", "hover over a blossom"],
  };
  const lift =
    air && key !== "sun-phoenix"
      ? Math.sin(travel * Math.PI) * (key === "harvester-bee" ? -0.025 : 0.07)
      : 0;
  const playTime = local - (start + duration + 0.15),
    playDuration =
      key === "bear"
        ? 1.65
        : key === "thunderduck"
          ? 0.78
          : key === "blazer-stallion"
            ? 1.05
            : 0.92;
  const play =
    playTime > 0 && playTime < playDuration ? playTime / playDuration : -1;
  const pulse = play >= 0 ? Math.sin(Math.PI * play) : 0;
  const arc = play >= 0 ? 4 * play * (1 - play) : 0;
  return {
    progress,
    play,
    pulse,
    arc,
    travel: (out ? 0 : 1) + travel,
    travelUnit: travel,
    u,
    duration,
    speed,
    facing: out ? 1 : -1,
    airY: lift,
    angle: air
      ? moving
        ? (out ? 1 : -1) *
          (key === "harvester-bee" ? 5 : 4) *
          Math.sin(Math.PI * u)
        : 0
      : 0,
    action:
      play >= 0 && !air
        ? ({
            bear: "follow a drifting leaf",
            "blazer-stallion": "a light celebratory leap",
            lion: "pounce after the ball",
            thunderduck: "hop into a lightning flourish",
          }[key] ?? "play")
        : (actions[key]?.[moving ? 0 : 1] ?? "explore"),
    moving,
  };
}

/** Keep travel speed proportional to character size as its available route changes. */
export function roamingMotionAt(
  key: string,
  time: number,
  span: number,
  height: number,
  air: boolean,
) {
  const half = (periods[key] ?? 23) / 2,
    walkHalf = Math.max(1, span) / Math.max(1, height * 0.7) + 2.2,
    runHalf = Math.max(1, span) / Math.max(1, height * 1.3) + 2.2,
    elapsed = cycle((time * 23) / (periods[key] ?? 23), walkHalf + runHalf),
    returning = elapsed >= walkHalf,
    clock = returning
      ? half + ((elapsed - walkHalf) / runHalf) * half
      : (elapsed / walkHalf) * half;
  const motion = motionAt(key, clock, air);
  if (!air && returning && motion.moving)
    motion.action = "run across the open meadow";
  return motion;
}

type Crossing = {
  x: number;
  travel: number;
  phase: number;
  run: number;
  facing: number;
  play: number;
  pulse: number;
  arc: number;
  action: string;
};
const gaitStride = (key: string) =>
  key === "blazer-stallion"
    ? 0.17
    : key === "lion"
      ? 0.16
      : key === "bear"
        ? 0.18
        : 0.16;
function travelEase(u: number, arriving: boolean) {
  const r = 0.12;
  const t = arriving ? 1 - u : u;
  const p = t < r ? (t * t) / (2 * r) : t - r / 2;
  return {
    p: arriving ? 1 - p / (1 - r / 2) : p / (1 - r / 2),
    v: Math.min(1, t / r),
  };
}
/** Paired routes alternate a walk and a run. Skip only the fully concealed
 * middle; visible movement and footfalls remain tied to distance. */
export function crossingAt(
  key: string,
  time: number,
  card: Panel,
  viewport: number,
  w: number,
  h: number,
): Crossing {
  const upper = key === "bear" || key === "thunderduck",
    initialRight = key === "lion" || key === "thunderduck";
  // Partners share one route clock and approach from opposite sides. They pass
  // one another only inside the covered panel, never on top of a visible friend.
  const groupWidth = h * (upper ? 0.68 : 1.02),
    walkSpeed = h * (upper ? 0.55 : 0.75),
    runSpeed = h * (upper ? 1.05 : 1.4),
    stride = w * gaitStride(key),
    delay = upper ? 0.8 : 0,
    offset = upper ? 54 : 30;
  const left = clamp(
    card.left - groupWidth * 0.65 - offset,
    groupWidth / 2 + 5,
    viewport - groupWidth / 2 - 5,
  );
  const right = clamp(
    card.right + groupWidth * 0.65 + offset,
    groupWidth / 2 + 5,
    viewport - groupWidth / 2 - 5,
  );
  // Include the artwork's slight sway, then reappear on the opposite edge.
  // A narrow panel has no safely hidden span, so keep its crossing continuous.
  const middle = (card.left + card.right) / 2,
    insideLeft = Math.min(middle, card.left + w * 0.58),
    insideRight = Math.max(middle, card.right - w * 0.58),
    rest = 2.2,
    distance = insideLeft - left + right - insideRight,
    groupDistance =
      Math.min(middle, card.left + groupWidth * 0.58) -
      left +
      right -
      Math.max(middle, card.right - groupWidth * 0.58),
    walkDuration = groupDistance / (walkSpeed * 0.94),
    runDuration = groupDistance / (runSpeed * 0.94),
    walkHalf = walkDuration + rest;
  const elapsed = cycle(
      Math.max(0, time - delay),
      walkHalf + runDuration + rest,
    ),
    returning = elapsed >= walkHalf,
    local = returning ? elapsed - walkHalf : elapsed,
    total = returning ? runDuration : walkDuration;
  const reverse = initialRight !== returning,
    facing = reverse ? -1 : 1;
  const points = reverse
    ? [right, insideRight, insideLeft, left]
    : [left, insideLeft, insideRight, right];
  const durations = reverse
    ? [
        ((right - insideRight) / distance) * total,
        0,
        ((insideLeft - left) / distance) * total,
      ]
    : [
        ((insideLeft - left) / distance) * total,
        0,
        ((right - insideRight) / distance) * total,
      ];
  const labels: Record<string, string> = {
    bear: "walk across to greet friends",
    "blazer-stallion": "trot across the field",
    lion: "follow the ball across the field",
    thunderduck: "waddle across to the next spark",
  };
  if (time < delay)
    return {
      x: points[0],
      travel: 0,
      phase: 0,
      run: 0,
      facing,
      play: -1,
      pulse: 0,
      arc: 0,
      action: "look toward friends",
    };
  let sum = 0;
  for (let segment = 0; segment < 3; segment++) {
    const duration = durations[segment];
    if (local < sum + duration) {
      const u = clamp((local - sum) / duration),
        e = travelEase(u, segment === 2);
      return {
        x: points[segment] + (points[segment + 1] - points[segment]) * e.p,
        travel: (returning ? 1 : 0) + (segment === 0 ? e.p / 2 : (1 + e.p) / 2),
        phase: (e.p * Math.abs(points[segment + 1] - points[segment])) / stride,
        run: e.v,
        facing,
        play: -1,
        pulse: 0,
        arc: 0,
        action: returning ? "run across to join friends" : labels[key],
      };
    }
    sum += duration;
  }
  const p =
      (local - total - 0.35) /
      (key === "bear"
        ? 1.65
        : key === "thunderduck"
          ? 0.78
          : key === "blazer-stallion"
            ? 1.05
            : 0.92),
    play = p >= 0 && p <= 1 ? p : -1;
  return {
    x: points[3],
    travel: returning ? 2 : 1,
    phase: 0,
    run: 0,
    facing,
    play,
    pulse: play < 0 ? 0 : Math.sin(Math.PI * play),
    arc: play < 0 ? 0 : 4 * play * (1 - play),
    action:
      play < 0
        ? "settle and look around"
        : key === "lion"
          ? "pounce after the ball"
          : key === "bear"
            ? "follow a drifting leaf"
            : key === "thunderduck"
              ? "hop into a lightning flourish"
              : "a light celebratory leap",
  };
}

// Skip only the fully covered section of a flight. Visible easing, wing beats
// and depth scaling remain independent; no invisible travel timer is needed.
export function flightClockAt(
  key: string,
  time: number,
  card: Panel,
  viewport: number,
  w: number,
) {
  const period = periods[key],
    half = period / 2,
    start = period * 0.07,
    duration = period * 0.3;
  const span = Math.max(1, viewport * 0.93 - w),
    left = viewport * 0.035 + w / 2;
  const enter = clamp((card.left + w * 0.6 - left) / span),
    leave = clamp((card.right - w * 0.6 - left) / span);
  if (leave <= enter) return time;
  const inverse = (p: number) => 0.5 - Math.sin(Math.asin(1 - 2 * p) / 3);
  const a = start + duration * inverse(enter),
    b = start + duration * inverse(leave);
  const ra = start + duration * inverse(1 - leave),
    rb = start + duration * inverse(1 - enter);
  const saved = b - a,
    newHalf = half - saved;
  const t = cycle(time, newHalf * 2),
    returning = t >= newHalf,
    local = returning ? t - newHalf : t;
  const entry = returning ? ra : a,
    exit = returning ? rb : b;
  const mapped = local < entry ? local : local + exit - entry;
  return (returning ? half : 0) + mapped;
}

type CastAssets = { cast: Loaded[]; totalBytes: number };
const assetLoads = new Map<string, Promise<CastAssets>>();
function loadCast(base: string): Promise<CastAssets> {
  const existing = assetLoads.get(base);
  if (existing) return existing;
  const pending = (async () => {
    const response = await fetch(base + "manifest.json");
    if (!response.ok) throw Error("Mascot artwork could not load");
    const manifest = (await response.json()) as {
      characters: Character[];
      totalBytes: number;
    };
    const cast = await Promise.all(
      manifest.characters.map(async (c) => {
        const image = new Image();
        image.decoding = "async";
        image.src = base + c.src;
        await image.decode();
        return { ...c, image } satisfies Loaded;
      }),
    );
    return { cast, totalBytes: manifest.totalBytes };
  })();
  assetLoads.set(base, pending);
  void pending.catch(() => assetLoads.delete(base));
  return pending;
}

export async function startMascotScene(
  canvas: HTMLCanvasElement,
  assetBase = "/mascots/playground-v9/",
  options: { studio?: boolean } = {},
): Promise<Controller> {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw Error("Canvas is unavailable");
  const ctx = context;
  const { cast, totalBytes } = await loadCast(assetBase.replace(/\/?$/, "/"));
  const rig = createArtworkRig(),
    reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let paused = reduced.matches,
    visible = true,
    disposed = false,
    raf = 0,
    last = 0,
    time = 2,
    frame = 0,
    width = 1,
    height = 1,
    dpr = 1,
    selected: string | null = null,
    panel: Panel | undefined,
    headerTop = 0,
    header = 0,
    reaction = -100;
  let avg = 0,
    maxDraw = 0;
  const offsets: Record<string, number> = {
    bear: 1,
    "blazer-stallion": 5,
    lion: 8,
    thunderduck: 2,
    "sun-phoenix": 4,
    eagle: 11,
    "harvester-bee": 7,
  };
  const positions: Record<string, { side: number; y: number }> = {
    bear: { side: 0, y: 0.79 },
    "blazer-stallion": { side: 0, y: 0.95 },
    lion: { side: 1, y: 0.93 },
    thunderduck: { side: 1, y: 0.72 },
    "sun-phoenix": { side: 1, y: 0.38 },
    eagle: { side: 0, y: 0.26 },
    "harvester-bee": { side: 0, y: 0.56 },
  };
  const airborneOrder = ["eagle", "harvester-bee"];
  const draw = () => {
    if (width <= 0 || height <= 0) return;
    const started = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const items: RigDraw[] = [],
      actions: string[] = [],
      bounds: string[] = [];
    let duckPulse = 0;
    const card = panel ?? {
      left: width * 0.36,
      right: width * 0.64,
      top: 80,
      bottom: height * 0.85,
    };
    const bands = freeRoamingBands(width, height, card, headerTop);
    const sun = sunAt(time, width, height, headerTop);
    const groundBelow = !!bands.lawn && !selected && !options.studio;
    const normalH = characterHeight(width, height, card),
      gallery = selected === "*",
      openField = selected === "field",
      solo = selected !== null && !gallery && !openField;
    const groundBottom = Math.min(
      height - (options.studio ? 108 : 12),
      card.bottom - 15,
    );
    const groundTop = Math.min(
      groundBottom - normalH * (groundBelow ? 2 : 3.6),
      Math.max(header, height * 0.62),
    );
    for (const [index, c] of cast.entries()) {
      if (solo && c.key !== selected) continue;
      const t = time + offsets[c.key],
        place = positions[c.key];
      const area =
        !selected && !options.studio
          ? c.air
            ? bands.sky
            : c.key === "blazer-stallion" || c.key === "lion"
              ? bands.lawn
              : undefined
          : undefined;
      const bandOrder = c.air ? airborneOrder : ["blazer-stallion", "lion"];
      const slot =
        area && c.key !== "sun-phoenix"
          ? roamingSlot(
              area,
              bandOrder.indexOf(c.key),
              bandOrder.length,
              normalH,
            )
          : undefined;
      const baseH = solo
        ? Math.min(height * 0.42, 258)
        : gallery
          ? clamp((height - 330) * 0.35, 24, 170)
          : options.studio
            ? 86
            : c.key === "sun-phoenix"
              ? sun.size
              : (slot?.height ?? normalH * (c.key === "eagle" ? 1.03 : 1));
      const across = !solo && !gallery && !openField && !slot;
      const flightTop = header + 8,
        flightBottom = groundTop - 10,
        flightLaneHeight =
          Math.max(0, flightBottom - flightTop) / airborneOrder.length,
        flightY =
          flightTop + (bandOrder.indexOf(c.key) + 0.5) * flightLaneHeight,
        flightSway = Math.max(0, (flightLaneHeight - baseH * 1.3) / 2);
      const safelyCovered =
        flightY - baseH * 0.65 - flightSway - 2 > card.top &&
        flightY + baseH * 0.65 + flightSway + 2 < card.bottom;
      const clock =
        across && c.air && c.key !== "sun-phoenix" && safelyCovered
          ? flightClockAt(c.key, t, card, width, (baseH * c.width) / c.height)
          : t;
      const m = slot
        ? roamingMotionAt(
            c.key,
            t,
            slot.right - slot.left - baseH * 1.5 - 12,
            baseH,
            c.air,
          )
        : motionAt(c.key, clock, c.air);
      const depth =
        c.air && c.key !== "sun-phoenix" && !gallery
          ? 1 -
            (c.key === "eagle" ? 0.12 : 0.06) *
              Math.sin(m.travelUnit * Math.PI) ** 2
          : 1;
      const speciesScale =
        c.key === "harvester-bee" ? (solo ? 1 : gallery ? 0.7 : 0.72) : 1;
      const h = baseH * depth * speciesScale,
        w = (h * c.width) / c.height;
      let laneStart = place.side === 0 ? 7 : card.right + 7,
        laneEnd = place.side === 0 ? card.left - 7 : width - 7;
      let y = clamp(
        height * place.y,
        Math.max(header + 38, h / 2 + 10),
        height - h / 2 - 12,
      );
      if (options.studio) {
        laneStart = place.side === 0 ? width * 0.08 : width * 0.66;
        laneEnd = place.side === 0 ? width * 0.34 : width * 0.94;
        y = height * place.y;
      }
      if (openField) {
        const centers: Record<string, number> = {
          bear: 0.38,
          "blazer-stallion": 0.19,
          lion: 0.65,
          thunderduck: 0.83,
        };
        if (c.air) {
          laneStart =
            width *
            (c.key === "eagle" ? 0.06 : c.key === "sun-phoenix" ? 0.51 : 0.2);
          laneEnd =
            width *
            (c.key === "eagle" ? 0.61 : c.key === "sun-phoenix" ? 0.94 : 0.44);
        } else {
          const center = centers[c.key];
          laneStart = width * (center - 0.1);
          laneEnd = width * (center + 0.1);
        }
      }
      if (options.studio) y = Math.min(y, height - h / 2 - 108);
      if (solo) {
        laneStart = width * 0.18;
        laneEnd = width * 0.82;
        y = c.air ? height * 0.43 : height * 0.78 - h / 2;
      }
      if (gallery) {
        const col = index % 4,
          row = Math.floor(index / 4);
        laneStart = (col * width) / 4 + 12;
        laneEnd = ((col + 1) * width) / 4 - 12;
        y = 130 + ((height - 330) * (row + 0.55)) / 2;
        ctx.fillStyle = "#476557";
        ctx.font = "12px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(
          c.name,
          (laneStart + laneEnd) / 2,
          130 + ((height - 330) * (row + 0.94)) / 2,
        );
      }
      if (slot) {
        laneStart = slot.left + w * 0.25 + 6;
        laneEnd = slot.right - w * 0.25 - 6;
        y = (slot.top + slot.bottom) / 2;
      }
      if (across && c.air) {
        laneStart = width * 0.035;
        laneEnd = width * 0.965;
      }
      const availableSpan = Math.max(8, laneEnd - laneStart - w);
      const strides: Record<string, number> = {
        bear: 3,
        "blazer-stallion": 5,
        lion: 4,
        thunderduck: 4,
      };
      const strideUV = gaitStride(c.key);
      const span =
        c.air || slot
          ? availableSpan
          : Math.min(availableSpan, w * strideUV * (strides[c.key] ?? 4));
      const begin = laneStart + w / 2 + (availableSpan - span) / 2;
      let x = clamp(begin + span * m.progress, w / 2 + 3, width - w / 2 - 3);
      let phase = (m.travelUnit * span) / (w * strideUV);
      let run = smooth(m.u / 0.1) * (1 - smooth((m.u - 0.9) / 0.1));
      let crossing: Crossing | undefined;
      if (across && !c.air) {
        crossing = crossingAt(c.key, time, card, width, w, h);
        x = crossing.x;
        y = Math.min(y, card.bottom - h / 2 - 15);
        phase = crossing.phase;
        run = crossing.run;
        Object.assign(m, {
          facing: crossing.facing,
          travel: crossing.travel,
          play: crossing.play,
          pulse: crossing.pulse,
          arc: crossing.arc,
          action: crossing.action,
        });
      }
      if (slot && !c.air) {
        y = roamingY(c.key, m.travel, slot.top, slot.bottom, h);
      } else if (!c.air && !solo && !gallery) {
        const bottom = Math.min(
          height - (options.studio ? 108 : 12),
          across ? card.bottom - 15 : height,
        );
        const upper = c.key === "bear" || c.key === "thunderduck";
        const top = groundTop;
        const middle = (top + bottom) / 2;
        y = roamingY(
          c.key,
          m.travel,
          groundBelow || upper ? top : middle,
          groundBelow || !upper ? bottom : middle,
          h,
        );
      }
      const floorY = y + h / 2;
      if (c.air) {
        if (across) {
          y = flightY - (m.airY / 0.075) * flightSway;
        } else {
          y -=
            m.airY *
            (slot ? slot.bottom - slot.top : height) *
            (gallery ? 0.35 : 1);
        }
        if (c.key === "harvester-bee") y += Math.sin(t * 2.2) * 1.2;
        if (!solo && !gallery && !slot)
          y = clamp(
            y,
            Math.min(header + h / 2 + 8, height - h / 2 - 6),
            height - h / 2 - 6,
          );
      } else {
        // A planted gait has only a small vertical weight transfer.
        y -=
          Math.sin(phase * Math.PI * 4) *
          h *
          (c.key === "blazer-stallion" ? 0.005 : 0.002) *
          run;
      }
      let playAngle = 0;
      if (!c.air && m.play >= 0) {
        const lift =
          c.key === "lion"
            ? 0.12
            : c.key === "blazer-stallion"
              ? 0.13
              : c.key === "thunderduck"
                ? 0.1
                : 0.035;
        y -= m.arc * h * lift;
        x +=
          m.facing *
          m.pulse *
          w *
          (c.key === "lion" ? 0.24 : c.key === "blazer-stallion" ? 0.18 : 0.08);
        playAngle =
          m.facing *
          m.pulse *
          (c.key === "bear" ? -4 : c.key === "thunderduck" ? -3 : -4.5) *
          (1 - m.play * 1.5);
        run = Math.max(run, m.pulse * 0.4);
      }
      const acknowledge = Math.max(0, 1 - (time - reaction) / 1.2);
      const weightShift = !c.air
        ? Math.sin(phase * Math.PI * 2) *
          (c.key === "thunderduck" ? 1.4 : c.key === "bear" ? 0.65 : 0.2) *
          run
        : 0;
      const bank =
        c.air && !gallery
          ? Math.sin(m.travelUnit * Math.PI * 2) *
            m.facing *
            (c.key === "harvester-bee" ? 2 : 5)
          : 0;
      const angle =
        m.angle +
        bank +
        weightShift +
        playAngle +
        (acknowledge > 0
          ? Math.sin(((time - reaction) * Math.PI) / 1.2) * 1.2
          : 0);
      const isSun = c.key === "sun-phoenix";
      if (isSun && !solo && !gallery && !openField) {
        x = sun.x;
        y = sun.y;
        m.action = "shine above the campuses";
      }
      // Keep the complete rotated drawing inside the viewport, including play poses.
      x = clamp(x, w * 0.6 + 2, width - w * 0.6 - 2);
      y = clamp(y, h * 0.6 + 2, height - h * 0.55 - 2);
      if (!c.air) {
        ctx.fillStyle = "#42644620";
        ctx.beginPath();
        ctx.ellipse(
          x,
          floorY + 2,
          w * 0.34 * (1 - m.arc * 0.18),
          2.5,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      // Tiny scene props establish a reason for travel without covering controls.
      if (c.key === "bear") {
        const lt = cycle(t, 11) / 11,
          fall = smooth(lt),
          leafX =
            x + m.facing * w * 0.7 + Math.sin(lt * Math.PI * 3) * w * 0.23,
          leafY = y - h * 0.76 + fall * h * 1.18;
        ctx.save();
        ctx.translate(leafX, leafY);
        ctx.rotate(Math.sin(lt * Math.PI * 3) * 0.8);
        ctx.fillStyle = "#cfaa50";
        ctx.globalAlpha = smooth(lt / 0.08) * smooth((1 - lt) / 0.13);
        ctx.beginPath();
        ctx.moveTo(-4, 1);
        ctx.quadraticCurveTo(-2, -6, 5, -3);
        ctx.quadraticCurveTo(6, 3, -4, 1);
        ctx.fill();
        ctx.strokeStyle = "#9d8035";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(-5, 2);
        ctx.lineTo(4, -2);
        ctx.stroke();
        ctx.restore();
      }
      if (c.key === "lion") {
        const ballM = motionAt(c.key, t + 1.15),
          ballX =
            crossing || slot
              ? clamp(x + m.facing * (w * 0.64 + 5), 5, width - 5)
              : clamp(
                  begin + span * ballM.progress + m.facing * (w * 0.59 + 5),
                  laneStart + 5,
                  laneEnd - 5,
                ),
          ballY = floorY - 4;
        ctx.save();
        ctx.translate(ballX, ballY);
        ctx.rotate(m.travel * 6);
        ctx.fillStyle = "#edbd61";
        ctx.strokeStyle = "#b48a3f";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#e98770";
        ctx.beginPath();
        ctx.arc(0, 0, 4.1, 0, Math.PI);
        ctx.fill();
        ctx.restore();
      }
      if (c.key === "harvester-bee") {
        const flowerX = clamp(begin + span * 0.85, 8, width - 8),
          flowerY = Math.min(
            slot ? slot.bottom - 12 : height - 12,
            (solo ? height * 0.45 : gallery || slot ? y : height * place.y) +
              h * 0.65 +
              10,
          );
        ctx.strokeStyle = "#619857";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(flowerX, flowerY + 10);
        ctx.quadraticCurveTo(flowerX - 3, flowerY + 3, flowerX, flowerY);
        ctx.stroke();
        ctx.fillStyle = "#fbefe0";
        for (let j = 0; j < 5; j++) {
          ctx.beginPath();
          ctx.ellipse(
            flowerX + Math.cos(j * 1.256) * 3,
            flowerY + Math.sin(j * 1.256) * 3,
            2.4,
            2.4,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.fillStyle = "#efc851";
        ctx.beginPath();
        ctx.arc(flowerX, flowerY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      items.push({
        art: c,
        t,
        phase,
        run,
        x,
        y,
        w,
        h,
        angle: isSun ? 0 : angle,
        facing: isSun ? 1 : m.facing,
        opacity:
          isSun && !selected && !options.studio && !reduced.matches
            ? sun.opacity
            : 1,
        strength: paused && reduced.matches ? 0 : 1,
      });
      if (c.key === "thunderduck") duckPulse = m.pulse;
      actions.push(c.name + ": " + m.action);
      bounds.push(
        c.key +
          ":" +
          Math.round(x - w / 2) +
          "," +
          Math.round(y - h / 2) +
          "," +
          Math.round(w) +
          "," +
          Math.round(h),
      );
    }
    if (rig?.available())
      ctx.drawImage(rig.draw(items, width, height, dpr), 0, 0, width, height);
    else
      for (const p of items) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angle * Math.PI) / 180);
        ctx.scale(p.facing, 1);
        ctx.globalAlpha = p.opacity ?? 1;
        ctx.drawImage(p.art.image, -p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    for (const p of items)
      if (p.art.key === "thunderduck") {
        const flash = Math.max(
          duckPulse,
          Math.max(0, Math.sin((time + 2) * 1.6)) ** 12,
        );
        ctx.save();
        ctx.globalAlpha = 0.16 + 0.84 * flash;
        ctx.translate(p.x + p.facing * (p.w * 0.53 + 3), p.y - p.h * 0.13);
        ctx.scale(0.68, 0.68);
        ctx.fillStyle = "#ffdf3e";
        ctx.strokeStyle = "#b28d34";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.lineTo(1, 12);
        ctx.lineTo(6, 12);
        ctx.lineTo(3, 22);
        ctx.lineTo(14, 8);
        ctx.lineTo(8, 8);
        ctx.lineTo(12, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    const duration = performance.now() - started;
    avg = avg * 0.95 + duration * 0.05;
    maxDraw = Math.max(maxDraw, duration);
    if (frame++ % 12 === 0 || paused)
      Object.assign(canvas.dataset, {
        artwork: "approved-articulated-v9",
        activeCast: items.map((p) => p.art.key).join(","),
        actions: actions.join(" / "),
        personalities: JSON.stringify(personality),
        bounds: bounds.join(";"),
        viewport: `${width},${height}`,
        sceneTime: time.toFixed(2),
        frame: String(frame),
        drawMs: duration.toFixed(2),
        averageDrawMs: avg.toFixed(2),
        maxDrawMs: maxDraw.toFixed(2),
        assetBytes: String(totalBytes),
        rig: rig?.available() ? "local-artwork-bones" : "whole-art-fallback",
        animationState: paused
          ? "paused"
          : document.hidden
            ? "hidden"
            : visible
              ? "running"
              : "offscreen",
      });
  };
  const running = () =>
    width > 0 &&
    height > 0 &&
    !paused &&
    visible &&
    !disposed &&
    !document.hidden;
  const tick = (now: number) => {
    raf = 0;
    if (!running()) return;
    if (last) time += Math.min(100, now - last) / 1000;
    last = now;
    draw();
    raf = requestAnimationFrame(tick);
  };
  const sync = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    if (disposed) return;
    draw();
    if (running()) raf = requestAnimationFrame(tick);
  };
  const resize = () => {
    const b = canvas.getBoundingClientRect();
    width = Math.max(0, b.width);
    height = Math.max(0, b.height);
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const root = canvas.closest("main") ?? document,
      obstacle =
        (options.studio
          ? canvas.parentElement?.querySelector(".card:not([hidden])")
          : undefined) ??
        root.querySelector('[role="progressbar"]')?.closest(".rounded-3xl") ??
        root.querySelector('[aria-label="Conversation with Major"]')
          ?.parentElement;
    const r = obstacle?.getBoundingClientRect();
    panel = r
      ? {
          left: r.left - b.left,
          right: r.right - b.left,
          top: r.top - b.top,
          bottom: r.bottom - b.top,
        }
      : undefined;
    const topBar = root.querySelector(
      '[aria-label="Choose a style"]',
    )?.parentElement;
    const heading = topBar?.getBoundingClientRect();
    const brand = root
      .querySelector('img[alt="Success Coach"]')
      ?.getBoundingClientRect();
    headerTop =
      Math.min(heading?.top ?? b.top, brand?.top ?? heading?.top ?? b.top) -
      b.top;
    header = Math.max(heading?.bottom ?? b.top, brand?.bottom ?? b.top) - b.top;
    canvas.parentElement?.style.setProperty(
      "--campus-height",
      `${campusHorizonHeight(width, height, headerTop)}px`,
    );
    if (obstacle) resizeObserver.observe(obstacle);
    if (topBar) resizeObserver.observe(topBar);
    sync();
  };
  const preference = () => {
    paused = reduced.matches;
    sync();
  };
  const react = (event: Event) => {
    if (
      event.target instanceof Element &&
      event.target.closest('button,[role="option"]')
    )
      reaction = time;
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const sceneRoot = canvas.closest("main");
  if (sceneRoot) resizeObserver.observe(sceneRoot);
  const intersection = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    sync();
  });
  intersection.observe(canvas);
  document.addEventListener("visibilitychange", sync);
  document.addEventListener("click", react, { passive: true });
  reduced.addEventListener("change", preference);
  window.addEventListener("resize", resize);
  resize();
  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      rig?.dispose();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", sync);
      document.removeEventListener("click", react);
      reduced.removeEventListener("change", preference);
      window.removeEventListener("resize", resize);
    },
    pause(v) {
      paused = v;
      sync();
    },
    inspect(v) {
      selected = v;
      resize();
    },
    seek(v) {
      time = Math.max(0, v);
      sync();
    },
  };
}
