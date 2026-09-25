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
import { useRouter } from "next/navigation";
import { AlertDialog } from "radix-ui";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
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
import { PlanningControls } from "@/features/chat/planning-controls";
import {
  clearConversation,
  hydrateConversation,
  saveConversation,
  useConversation,
} from "@/features/chat/conversation-store";
import {
  CourseResults,
  ScheduleResults,
  InstructorResults,
  type CourseScheduleAction,
} from "@/features/chat/course-results";
import {
  askedLabel,
  courseScheduleQuestion,
  followUpsFor,
} from "@/features/chat/follow-ups";
import { composerCopy, SEED_ID, seedMessages } from "@/features/chat/seed";
import { cardOnlyReply } from "@/features/chat/reply-presentation";
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
  displayQuestion,
  scheduleAction,
  onEditHistory,
}: {
  m: UIMessage;
  skin: Skin;
  question: string;
  displayQuestion: string;
  scheduleAction: CourseScheduleAction;
  onEditHistory: () => void;
}) {
  const isUser = m.role === "user";
  // What a chip-sent turn SAYS, as opposed to the instructions it carries.
  const spoken = isUser ? askedLabel(m.metadata) : undefined;
  const cardsOnly = cardOnlyReply(m, displayQuestion);
  const parts = (
    <>
      {/* Sender attribution once per turn — position and avatar don't reach AT. */}
      <span className="sr-only">{isUser ? "You: " : "Major: "}</span>
      {m.parts.map((part, i) => {
        if (isTextUIPart(part)) {
          // Multi-step turns open with an EMPTY text part when the model goes
          // straight to a tool call ([text(""), tool, text(answer)]) — painting
          // it renders a blank styled bubble above the tool chip.
          if (!part.text || cardsOnly) return null;
          return (
            <div
              key={i}
              data-role={isUser ? "user" : "assistant"}
              // skin.bubble still carries whitespace-pre-wrap for the wizard's
              // plain-text bubbles. Markdown does its own block layout, so
              // here the literal newlines between blocks would render as blank
              // lines. cn() (tailwind-merge) is required — a string append
              // loses to stylesheet order.
              // self-start: a coach turn carrying a course card sits in a
              // column as wide as the card, so a stretched bubble painted
              // ~260px of empty panel beside its own capped prose. Shrink to
              // fit instead; max-w-[85%] still bounds it. The student's side
              // already shrinks, via the row's items-end.
              className={cn(
                skin.bubble,
                "whitespace-normal",
                !isUser && "self-start",
              )}
            >
              <MarkdownViewer
                content={spoken ?? part.text}
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
                    scheduleAction={scheduleAction}
                    onEditHistory={onEditHistory}
                  />
                  <ScheduleResults
                    name={getToolName(part)}
                    output={part.output}
                    skin={skin}
                    showInstructors={/\b(?:who|professors?|instructors?)\b/i.test(
                      displayQuestion,
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
  sessionKey,
  onClear,
}: {
  mode: Mode;
  seed: UIMessage[];
  starters: StarterQuestion[];
  profile: StudentProfile | null;
  interest: InterestArea | null;
  sessionKey: string;
  onClear: () => void;
}) {
  const { skin, copy } = mode;
  const router = useRouter();
  const languages = useSyncExternalStore(
    subscribeLanguage,
    browserLanguages,
    serverLanguage,
  );
  const composer = composerCopy(languages.split(","), copy.composerPlaceholder);
  const [restored] = useState(() => useConversation.getState().draft);
  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    transport,
    messages: restored?.messages.length ? restored.messages : seed,
    // useChat re-renders on every chunk; throttle the paint, not the stream.
    experimental_throttle: 50,
  });

  const [input, setInput] = useState(restored?.input ?? "");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const openHistory = useCallback(() => setHistoryOpen(true), []);
  const suggestionsId = useId();
  const [askedLabels, setAskedLabels] = useState<string[]>(
    restored?.askedLabels ?? [],
  );
  const [cancelled, setCancelled] = useState(restored?.interrupted ?? false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const headingRef = useHeadingFocus(null);
  const busy = status === "submitted" || status === "streaming";
  const sending = useRef(false);
  const resetting = useRef(false);
  const scheduleRequested = useRef<string | null>(null);
  useEffect(() => {
    if (busy) return;
    sending.current = false;
    const code = scheduleRequested.current;
    if (!code) return;
    scheduleRequested.current = null;
    const reply = messages.at(-1);
    if (
      !reply?.parts.some(
        (part) =>
          isToolUIPart(part) &&
          part.state === "output-available" &&
          getToolName(part) === "get_class_schedule" &&
          isRecord(part.output) &&
          part.output.course_code === code,
      )
    )
      return;
    const sections = transcriptRef.current?.querySelectorAll<HTMLElement>(
      'section[aria-label="Published class sections"]',
    );
    const result = Array.from(sections ?? []).findLast(
      (section) => section.dataset.courseCode === code,
    );
    const pane = scrollRef.current;
    if (!result || !pane) return;
    // Start at the section heading, rather than the end of a long schedule.
    stick.current = false;
    pane.scrollTop +=
      result.getBoundingClientRect().top - pane.getBoundingClientRect().top;
    result.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }, [busy, messages]);
  const taken = useSavedCourses((s) => s.taken);
  const completionOverrides = useSavedCourses((s) => s.completionOverrides);
  useEffect(() => {
    if (resetting.current) return;
    saveConversation({
      key: sessionKey,
      messages,
      input,
      askedLabels,
      interrupted: busy || cancelled || !!error,
    });
  }, [sessionKey, messages, input, askedLabels, busy, cancelled, error]);

  // Chips for where the conversation actually is: the opening starters, then
  // the next step the latest settled reply's tool results can answer. Computed
  // only when idle, so a half-streamed turn never flickers a wrong set.
  const lastCoachTools = busy
    ? []
    : (messages.findLast((m) => m.role === "assistant")?.parts ?? [])
        .filter(isToolUIPart)
        .filter((part) => part.state === "output-available")
        .map((part) => ({ name: getToolName(part), output: part.output }));
  // A restored answer predates any checkbox edits made after that answer.
  // Apply history only from newly completed replies, never on navigation back.
  const appliedHistory = useRef<string | null>(
    restored?.messages.findLast((message) => message.role === "assistant")
      ?.id ?? null,
  );
  useEffect(() => {
    if (busy || resetting.current) return;
    const reply = messages.findLast((m) => m.role === "assistant");
    if (!reply || reply.id === appliedHistory.current) return;
    appliedHistory.current = reply.id;
    for (const part of reply.parts) {
      if (
        isToolUIPart(part) &&
        part.state === "output-available" &&
        isRecord(part.output) &&
        isRecord(part.output.planning)
      ) {
        useSavedCourses
          .getState()
          .applyCompletionHistory(part.output.planning.history);
      }
    }
  }, [messages, busy]);
  const latestPlan = messages
    .flatMap((message) => message.parts)
    .filter(isToolUIPart)
    .findLast(
      (part) =>
        getToolName(part) === "get_program_requirements" &&
        part.state === "output-available",
    )?.output;
  const latestHistory =
    isRecord(latestPlan) && isRecord(latestPlan.planning)
      ? latestPlan.planning.history
      : undefined;
  const historyProgram =
    isRecord(latestPlan) && typeof latestPlan.name === "string"
      ? latestPlan.name
      : profile?.major;
  const suggestions = followUpsFor({
    program: profile?.major,
    interest,
    // The schedule answer onboarding already has, so a follow-up asks about
    // the time the student can actually study.
    goal: profile?.goal,
    preference: profile?.dayparts ?? profile?.modality,
    starters,
    tools: lastCoachTools,
    started: messages.some((message) => message.role === "user"),
    taken,
    completionOverrides,
    latestPlan,
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
  const lastQuestion = messages.findLast((message) => message.role === "user");
  const lastCards =
    last &&
    cardOnlyReply(
      last,
      lastQuestion
        ? (askedLabel(lastQuestion.metadata) ?? plainText(lastQuestion))
        : "",
    );
  const incomplete =
    status === "ready" &&
    last?.role === "assistant" &&
    last.id !== SEED_ID &&
    !lastCards &&
    !plainText(last).trim();
  const announced =
    status === "ready" && last?.role === "assistant" && last.id !== SEED_ID
      ? lastCards
        ? lastCards === "schedule"
          ? "Class sections are ready. Review the schedule cards in the conversation."
          : "Your course checklist is ready. Review the course cards in the conversation."
        : plainText(last)
      : "";

  // The profile rides with EVERY request — sends and retries alike. Defined
  // once so a retry cannot silently drop it: the route puts it in the system
  // prompt, so it survives even if the seeded opening turn is ever trimmed
  // out of the history.
  const requestOptions = {
    body: { profile: profile ?? undefined, completionOverrides },
  };

  // Asking — or retrying — returns the reader to the end of the conversation
  // and re-arms the follow, whatever they were reading before.
  const toBottom = useCallback(() => {
    stick.current = true;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);

  const send = useCallback(
    (text: string, note = text, clearInput = true) => {
      const t = text.trim();
      if (!t || busy || sending.current) return;
      sending.current = true;
      setSuggestionsOpen(false);
      setCancelled(false);
      // Read at the action boundary so an editor's newest change rides on the
      // request even when the student immediately asks for a refreshed plan.
      const completionOverrides =
        useSavedCourses.getState().completionOverrides;
      useSavedCourses.getState().addQuestion(note);
      // The chip's own words ride along as metadata for the bubble to show; the
      // model still gets `text`, the full prompt. Typed questions need none.
      sendMessage(
        {
          text: t,
          metadata: {
            ...(note === t ? {} : { label: note }),
            completionOverrides,
          },
        },
        { body: { profile: profile ?? undefined, completionOverrides } },
      );
      if (clearInput) setInput("");
      toBottom();
    },
    [busy, profile, sendMessage, toBottom],
  );

  const scheduleAction = useMemo<CourseScheduleAction>(
    () => ({
      busy,
      onViewSchedule: (code) => {
        if (busy || sending.current) return;
        const question = courseScheduleQuestion(code);
        scheduleRequested.current = code;
        setAskedLabels((asked) => [...asked, question.label]);
        send(question.prompt, question.note ?? question.label, false);
      },
    }),
    [busy, send],
  );

  let currentQuestion = "";
  let currentDisplayQuestion = "";
  const turns: ReactNode[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      currentQuestion = plainText(message);
      // Prompt instructions can mention instructors without the student asking
      // for a roster. Keep schedule previews focused on the sections.
      currentDisplayQuestion = askedLabel(message.metadata) ?? currentQuestion;
    }
    turns.push(
      <Turn
        key={message.id}
        m={message}
        skin={skin}
        question={currentQuestion}
        displayQuestion={currentDisplayQuestion}
        scheduleAction={scheduleAction}
        onEditHistory={openHistory}
      />,
    );
  }

  return (
    <div
      // Flex uses the header's actual height rather than a fixed subtraction.
      className={`${skin.surface} coach-chat-panel flex w-full min-w-0 flex-col gap-3 p-3 sm:p-4`}
    >
      <h1 ref={headingRef} tabIndex={-1} className="sr-only outline-none">
        Planning chat with Major
      </h1>

      <div
        ref={scrollRef}
        tabIndex={0}
        aria-label="Conversation with Major"
        // coach-transcript is the hook for the prose measure cap in
        // globals.css — the panel widens on a big screen, running text does not.
        // `relative` is load-bearing: `sr-only` is position:absolute, so without
        // it every screen-reader span in a turn resolves its containing block to
        // the panel wrapper instead — laid out down the page, unscrolled and
        // unclipped by this box. A long plan put one 6,500px down and made <main>
        // a silently scrollable box that any scroll-into-view dragged the whole
        // panel off the top of the screen.
        className="coach-transcript relative min-h-0 flex-1 overflow-y-auto px-1 py-1 focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
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

          {(error || incomplete || cancelled) && (
            <div className="flex flex-col items-start gap-2">
              {/* Show the message only when it's one of our own mapped strings —
                  equality against the shared allowlist, never reflected text. */}
              <p className={skin.helper}>
                {cancelled
                  ? "Response stopped. You can try again or ask another question."
                  : incomplete
                    ? "Major did not finish the explanation. You can try again; any retrieved records are shown above."
                    : error && SAFE_CHAT_ERRORS.has(error.message)
                      ? error.message
                      : GENERIC_CHAT_ERROR}
              </p>
              <Button
                variant="ghost"
                className={skin.ghostBtn}
                onClick={() => {
                  setCancelled(false);
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

      {/* Keep the conversation roomy until the student asks for suggestions.
          Sending closes the drawer; streamed replies never reopen it. */}
      <div className="coach-suggestions grid min-w-0 shrink-0 grid-cols-[1fr_auto_auto] items-center">
        <button
          type="button"
          aria-expanded={suggestionsOpen}
          aria-controls={suggestionsId}
          aria-label={suggestionsOpen ? "Hide suggestions" : "Show suggestions"}
          disabled={busy || suggestions.length === 0}
          onClick={() => setSuggestionsOpen((open) => !open)}
          className={`${skin.link} flex min-h-11 shrink-0 cursor-pointer items-center gap-2 justify-self-start rounded-lg px-2 text-sm focus-visible:outline-2 disabled:cursor-default disabled:opacity-50`}
        >
          <span aria-hidden>{suggestionsOpen ? "▾" : "▸"}</span>
          <span className="hidden min-[400px]:inline">
            {suggestionsOpen ? "Hide suggestions" : "Show suggestions"}
          </span>
          <span className="min-[400px]:hidden">Suggestions</span>
        </button>
        <AlertDialog.Root>
          <AlertDialog.Trigger asChild>
            <button
              type="button"
              className={`${skin.link} coach-clear-chat min-h-11 shrink-0 cursor-pointer rounded-lg px-2 text-sm focus-visible:outline-2`}
            >
              Clear chat
            </button>
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
            <AlertDialog.Content className="bg-popover text-popover-foreground fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 shadow-xl">
              <AlertDialog.Title className="text-lg font-semibold">
                Clear this chat?
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm leading-relaxed">
                This removes this tab’s messages and unfinished question. Your
                saved classes, notes and program choices stay. This cannot be
                undone.
              </AlertDialog.Description>
              <div className="mt-4 flex justify-end gap-2">
                <AlertDialog.Cancel asChild>
                  <Button variant="outline" className="min-h-11">
                    Cancel
                  </Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button
                    className="min-h-11"
                    onClick={() => {
                      // Abort before remounting; late chunks belong to the old
                      // hook and must never overwrite the fresh saved draft.
                      resetting.current = true;
                      void stop();
                      onClear();
                    }}
                  >
                    Clear chat
                  </Button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
        <PlanningControls
          history={latestHistory}
          historyOpen={historyOpen}
          onHistoryOpenChange={setHistoryOpen}
          busy={busy}
          onRefresh={
            historyProgram
              ? () =>
                  send(
                    `Refresh the full ${historyProgram} checklist using my current reported course history.`,
                    "Update my remaining courses",
                    false,
                  )
              : undefined
          }
          onRestart={(clearSaved) => {
            resetting.current = true;
            void stop();
            clearConversation();
            if (clearSaved) useSavedCourses.getState().clear();
            useStudentSession.getState().resetSession();
            router.push("/");
          }}
        />
        <div
          id={suggestionsId}
          className={
            suggestionsOpen
              ? "coach-followups col-span-3 flex flex-wrap gap-1.5 px-1"
              : "hidden"
          }
        >
          {!busy &&
            suggestions.map((q) => (
              <button
                key={q.prompt}
                type="button"
                onClick={() => {
                  setAskedLabels((asked) => [...asked, q.label]);
                  send(q.prompt, q.note ?? q.label);
                  scrollRef.current?.focus({ preventScroll: true });
                }}
                className={`${skin.chip} min-h-11`}
              >
                {q.label}
              </button>
            ))}
        </div>
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
          maxLength={8000}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-base outline-none placeholder:opacity-55"
        />
        {busy ? (
          <Button
            key="stop"
            type="button"
            variant="ghost"
            className={skin.ghostBtn}
            onClick={() => {
              setCancelled(true);
              stop();
            }}
          >
            Stop
          </Button>
        ) : (
          <Button
            key="send"
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
  const sessionKey = session?.payload.completedAt ?? "without-onboarding";
  const readyFor = useConversation((s) => s.readyFor);
  const [restartCount, setRestartCount] = useState(0);
  const pageRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (hydrated) void hydrateConversation(sessionKey);
  }, [hydrated, sessionKey]);
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const visible = window.visualViewport;
    const resize = () => {
      const height = visible?.height ?? window.innerHeight;
      page.style.setProperty("--chat-height", `${height}px`);
      page.dataset.compact = String(height < 600);
    };
    resize();
    visible?.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    return () => {
      visible?.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize);
    };
  }, [readyFor]);

  // The saved look is derived from the store; `pickedId` only covers a switch
  // before any session exists (a cold visit that never onboarded).
  const [pickedId, setPickedId] = useState<string | null>(null);
  const mode = hydrated ? modeFromId(pickedId ?? session?.modeId) : null;

  // Arriving via <Link> from onboarding, the store is already hydrated in
  // memory, so this renders themed on the first committed frame. Only a cold
  // load of /chat shows the placeholder, and only for one frame.
  if (!mode || readyFor !== sessionKey)
    return <main className={MODES[0].skin.page} />;

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
      ref={pageRef}
      // overflow-CLIP, not hidden: clip is not a scroll container, so this box
      // has no scrollport to move and the chat cannot leave the viewport even
      // if something inside overflows again. `hidden` clips identically but
      // stays programmatically scrollable — with no scrollbar and no wheel to
      // bring it back, which is how the panel used to strand itself off-screen.
      className={`coach-chat-page relative overflow-clip ${mode.fontClass} ${mode.skin.page}`}
    >
      {/* The mode's scene continues behind the chat. */}
      <ChatBackdrop modeId={mode.id} />
      {/* The chat owns its geometry (one width in every mode — skin.shell's
          per-mode widths exist for wizard scenes the chat doesn't render), so
          switching looks repaints the panel without resizing it. */}
      {/* Phone and tablet keep the 42rem column; the panel only grows where
          there is field to spare. Each step leaves at least 128px of gutter a
          side at its own breakpoint's narrowest viewport — the cap
          characterHeight() sizes the roaming cast to, so widening never
          shrinks a mascot. check-mascot-motion.mts asserts it against this
          very class list. */}
      {/* z-10 so the roaming mascots (which carry their own z) pass behind the
          panel — visible in the gutters, softened under the blurred surface. */}
      <div className="coach-chat-shell relative z-10 mx-auto flex w-full max-w-2xl flex-col items-stretch gap-3 lg:max-w-3xl xl:max-w-5xl 2xl:max-w-6xl">
        <div className="coach-chat-header flex w-full items-center justify-between gap-3">
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
            {/* The tab's saved conversation survives this same-tab round trip. */}
            <Link
              href="/summary"
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
          key={`${sessionKey}:${restartCount}`}
          sessionKey={sessionKey}
          onClear={() => {
            clearConversation(sessionKey);
            setRestartCount((count) => count + 1);
          }}
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
