"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteHackathonAction } from "@/app/actions/entities";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";

export function DeleteHackathon({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <Confirm
      title={`Delete ${name}?`}
      description="The workspace, notes and uploaded files are permanently deleted. Linked tasks (including the certificate follow-up) are kept. To archive instead, mark it Completed."
      onConfirm={async () => {
        const r = await deleteHackathonAction(id);
        if (!r.ok) return toast.error(r.error);
        toast.success("Hackathon deleted");
        router.push("/hackathons");
      }}
      trigger={<Button size="icon" variant="ghost" aria-label="Delete hackathon"><Trash2 /></Button>}
    />
  );
}
