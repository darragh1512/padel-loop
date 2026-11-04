"use client";

// The create form as a nearly full-height glass sheet: opened from the tab bar
// over whatever screen you're on, and from any /create link. The form inside
// only mounts while the sheet is open.

import CreateGameForm from "@/components/CreateGameForm";
import {
  GlassSheet,
  GlassSheetContent,
  GlassSheetTitle,
} from "@/components/glassyui/glass-sheet";

export default function CreateSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <GlassSheet open={open} onOpenChange={onOpenChange}>
      <GlassSheetContent
        aria-describedby={undefined}
        closeLabel="Close"
        className="court c-glass c-sheet p-0"
        // Don't jump into the first field: on a phone that throws up the
        // keyboard before anyone has read the form.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <GlassSheetTitle className="sr-only">Create a game</GlassSheetTitle>
        <CreateGameForm inSheet />
      </GlassSheetContent>
    </GlassSheet>
  );
}
