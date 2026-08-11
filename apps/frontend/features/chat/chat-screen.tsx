"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";
import Link from "next/link";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";

import MarkdownViewer from "@/components/markdown-viewer";
import { Button } from "@/components/ui/button";
import { GENERIC_CHAT_ERROR, SAFE_CHAT_ERRORS } from "@/lib/chat-errors";
import { ChatBackdrop } from "@/features/chat/backdrops";
import { SEED_ID, seedMessages } from "@/features/chat/seed";
import { starterPromptsFor } from "@/features/onboarding/handoff-copy";
import {
  useHydrateSession,
  useSavedSession,
  useStudentSession,
} from "@/features/onboarding/onboarding-store";
import {
  AiClubLogo,
  SuccessCoachWordmark,
} from "@/features/onboarding/shared/brand";
import { ModeSwitcher } from "@/features/onboarding/shared/mode-switcher";
import { SuccessCoachBot } from "@/features/onboarding/shared/success-coach-bot";
import { useHeadingFocus } from "@/features/onboarding/shared/use-heading-focus";
import type { Mode, Skin } from "@/features/onboarding/skin";
import { MODES, modeFromId } from "@/features/onboarding/variants";
import { TOOL_LABELS } from "@/lib/tools/names";
import { useSavedCourses, type SavedCourse } from "@/features/chat/saved-courses";

// A get_course_info result the student can keep for their printable sheet.
// Reads the fields straight off the tool output — real catalog data, never
// model prose. Returns null for any other tool or an empty/not-found result.
function toSavedCourse(name: string, output: unknown): SavedCourse | null {
  if (name !== "get_course_info" || !output || typeof output !== "object") {
    return null;
  }
  const o = output as Record<string, unknown>;
  if (o.found !== true || typeof o.course_code !== "string") return null;
  return {
    course_code: o.course_code,
    title: typeof o.title === "string" ? o.title : null,
    credit_hours: typeof o.credit_hours === "number" ? o.credit_hours : null,
    requisites_raw:
      typeof o.requisites_raw === "string" ? o.requisites_raw : null,
    catalog_year: typeof o.catalog_year === "string" ? o.catalog_year : null,
    source_url: typeof o.source_url === "string" ? o.source_url : undefined,
  };
}

function SaveCourseButton({ course, cls }: { course: SavedCourse; cls: string }) {
  const saved = useSavedCourses((s) =>
    s.courses.some((c) => c.course_code === course.course_code),
  );
  const toggle = useSavedCourses((s) => s.toggle);
  return (
    <button type="button" className={cls} onClick={() => toggle(course)}>
      {saved ? "✓ Saved to my list" : "+ Save to my list"}
    </button>
  );
}

// The planning chat. Deliberately the SAME surface the student just used: the
// simple shell was already a chat (bot avatar, bubbles, a composer), so this is
// that layout with the composer switched on and real turns replacing scripted
// ones. Playful and Focus repaint it through their own Skin.

// Stateless config — never re-created per render.
const transport = new DefaultChatTransport({ api: "/api/chat" });

let reduceMotionQuery: MediaQueryList | null = null;
function prefersReducedMotion(): boolean {
  reduceMotionQuery ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return reduceMotionQuery.matches;
}

function chipText(name: string, state: string): string {
  const label = TOOL_LABELS[name];
  if (!label)
    return state === "output-error"
      ? `Couldn't run ${name}`
      : `Checking ${name}`;
  if (state === "output-error") return label.failed;
  return state === "output-available" ? label.done : label.running;
}

/** The argument worth showing beside a chip — what makes a wrong lookup
 *  (an unnormalised course code, say) visible instead of silent. */
function chipArg(input: unknown): string {
  if (input && typeof input === "object" && "courseCode" in input) {
    return ` · ${String((input as { courseCode: unknown }).courseCode)}`;
  }
  return "";
}

function plainText(m: UIMessage): string {
  return m.parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join("");
}

const CoachRow = ({ children }: { children: ReactNode }) => (
  <div className="flex items-start gap-2">
    <SuccessCoachBot className="mt-0.5 size-7 shrink-0" />
    <div className="flex min-w-0 flex-col gap-1.5">{children}</div>
  </div>
);

