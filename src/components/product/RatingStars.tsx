import { Star } from "lucide-react";

/**
 * Honest rating display: fills stars to the rounded average and shows the real
 * review count. Renders a quiet "No reviews yet" when there are none — never
 * fabricated stars.
 */
export function RatingStars({ ratings }: { ratings: number[] }) {
  if (ratings.length === 0) {
    return <span className="text-xs text-gray-400">No reviews yet</span>;
  }
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const filled = Math.round(avg);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5 text-amber-400" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={13} className={i < filled ? "fill-current" : "text-gray-300"} />
        ))}
      </div>
      <span className="text-xs text-gray-400">
        {avg.toFixed(1)} ({ratings.length})
      </span>
    </div>
  );
}
