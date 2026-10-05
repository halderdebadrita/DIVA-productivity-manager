"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-6 text-center">
      <AlertTriangle className="mx-auto mb-2 size-6 text-danger" />
      <p className="font-medium">Something went wrong loading this page</p>
      <p className="mt-1 text-sm text-muted">{error.message || "Unexpected error"} — your saved data is untouched.</p>
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </div>
  );
}
