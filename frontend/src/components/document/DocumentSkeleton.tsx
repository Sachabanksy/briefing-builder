export function DocumentSkeleton() {
  return (
    <div className="a4-page animate-pulse">
      {/* Header skeleton */}
      <header className="mb-6 pb-4 border-b-2 border-muted">
        <div className="w-32 h-6 skeleton-pulse mb-3" />
        <div className="w-3/4 h-8 skeleton-pulse mb-2" />
        <div className="w-1/2 h-4 skeleton-pulse" />
      </header>

      {/* Quality banner skeleton */}
      <div className="h-20 skeleton-pulse rounded mb-6" />

      {/* Section skeletons */}
      {[1, 2, 3].map((section) => (
        <div key={section} className="mb-8">
          <div className="w-1/3 h-6 skeleton-pulse mb-4 border-b pb-2" />
          
          {/* Paragraph skeleton */}
          <div className="space-y-2 mb-4">
            <div className="w-full h-4 skeleton-pulse" />
            <div className="w-full h-4 skeleton-pulse" />
            <div className="w-3/4 h-4 skeleton-pulse" />
          </div>

          {section === 1 && (
            // Bullet points skeleton
            <div className="space-y-2 pl-5 mb-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2 h-2 skeleton-pulse rounded-full" />
                  <div className="flex-1 h-4 skeleton-pulse" />
                </div>
              ))}
            </div>
          )}

          {section === 2 && (
            // Table skeleton
            <div className="mb-4">
              <div className="h-8 skeleton-pulse mb-1" />
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 skeleton-pulse mb-0.5" />
              ))}
            </div>
          )}

          {section === 3 && (
            // Chart skeleton
            <div className="h-64 skeleton-pulse rounded mb-4" />
          )}
        </div>
      ))}

      {/* Footer skeleton */}
      <div className="absolute bottom-[20mm] left-[20mm] right-[20mm] flex justify-between">
        <div className="w-32 h-3 skeleton-pulse" />
        <div className="w-16 h-3 skeleton-pulse" />
      </div>
    </div>
  );
}
