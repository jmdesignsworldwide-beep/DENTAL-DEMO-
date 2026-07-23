import { Skeleton, SkeletonRow } from "@/components/ui/skeleton";

export function PatientsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-11 w-40 rounded-xl" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-64 rounded-xl" />
        <Skeleton className="h-9 w-40 rounded-xl" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface dark:bg-surface/80">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonRow key={i} cols={3} />
        ))}
      </div>
    </div>
  );
}
