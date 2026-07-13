# Onboarding modes

Each file here is one **mode** — a look and interaction the student can switch to
at any time. A mode is data: a `Skin` (class strings), a `Copy` (strings), a font,
and a **wizard shell** (the component that lays out the questions). Every mode uses
the same logic (`../use-onboarding.ts`) and the same question body
(`../shared/wizard-parts.tsx`); only the shells differ.

| File | Mode | Interaction | Font |
|---|---|---|---|
| `simple.ts` | Simple | A chat — the bot asks each question; your answers sit back as bubbles | Manrope (app default) |
| `playful.ts` | Playful | A campus stroll in the official Dallas College colors — the seven campus mascots roam the scene as the view moves per question (background polish in progress) | Nunito |
| `focus.ts` | Focus | Calm — a marker climbs a mountain trail one leg per answer, flag at the summit on the last | Space Grotesk |

Shells live in `../shared/shells/`; their scene art lives in `../shared/scenes/`.
`index.ts` lists the modes in order; the first is the default selection.

**End recap.** The shell stays mounted through the finish: when `done` is set it
renders `../shared/recap-panel.tsx` in its own scene (beside the mountain summit,
in the campus note, or as a final chat bubble) rather than swapping to a new page.

The flow opens on a **welcome page** (`../shared/welcome.tsx`): the Success Coach
cover (`../shared/brand.tsx`), a bot greeting, a pick-a-look list, and Start. The
brand images use the club's own artwork when present and fall back to coded
versions otherwise — the club logo is `public/logo.png` (links to the club site)
and the cover is `public/title.png`.

The roaming mascots live in `../shared/scenes/campus-critters.tsx` — all seven
campus mascots (SVGs in `public/mascots/`): the Suns, Eagles, and Bees drift
overhead, the Thunderducks, Lions, Bears, and Blazers hop along the ground (motion
keyframes in `globals.css`). `campus-mascots.tsx` (a static badge band of the same
mascots) is kept available if the group ever wants that layout instead. After
starting, the header wordmark returns to the welcome page and the switcher changes
the look at any time, keeping the answers.

## Lock to a single UX

If the group wants just one experience, set `MODES` in `index.ts` to that one
mode. The welcome page drops the picker and the header switcher hides itself, so
every student gets that one look:

```ts
export const MODES: Mode[] = [simple]; // no picker, no switcher; only Simple
```

## Change one thing

- **Edit a look**: change the class strings / copy in that mode's file.
- **Edit an interaction**: change its shell in `../shared/shells/`.
- **Add a mode**: copy a mode file + its shell, add the mode to `MODES`. Fonts go
  in `fonts.ts` (a `next/font` call at module scope).
- **Remove a mode**: delete its file, its shell, and its entry in `index.ts`.

## Rules a mode must keep

- Each mode owns its palette: a dark colour for text and primary actions, and one
  accent for progress, the selected ring, and the finish mark. Never put white text
  on an accent fill that fails AA contrast; keep the accent off text buttons.
- The selected choice is signalled by border + ring + check, never colour alone.
- All non-essential motion uses `motion-safe:` so it drops under reduced motion.
