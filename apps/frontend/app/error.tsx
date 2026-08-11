"use client";

// Route-level error boundary. Without one, any render throw — a corrupt
// localStorage blob, a bad tool payload — replaced the whole app with the
// framework's error screen, and the student's only route back was to know to
// clear site data. This keeps them inside the product and gives them the two
// actions that actually recover: retry, or start over.
//
// `reset()` re-renders the segment. It does NOT clear stored state, so the
// "start over" link is the escape hatch when the stored state is the problem.
export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">Something went wrong.</h1>
      <p className="max-w-prose text-sm opacity-75">
        Major hit an unexpected problem. Your saved answers are still here — try
        again, or start over if it keeps happening.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-current/30 px-4 py-2 text-sm font-semibold"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-lg border border-current/30 px-4 py-2 text-sm font-semibold"
        >
          Start over
        </a>
      </div>
      {/* The digest is the only handle on the server-side log for this error;
          without it a student report is unactionable. */}
      {error.digest ? (
        <p className="text-xs opacity-50">Reference: {error.digest}</p>
      ) : null}
    </main>
  );
}
