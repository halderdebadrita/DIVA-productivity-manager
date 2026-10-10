"use client";
import Link from "next/link";
import { QuickLinkRow } from "@/components/shell/quick-link";

export function AIShortcuts() {
  return (
    <section className="card p-4" aria-labelledby="ai-sc">
      <div className="flex items-center justify-between">
        <h2 id="ai-sc" className="section-title">AI study shortcuts</h2>
        <Link href="/settings#quick-links" className="text-2xs text-subtle hover:text-fg">Edit links</Link>
      </div>
      <p className="mt-0.5 text-2xs text-subtle">Opens your own signed-in account in a new tab. Nothing from Diva is sent automatically.</p>
      <div className="mt-3 space-y-1.5">
        <QuickLinkRow k="claude" blurb="Explain concepts, quiz yourself" />
        <QuickLinkRow k="chatgpt" blurb="Practice questions, summaries" />
        <QuickLinkRow k="gemini" blurb="Ask with your Google account" />
        <QuickLinkRow k="notebooklm" blurb="Study from your own sources" />
      </div>
    </section>
  );
}
