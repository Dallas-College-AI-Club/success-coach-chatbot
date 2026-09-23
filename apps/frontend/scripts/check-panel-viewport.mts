import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The chat panel must not be able to leave the viewport. What put it there was
// not a scroll bug but a containing-block one: `sr-only` is position:absolute,
// and the transcript scroller was position:static, so every screen-reader span
// in a turn resolved its containing block past the scroller to the panel
// column. Unscrolled and unclipped, they laid out down the page — one 6,500px
// below the fold on a full program plan — which made <main> a 9,000px scroll
// container. <main> is clipped, so it showed no scrollbar and no wheel brought
// it back: one scroll-into-view stranded the header off the top of the screen
// for the rest of the conversation, and only a reload (which wipes the chat)
// restored it. These assertions guard both halves of the fix against a future
// edit to the class lists, which is all that holds it.
const source = readFileSync(
  resolve(import.meta.dirname, "../features/chat/chat-screen.tsx"),
  "utf8",
);

/** The className string literals the file ships, template parts included. */
function classLists(): string[] {
  return [...source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map(
    (m) => m[1] ?? m[2],
  );
}

test("the chat route clips <main> instead of hiding its overflow", () => {
  const main = classLists().find((c) => c.includes("${mode.skin.page}"));
  assert.ok(main, "chat-screen.tsx no longer has the <main> class list");
  // overflow:clip is not a scroll container at all, so there is no scrollport
  // for scrollIntoView, a screen reader or a virtual keyboard to move. hidden
  // clips the same pixels but stays programmatically scrollable — that is the
  // difference between "clipped" and "cannot be scrolled away".
  assert.match(main, /\boverflow-clip\b/);
  assert.doesNotMatch(
    main,
    /\boverflow-hidden\b/,
    "overflow-hidden leaves <main> scrollable; the panel can be dragged off-screen again",
  );
});

test("every scroll container in the chat is its own containing block", () => {
  const scrollers = classLists().filter((c) =>
    /\boverflow-(?:y-)?(?:auto|scroll)\b/.test(c),
  );
  assert.ok(scrollers.length, "the transcript scroller is gone");
  for (const list of scrollers)
    assert.match(
      list,
      /\b(?:relative|absolute|fixed|sticky)\b/,
      `a static scroll container lets its sr-only spans escape and grow <main>: ${list}`,
    );
});

test("the panel stays height-capped below the viewport", () => {
  const panel = classLists().find((c) => c.includes("${skin.surface}"));
  assert.ok(panel, "chat-screen.tsx no longer has the panel class list");
  // Both the base and the md step subtract chrome from 100dvh and cap at 900px,
  // so the panel is never taller than the window it sits in.
  const caps = [...panel.matchAll(/h-\[min\(900px,calc\(100dvh_-_[\d.]+rem\)\)\]/g)];
  assert.equal(caps.length, 2, `panel height cap changed shape: ${panel}`);
});
