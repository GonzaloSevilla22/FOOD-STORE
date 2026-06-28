export function SkeletonCard(): JSX.Element {
  return (
    <div className="animate-pulse rounded-xl border border-orange-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="mb-3 h-44 w-full rounded-lg bg-orange-100 dark:bg-gray-700" />
      <div className="space-y-2">
        <div className="h-5 w-3/4 rounded bg-orange-100 dark:bg-gray-700" />
        <div className="h-4 w-full rounded bg-orange-50 dark:bg-gray-800/50" />
        <div className="h-4 w-1/2 rounded bg-orange-50 dark:bg-gray-800/50" />
        <div className="h-9 w-full rounded-lg bg-orange-100 dark:bg-gray-700" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }): JSX.Element {
  return (
    <div className="animate-pulse space-y-2">
      <div className="flex gap-4 rounded-lg bg-orange-50 dark:bg-gray-800/50 p-3">
        <div className="h-4 flex-1 rounded bg-orange-200 dark:bg-gray-700" />
        <div className="h-4 w-24 rounded bg-orange-200 dark:bg-gray-700" />
        <div className="h-4 w-24 rounded bg-orange-200 dark:bg-gray-700" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 rounded-lg bg-white dark:bg-gray-900 p-3">
          <div className="h-3 flex-1 rounded bg-orange-100 dark:bg-gray-700" />
          <div className="h-3 w-24 rounded bg-orange-100 dark:bg-gray-700" />
          <div className="h-3 w-24 rounded bg-orange-100 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 1 }: { lines?: number }): JSX.Element {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-4 rounded bg-orange-100 dark:bg-gray-700 ${i === lines - 1 ? "w-3/4" : "w-full"}`} />
      ))}
    </div>
  );
}

export function SkeletonPage(): JSX.Element {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-8 w-48 rounded bg-orange-200 dark:bg-gray-700" />
      <div className="h-4 w-72 rounded bg-orange-100 dark:bg-gray-700" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
