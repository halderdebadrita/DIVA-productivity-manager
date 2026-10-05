import { Skeleton } from "@/components/ui/bits";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-80" />
      <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 xl:grid-cols-12">
        <Skeleton className="h-64 xl:col-span-7" />
        <Skeleton className="h-64 xl:col-span-5" />
      </div>
    </div>
  );
}
