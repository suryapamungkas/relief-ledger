interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function SkeletonCard({ lines = 3 }: SkeletonProps) {
  return (
    <div className="glass rounded-2xl p-6 space-y-3">
      <Skeleton className="h-6 w-2/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? "w-1/2" : "w-full"}`} />
      ))}
    </div>
  );
}
