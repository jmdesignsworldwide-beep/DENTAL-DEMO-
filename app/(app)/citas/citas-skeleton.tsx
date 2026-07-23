import { Skeleton } from "@/components/ui/skeleton";

export function CitasSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <Skeleton className="h-9 w-64 rounded-xl" />
      </div>
      <Skeleton className="h-[560px] w-full rounded-2xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}