// Memoised: useChat rebuilds the messages array on every streamed chunk but
// keeps the identity of every message except the one being streamed, and skin
// comes off the module-level MODES — so memo prunes the transcript re-render
// to exactly the turn that changed.
const Turn = memo(function Turn({ m, skin }: { m: UIMessage; skin: Skin }) {
  const isUser = m.role === "user";
  const parts = (
    <>
      {/* Sender attribution once per turn — position and avatar don't reach AT. */}
      <span className="sr-only">{isUser ? "You: " : "Major: "}</span>
      {m.parts.map((part, i) => {
        if (isTextUIPart(part)) {
          return (
            <div
              key={i}
              data-role={isUser ? "user" : "assistant"}
              className={skin.bubble}
            >
              <MarkdownViewer
                content={part.text}
                className={isUser ? "prose-invert!" : "prose"}
              />
            </div>
          );
        }
        if (isToolUIPart(part)) {
          const failed = part.state === "output-error";
          const finished = failed || part.state === "output-available";
          // Citation rendered FROM the tool output, never from generated
          // prose: a small model regenerates URLs token-by-token and splices
          // them (observed live: "martid=" in a cited catalog URL). Taking
          // the link straight off the result makes garbling impossible.
          const out = finished && !failed ? (part.output as { source_url?: unknown } | undefined) : undefined;
          const src =
            typeof out?.source_url === "string" &&
            out.source_url.startsWith("https://catalog.dallascollege.edu")
              ? out.source_url
              : null;
          // A saveable course? Then offer to keep it for the printable sheet.
          const savedCourse =
            finished && !failed
              ? toSavedCourse(getToolName(part), part.output)
              : null;
          return (
            <span key={i} className="flex flex-wrap items-center gap-1.5 self-start">
              <span className={`${skin.chip} ${finished ? "" : "opacity-80"}`}>
                <span aria-hidden className={skin.chipCheck}>
                  {failed ? "!" : finished ? "✓" : "⋯"}
                </span>
                {chipText(getToolName(part), part.state) + chipArg(part.input)}
              </span>
              {src && (
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${skin.link} text-sm`}
                >
                  Catalog page ↗
                </a>
              )}
              {savedCourse && (
                <SaveCourseButton
                  course={savedCourse}
                  cls={`${skin.chip} cursor-pointer`}
                />
              )}
            </span>
          );
        }
        return null;
      })}
    </>
  );

  return isUser ? (
    <div className="flex items-start justify-end gap-2">
      <div className="flex min-w-0 flex-col items-end gap-1.5">{parts}</div>
    </div>
  ) : (
    <CoachRow>{parts}</CoachRow>
  );
});

function Conversation({
  mode,
  seed,
  starters,
}: {
  mode: Mode;
  seed: UIMessage[];
  starters: string[];
}) {
  const { skin, copy } = mode;
  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    transport,
    messages: seed,
    // useChat re-renders on every chunk; throttle the paint, not the stream.
    experimental_throttle: 50,
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const headingRef = useHeadingFocus(null);
  const busy = status === "submitted" || status === "streaming";

  // A new turn (or the thinking row) appearing scrolls to the bottom once.
  useEffect(() => {
    const el = scrollRef.current;
    el?.scrollTo({
      top: el.scrollHeight,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [messages.length, busy]);

  // Streaming growth pins the bottom — but only when the reader is already
  // there, so scrolling up to re-read is never fought. `auto`, not `smooth`:
  // re-targeting an in-flight smooth scroll ~20×/s means it never settles.
  useEffect(() => {
    if (status !== "streaming") return;
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      el.scrollTo({ top: el.scrollHeight });
    }
  }, [messages, status]);

  // The one live region: derived, not pushed. Empty while streaming, the
  // completed reply once ready — so a screen reader hears the answer exactly
  // once (role="status" is implicitly polite + atomic), and a regenerated
  // identical answer re-announces because the value passes through "" first.
  const last = messages[messages.length - 1];
  const announced =
    status === "ready" && last?.role === "assistant" && last.id !== SEED_ID
      ? plainText(last)
      : "";

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    // Copy the student's own question for their printable sheet — verbatim,
    // deduped in the store. getState avoids subscribing this component.
    useSavedCourses.getState().addQuestion(t);
    setInput("");
  };

  return (
    <div
      className={`${skin.surface} flex h-[min(720px,calc(100dvh_-_9.5rem))] w-full min-w-0 flex-col gap-3 p-3 sm:p-4`}
    >
      <h1 ref={headingRef} tabIndex={-1} className="sr-only outline-none">
        Planning chat with Major
      </h1>

      <div
        ref={scrollRef}
        tabIndex={0}
        aria-label="Conversation with Major"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-1 focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
      >
        {messages.map((m) => (
          <Turn key={m.id} m={m} skin={skin} />
        ))}

        {status === "submitted" && (
          <CoachRow>
            {/* Reserves the box the reply will occupy, so nothing jumps. */}
            <div data-role="assistant" className={`${skin.bubble} min-w-24`}>
              <span className="sr-only">Major is thinking</span>
              <span
                aria-hidden
                className="opacity-60 motion-safe:animate-pulse"
              >
                Thinking…
              </span>
            </div>
          </CoachRow>
        )}

        {error && (
          <div className="flex flex-col items-start gap-2">
            {/* Show the message only when it's one of our own mapped strings —
                equality against the shared allowlist, never reflected text. */}
            <p className={skin.helper}>
              {SAFE_CHAT_ERRORS.has(error.message) ? error.message : GENERIC_CHAT_ERROR}
            </p>
            <Button
              variant="ghost"
              className={skin.ghostBtn}
              onClick={() => regenerate()}
            >
              Try again
            </Button>
          </div>
        )}
      </div>

      {/* Starter questions, tailored to the student's goal; they vanish once
          the conversation is under way. */}
      {starters.length > 0 && messages.length <= seed.length && !busy && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {starters.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className={`${skin.chip} pointer-coarse:min-h-11`}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className={`${skin.picker} flex items-center gap-2 py-1.5 pr-1.5 pl-3`}
      >
        <label className="sr-only" htmlFor="chat-composer">
          Ask Major a question
        </label>
        <input
          id="chat-composer"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={copy.composerPlaceholder}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:opacity-55"
        />
        {busy ? (
          <Button
            type="button"
            variant="ghost"
            className={skin.ghostBtn}
            onClick={() => stop()}
          >
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            className={skin.primaryBtn}
            disabled={!input.trim()}
          >
            Send
          </Button>
        )}
      </form>

      <p role="status" className="sr-only">
        {announced}
      </p>
    </div>
  );
}

export function ChatScreen() {
  // Above every consumer, exactly as OnboardingFlow does it.
  useHydrateSession();
  // The saved-courses store skips auto-hydration; rehydrate it before the first
  // write (send() below captures the student's question), or that write would
  // persist over — and wipe — a returning student's saved courses.
  useEffect(() => {
    void useSavedCourses.persist.rehydrate();
  }, []);
  const hydrated = useStudentSession((s) => s.hasHydrated);
  const setModeId = useStudentSession((s) => s.setModeId);
  const session = useSavedSession();

  // The saved look is derived from the store; `pickedId` only covers a switch
  // before any session exists (a cold visit that never onboarded).
  const [pickedId, setPickedId] = useState<string | null>(null);
  const mode = hydrated ? modeFromId(pickedId ?? session?.modeId) : null;

  // Arriving via <Link> from onboarding, the store is already hydrated in
  // memory, so this renders themed on the first committed frame. Only a cold
  // load of /chat shows the placeholder, and only for one frame.
  if (!mode) return <main className={MODES[0].skin.page} />;

  const switchMode = (m: Mode) => {
    setPickedId(m.id);
    // Keep the look the student picks here, so a return visit resumes into it.
    setModeId(m.id);
  };

  const seed = seedMessages(session);
  const starters = session ? starterPromptsFor(session.payload) : [];

  return (
    <main
      className={`relative overflow-hidden ${mode.fontClass} ${mode.skin.page}`}
    >
      {/* The mode's scene continues behind the chat. */}
      <ChatBackdrop modeId={mode.id} />
      {/* The chat owns its geometry (one width in every mode — skin.shell's
          per-mode widths exist for wizard scenes the chat doesn't render), so
          switching looks repaints the panel without resizing it. */}
      {/* z-10 so the roaming mascots (which carry their own z) pass behind the
          panel — visible in the gutters, softened under the blurred surface. */}
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-stretch gap-3">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AiClubLogo />
            <Link
              href="/"
              aria-label="Success Coach — back to the start"
              className="rounded focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] motion-safe:transition-transform motion-safe:hover:scale-[1.03]"
            >
              <SuccessCoachWordmark height={46} />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/summary"
              className="rounded-lg border border-[color:var(--ring)] px-3 py-1.5 text-sm font-semibold whitespace-nowrap focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
            >
              🖨 Print for my coach
            </Link>
            <ModeSwitcher modes={MODES} current={mode} onSwitch={switchMode} />
          </div>
        </div>

        {/* Deliberately NOT keyed by mode: the transcript lives in useChat, and
            switching looks must repaint it, not reset it — the wizard's rule
            ("the answers survive because they live in the hook, not the shell"). */}
        <Conversation mode={mode} seed={seed} starters={starters} />
      </div>
    </main>
  );
}
