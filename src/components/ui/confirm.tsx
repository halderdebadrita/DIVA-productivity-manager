"use client";
import * as A from "@radix-ui/react-alert-dialog";
import { useState } from "react";
import { Button } from "./button";

export function Confirm({
  trigger, title, description, confirmLabel = "Delete", onConfirm, open: controlledOpen, onOpenChange,
}: {
  trigger?: React.ReactNode; title: string; description: string; confirmLabel?: string; onConfirm: () => Promise<unknown> | unknown;
  /** Controlled mode, for opening the dialog from somewhere other than a trigger (e.g. a context menu). */
  open?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;
  return (
    <A.Root open={open} onOpenChange={setOpen}>
      {trigger && <A.Trigger asChild>{trigger}</A.Trigger>}
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-[60] bg-black/60" />
        <A.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-2xl">
          <A.Title className="text-[15px] font-semibold">{title}</A.Title>
          <A.Description className="mt-1.5 text-sm text-muted">{description}</A.Description>
          <div className="mt-5 flex justify-end gap-2">
            <A.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </A.Cancel>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
