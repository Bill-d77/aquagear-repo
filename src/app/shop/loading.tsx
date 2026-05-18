export default function ShopLoading() {
  return (
    <div className="page-wrapper">
      {/* Title skeleton */}
      <div className="h-9 w-24 bg-gray-200 rounded-lg animate-pulse mb-6" />

      {/* Pills skeleton */}
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-gray-100 rounded-full animate-pulse" />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="w-full h-40 bg-gray-100 rounded-xl" />
            <div className="mt-3 h-4 bg-gray-100 rounded w-3/4" />
            <div className="mt-2 h-3 bg-gray-100 rounded w-1/3" />
            <div className="mt-4 h-11 bg-gray-100 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
