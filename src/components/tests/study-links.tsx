"use client";
import { QuickLinkButton } from "@/components/shell/quick-link";

export function StudyLinks() {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <QuickLinkButton k="study_drive" label="My notes folder" />
      <QuickLinkButton k="college_portal" label="College portal" />
    </div>
  );
}
