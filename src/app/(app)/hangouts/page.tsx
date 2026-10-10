import { PartyPopper } from "lucide-react";
import { PageHeader } from "@/components/ui/bits";

export const metadata = { title: "Hangouts" };

export default function HangoutsPage() {
  return (
    <div>
      <PageHeader title="Hangouts" description="Plan outings, meetups, parties and plans with friends." />
      <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[#FF7EB6]/15 text-[#FF7EB6]"><PartyPopper className="size-6" /></span>
        <p className="text-[15px] font-medium">Hangouts planning is coming in a later version</p>
        <p className="mt-1 max-w-md text-sm text-muted">This space is reserved so it can grow without changing the rest of Diva. The features will be defined later.</p>
      </div>
    </div>
  );
}
