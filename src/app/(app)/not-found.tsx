import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/bits";
import { LinkButton } from "@/components/ui/link-button";

export default function NotFound() {
  return <EmptyState icon={SearchX} title="That page doesn't exist" className="mt-10" action={<LinkButton href="/dashboard">Back to dashboard</LinkButton>}>It may have been deleted.</EmptyState>;
}
