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
import {
  memo,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import MarkdownViewer from "@/components/markdown-viewer";
import { Button } from "@/components/ui/button";
import { ChatBackdrop } from "@/features/chat/backdrops";
import { studentProfile, type StudentProfile } from "@/features/chat/profile";
import { useSavedCourses } from "@/features/chat/saved-courses";
import {
  CourseResults,
  hasCourseResults,
  ScheduleResults,
  InstructorResults,
} from "@/features/chat/course-results";
import { askedLabel, followUpsFor } from "@/features/chat/follow-ups";
import { composerCopy, SEED_ID, seedMessages } from "@/features/chat/seed";
import {
  starterQuestionsFor,
  type StarterQuestion,
} from "@/features/onboarding/handoff-copy";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { SuccessCoachBot } from "@/features/onboarding/shared/success-coach-bot";
import { useHeadingFocus } from "@/features/onboarding/shared/use-heading-focus";
import type { Mode, Skin } from "@/features/onboarding/skin";
import type { InterestArea } from "@/features/onboarding/types";
import { MODES, modeFromId } from "@/features/onboarding/variants";
import { GENERIC_CHAT_ERROR, SAFE_CHAT_ERRORS } from "@/lib/chat-errors";
import { citationHref, citationLabel } from "@/lib/constants";
import { TOOL_LABELS } from "@/lib/tools/names";
import { cn } from "@/lib/utils";
import { isRecord, requestedSemesters } from "@/lib/course-details";

// The planning chat. Deliberately the SAME surface the student just used: the
// simple shell was already a chat (bot avatar, bubbles, a composer), so this is
// that layout with the composer switched on and real turns replacing scripted
// ones. Playful and Focus repaint it through their own Skin.

// Stateless config — never re-created per render.
const transport = new DefaultChatTransport({ api: "/api/chat" });

function subscribeLanguage(change: () => void) {
  window.addEventListener("languagechange", change);
  return () => window.removeEventListener("languagechange", change);
}
const browserLanguages = () =>
  navigator.languages?.join(",") || navigator.language || "en";
const serverLanguage = () => "en";

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
 *  (an unnormalised course code or a misspelled program name) visible
 *  instead of silent. One key per tool; first present wins. */
function chipArg(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const rec = input as Record<string, unknown>;
  const arg = rec.courseCode ?? rec.programName ?? rec.query;
  return arg == null ? "" : ` · ${String(arg)}`;
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
const Turn = memo(function Turn({
  m,
  skin,
  question,
}: {
  m: UIMessage;
  skin: Skin;
  question: string;
}) {
  const isUser = m.role === "user";
  // What a chip-sent turn SAYS, as opposed to the instructions it carries.
  const spoken = isUser ? askedLabel(m.metadata) : undefined;
  const courseRows =
    !isUser &&
    m.parts.some(
      (part) =>
        isToolUIPart(part) &&
        part.state === "output-available" &&
        (hasCourseResults(getToolName(part), part.output) ||
          getToolName(part) === "get_class_schedule" ||
          getToolName(part) === "get_instructor" ||
          getToolName(part) === "search_faculty_expertise" ||
          (getToolName(part) === "search_knowledge" &&
            isRecord(part.output) &&
            Array.isArray(part.output.results) &&
            part.output.results.some(
              (result) => isRecord(result) && result.doc_type === "cv",
            ))),
    );
  const parts = (
    <>
      {/* Sender attribution once per turn — position and avatar don't reach AT. */}
      <span className="sr-only">{isUser ? "You: " : "Major: "}</span>
      {m.parts.map((part, i) => {
        if (isTextUIPart(part)) {
          // Multi-step turns open with an EMPTY text part when the model goes
          // straight to a tool call ([text(""), tool, text(answer)]) — painting
          // it renders a blank styled bubble above the tool chip.
          if (!part.text) return null;
          return (
            <div
              key={i}
              data-role={isUser ? "user" : "assistant"}
              // skin.bubble still carries whitespace-pre-wrap for the wizard's
              // plain-text bubbles. Markdown does its own block layout, so
              // here the literal newlines between blocks would render as blank
              // lines. cn() (tailwind-merge) is required — a string append
              // loses to stylesheet order.
              className={cn(skin.bubble, "whitespace-normal")}
            >
              {courseRows && part.text.length > 300 ? (
                <details open>
                  <summary className={`${skin.link} cursor-pointer`}>
                    Major&apos;s explanation
                  </summary>
                  <MarkdownViewer content={part.text} className="prose mt-2" />
                </details>
              ) : (
                <MarkdownViewer
                  content={spoken ?? part.text}
                  className={isUser ? "prose-invert!" : "prose"}
                />
              )}
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
          const out =
            finished && !failed
              ? (part.output as
                  | {
                      source_url?: unknown;
                      results?: { source_url?: unknown }[];
                    }
                  | undefined)
              : undefined;
          // Accepts every Dallas College citation host — the catalog serves
          // course/program rows, Concourse serves syllabi and CVs — and
          // rejects anything else by exact host match.
          //
          // Point-reads put the URL at the top level; search_knowledge puts one
          // per hit in results[], which the top-level read alone never saw — so
          // the one tool whose job is provenance showed no link at all. Each
          // hit gets its own link rather than promoting the first, which would
          // dress a fuzzy match up as the single authoritative source.
          // Faculty sources belong to their named, expandable rows; an unlabeled
          // strip of hundreds of duplicate source links obscures the actual list.
          const srcs =
            getToolName(part) === "search_faculty_expertise"
              ? []
              : Array.from(
                  new Set(
                    [
                      citationHref(out?.source_url),
                      ...(Array.isArray(out?.results)
                        ? out.results.map((r) => citationHref(r?.source_url))
                        : []),
                    ].filter((u): u is string => !!u),
                  ),
                );
          return (
            <div
              key={i}
              className="flex w-full min-w-0 flex-wrap items-center gap-1.5 self-start"
            >
              <span className={`${skin.chip} ${finished ? "" : "opacity-80"}`}>
                <span aria-hidden className={skin.chipCheck}>
                  {failed ? "!" : finished ? "✓" : "⋯"}
                </span>
                {chipText(getToolName(part), part.state) + chipArg(part.input)}
              </span>
              {srcs.map((href) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${skin.link} text-sm`}
                >
                  {citationLabel(href)}
                </a>
              ))}
              {part.state === "output-available" && (
                <>
                  <CourseResults
                    name={getToolName(part)}
                    output={part.output}
                    skin={skin}
                    semesters={requestedSemesters(question)}
                  />
                  <ScheduleResults
                    name={getToolName(part)}
                    output={part.output}
                    skin={skin}
                    showInstructors={/\b(?:who|professors?|instructors?)\b/i.test(
                      question,
                    )}
                  />
                  <InstructorResults
                    name={getToolName(part)}
                    output={part.output}
                    skin={skin}
                  />
                </>
              )}
            </div>
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
  profile,
  interest,
}: {
  mode: Mode;
  seed: UIMessage[];
  starters: StarterQuestion[];
  profile: StudentProfile | null;
  interest: InterestArea | null;
}) {
  const { skin, copy } = mode;
  const languages = useSyncExternalStore(
    subscribeLanguage,
    browserLanguages,
    serverLanguage,
  );
  const composer = composerCopy(languages.split(","), copy.composerPlaceholder);
  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    transport,
    messages: seed,
    // useChat re-renders on every chunk; throttle the paint, not the stream.
    experimental_throttle: 50,
  });

  const [input, setInput] = useState("");
  const [askedLabels, setAskedLabels] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const headingRef = useHeadingFocus(null);
  const busy = status === "submitted" || status === "streaming";
  const taken = useSavedCourses((s) => s.taken);

  // Chips for where the conversation actually is: the opening starters, then
  // the next step the latest settled reply's tool results can answer. Computed
  // only when idle, so a half-streamed turn never flickers a wrong set.
  const lastCoachTools = busy
    ? []
    : (messages.findLast((m) => m.role === "assistant")?.parts ?? [])
        .filter(isToolUIPart)
        .filter((part) => part.state === "output-available")
        .map((part) => ({ name: getToolName(part), output: part.output }));
  const suggestions = followUpsFor({
    program: profile?.major,
    interest,
    starters,
    tools: lastCoachTools,
    started: messages.some((message) => message.role === "user"),
    taken,
    askedLabels,
  });

  // Stick to the bottom while the reader is there, stop the moment they
  // scroll up, resume when they come back. A ResizeObserver on the transcript
  // catches the growth `messages.length` misses: streamed text, markdown
  // blocks and course cards mounting inside a turn that already exists.
  useEffect(() => {
    const el = scrollRef.current;
    const transcript = transcriptRef.current;
    if (!el || !transcript) return;
    // Only the READER may break the follow. Position alone cannot tell us who
    // moved the scroll: a growing card, a removed "Thinking…" row or an
    // in-flight smooth scroll all pass through "not at the bottom" on their
    // own, and reading those as the reader leaving is what stranded the pane
    // 2,000px above a long faculty answer.
    let intentAt = -Infinity;
    const intent = () => {
      intentAt = performance.now();
    };
    const nearBottom = () =>
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    const onScroll = () => {
      if (nearBottom()) stick.current = true;
      else if (performance.now() - intentAt < 700) stick.current = false;
    };
    const follow = () => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    };
    const intents = ["wheel", "touchmove", "pointerdown", "keydown"] as const;
    for (const type of intents)
      el.addEventListener(type, intent, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(follow);
    observer.observe(transcript);
    // The pane itself too: a chip row appearing underneath shortens the
    // viewport without changing the transcript, which alone left the last
    // lines of a long answer below the fold.
    observer.observe(el);
    return () => {
      for (const type of intents) el.removeEventListener(type, intent);
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  // The one live region: derived, not pushed. Empty while streaming, the
  // completed reply once ready — so a screen reader hears the answer exactly
  // once (role="status" is implicitly polite + atomic), and a regenerated
  // identical answer re-announces because the value passes through "" first.
  const last = messages[messages.length - 1];
  const incomplete =
    status === "ready" &&
    last?.role === "assistant" &&
    last.id !== SEED_ID &&
    !plainText(last).trim();
  const announced =
    status === "ready" && last?.role === "assistant" && last.id !== SEED_ID
      ? plainText(last)
      : "";

  // The profile rides with EVERY request — sends and retries alike. Defined
  // once so a retry cannot silently drop it: the route puts it in the system
  // prompt, so it survives even if the seeded opening turn is ever trimmed
  // out of the history.
  const requestOptions = profile ? { body: { profile } } : undefined;

  // Asking — or retrying — returns the reader to the end of the conversation
  // and re-arms the follow, whatever they were reading before.
  const toBottom = () => {
    stick.current = true;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  const send = (text: string, note = text) => {
    const t = text.trim();
    if (!t || busy) return;
    useSavedCourses.getState().addQuestion(note);
    // The chip's own words ride along as metadata for the bubble to show; the
    // model still gets `text`, the full prompt. Typed questions need none.
    sendMessage(
      { text: t, ...(note === t ? {} : { metadata: { label: note } }) },
      requestOptions,
    );
    setInput("");
    toBottom();
  };

  let currentQuestion = "";
  const turns: ReactNode[] = [];
  for (const message of messages) {
    if (message.role === "user") currentQuestion = plainText(message);
    turns.push(
      <Turn
        key={message.id}
        m={message}
        skin={skin}
        question={currentQuestion}
      />,
    );
  }

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
        className="min-h-0 flex-1 overflow-y-auto px-1 py-1 focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
      >
        {/* One element whose height IS the transcript's, so a single
            ResizeObserver sees every kind of growth. */}
        <div ref={transcriptRef} className="flex flex-col gap-3">
          {turns}

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

          {(error || incomplete) && (
            <div className="flex flex-col items-start gap-2">
              {/* Show the message only when it's one of our own mapped strings —
                  equality against the shared allowlist, never reflected text. */}
              <p className={skin.helper}>
                {incomplete
                  ? "Major did not finish the explanation. You can try again; any retrieved records are shown above."
                  : error && SAFE_CHAT_ERRORS.has(error.message)
                    ? error.message
                    : GENERIC_CHAT_ERROR}
              </p>
              <Button
                variant="ghost"
                className={skin.ghostBtn}
                onClick={() => {
                regenerate(requestOptions);
                toBottom();
              }}
              >
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Follow-up questions for wherever the conversation has reached. The
          chips are EMPTIED while a reply streams, so a half-finished turn
          never changes the set under a tapping hand; the row keeps its height
          so the composer does not hop as they come and go. */}
      <div className="flex min-h-9 flex-wrap gap-1.5 px-1">
        {!busy &&
          suggestions.map((q) => (
            <button
              key={q.prompt}
              type="button"
              onClick={() => {
                setAskedLabels((asked) => [...asked, q.label]);
                send(q.prompt, q.note ?? q.label);
              }}
              className={`${skin.chip} pointer-coarse:min-h-11`}
            >
              {q.label}
            </button>
          ))}
      </div>

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
          placeholder={composer.placeholder}
          lang={composer.language}
          dir={input ? "auto" : composer.direction}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-base outline-none placeholder:opacity-55"
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
    // `persist` is absent when storage was unavailable as the module
    // loaded (a browser refusing localStorage). Optional-chain it, exactly as
    // useHydrateSession does — an unguarded call is a TypeError in a mount
    // effect, and with no error boundary it takes the whole route down.
    void useSavedCourses.persist?.rehydrate();
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
  const starters = session ? starterQuestionsFor(session.payload) : [];
  const profile = studentProfile(session);

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
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* New tab: a client navigation unmounts this screen, and the
                transcript lives in the useChat instance — printing would
                otherwise discard the conversation it is printing from. */}
            <Link
              href="/summary"
              target="_blank"
              rel="noopener"
              className="rounded-lg border border-[color:var(--ring)] px-3 py-1.5 text-sm font-semibold whitespace-nowrap focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
            >
              🖨 Print for my coach
            </Link>
            <ModeSwitcher modes={MODES} current={mode} onSwitch={switchMode} />
            <ThemeToggle />
          </div>
        </div>

        {/* Deliberately NOT keyed by mode: the transcript lives in useChat, and
            switching looks must repaint it, not reset it — the wizard's rule
            ("the answers survive because they live in the hook, not the shell"). */}
        <Conversation
          mode={mode}
          seed={seed}
          starters={starters}
          profile={profile}
          interest={session?.payload.interest_area ?? null}
        />
      </div>
    </main>
  );
}
