"use client";

import { useRef, useState } from "react";
import { AlertDialog, Dialog, DropdownMenu } from "radix-ui";
import { Button } from "@/components/ui/button";
import { useSavedCourses } from "@/features/chat/saved-courses";
import {
  COURSE_STATUS_LABELS,
  currentCourseHistory,
} from "@/features/chat/completion-state";
import { isCourseCode } from "@/lib/course-details";
import type { CourseStatus } from "@/lib/planning";

const panel =
  "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-popover p-5 text-popover-foreground shadow-xl";

/** One compact menu keeps editing and restarting reachable without another
 * toolbar row on a phone. All edits use the same saved history as checkboxes. */
export function PlanningControls({
  history,
  historyOpen,
  onHistoryOpenChange,
  busy,
  onRefresh,
  onRestart,
  label,
}: {
  history: unknown;
  historyOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  busy: boolean;
  onRefresh?: () => void;
  onRestart: (clearSaved: boolean) => void;
  label?: string;
}) {
  const overrides = useSavedCourses((s) => s.completionOverrides);
  const setStatus = useSavedCourses((s) => s.setCourseStatus);
  const current = currentCourseHistory(history, overrides);
  const [restartOpen, setRestartOpen] = useState(false);
  const [clearSaved, setClearSaved] = useState(false);
  const [code, setCode] = useState("");
  const [addStatus, setAddStatus] = useState<CourseStatus>("completed");
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    trigger.current?.focus();
  };
  const inputClass =
    "min-h-11 min-w-0 rounded-lg border border-current/30 bg-popover px-2 text-base text-popover-foreground";
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            ref={trigger}
            type="button"
            aria-label="Plan options"
            title="Plan options"
            className="min-h-11 min-w-11 cursor-pointer rounded-lg px-1 text-sm focus-visible:outline-2"
          >
            {label ?? <span className="text-xl">⋯</span>}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="bg-popover text-popover-foreground z-50 max-w-[calc(100vw-2rem)] rounded-xl border p-1 shadow-xl"
          >
            <DropdownMenu.Item
              disabled={busy}
              onSelect={() => onHistoryOpenChange(true)}
              className="focus:bg-accent flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm outline-none data-disabled:opacity-50"
            >
              Edit reported courses
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => {
                setClearSaved(false);
                setRestartOpen(true);
              }}
              className="focus:bg-accent flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm outline-none"
            >
              Restart setup form
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <Dialog.Root open={historyOpen} onOpenChange={onHistoryOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Content className={panel} onCloseAutoFocus={restoreFocus}>
            <Dialog.Title className="text-lg font-semibold">
              Edit reported courses
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm">
              Change a status or remove a mistaken entry. Changes save on this
              device. To correct a course code, remove it and add the right one.
            </Dialog.Description>
            <ul className="mt-3 space-y-3">
              {Object.entries(current).map(([courseCode, entry]) => (
                <li
                  key={courseCode}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-current/20 p-3"
                >
                  <strong className="flex-1">{courseCode}</strong>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Remove reported ${courseCode}`}
                    onClick={() => setStatus(courseCode, "removed")}
                    className="min-h-11 cursor-pointer rounded px-2 text-sm underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                  <select
                    aria-label={`Status for ${courseCode}`}
                    value={entry.status}
                    disabled={busy}
                    onChange={(e) =>
                      setStatus(courseCode, e.target.value as CourseStatus)
                    }
                    className={`${inputClass} w-full`}
                  >
                    {Object.entries(COURSE_STATUS_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </li>
              ))}
            </ul>
            {!Object.keys(current).length && (
              <p className="mt-3 text-sm">No courses reported.</p>
            )}
            <form
              className="mt-4 grid gap-2 border-t border-current/20 pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                const normalized = code
                  .trim()
                  .toUpperCase()
                  .replace(/^([A-Z]{3,4})\s*(\d{4})$/, "$1 $2");
                if (!isCourseCode(normalized)) {
                  setError("Enter a course code such as HIST 1301.");
                  return;
                }
                if (current[normalized]) {
                  setError(
                    `${normalized} is already listed. Change its status above.`,
                  );
                  return;
                }
                setStatus(normalized, addStatus);
                setCode("");
                setError("");
              }}
            >
              <label
                htmlFor="reported-course-code"
                className="text-sm font-semibold"
              >
                Add a reported course
              </label>
              <input
                id="reported-course-code"
                value={code}
                maxLength={20}
                onChange={(e) => setCode(e.target.value)}
                placeholder="HIST 1301"
                disabled={busy}
                className={inputClass}
              />
              <select
                aria-label="Status for added course"
                value={addStatus}
                onChange={(e) => setAddStatus(e.target.value as CourseStatus)}
                disabled={busy}
                className={inputClass}
              >
                {Object.entries(COURSE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {error && (
                <p role="alert" className="text-sm">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                variant="outline"
                disabled={busy || !code.trim()}
                className="min-h-11"
              >
                Add course
              </Button>
            </form>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="outline" className="min-h-11">
                  Done
                </Button>
              </Dialog.Close>
              {onRefresh && (
                <Button
                  disabled={busy}
                  className="min-h-11 whitespace-normal"
                  onClick={() => {
                    onHistoryOpenChange(false);
                    onRefresh();
                  }}
                >
                  Update my remaining courses
                </Button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <AlertDialog.Root open={restartOpen} onOpenChange={setRestartOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <AlertDialog.Content
            className={panel}
            onCloseAutoFocus={restoreFocus}
          >
            <AlertDialog.Title className="text-lg font-semibold">
              Restart the setup form?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm">
              Start again with the welcome page and new program choices. This
              tab’s chat and unfinished question will be cleared. Your saved
              classes, reported courses and notes stay unless you choose to
              clear them below.
            </AlertDialog.Description>
            <label className="mt-3 flex min-h-11 items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={clearSaved}
                onChange={(e) => setClearSaved(e.target.checked)}
                className="mt-1 size-5 shrink-0"
              />
              Also clear my saved classes, reported courses and notes
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="outline" className="min-h-11">
                  Cancel
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  className="min-h-11"
                  onClick={() => onRestart(clearSaved)}
                >
                  Restart form
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
