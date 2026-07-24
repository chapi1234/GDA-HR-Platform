import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Previous / Next controls for client-paginated lists */
export default function ListPagination({
  page,
  totalPages,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  rangeLabel = "",
  className = "",
}) {
  if (totalPages <= 1) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 pt-2 ${className}`}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasPrev}
        onClick={onPrev}
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Previous
      </Button>
      <div className="text-sm text-muted-foreground text-center">
        {rangeLabel ? <span className="mr-2">{rangeLabel}</span> : null}
        <span>
          Page {page} of {totalPages}
        </span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasNext}
        onClick={onNext}
      >
        Next
        <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}
