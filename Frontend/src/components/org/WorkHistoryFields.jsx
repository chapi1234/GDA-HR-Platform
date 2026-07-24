import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Plus, Trash2 } from "lucide-react";

export const emptyWorkHistoryEntry = () => ({
  company: "",
  position: "",
  startDate: "",
  endDate: "",
  description: "",
});

/**
 * Editable list of previous employers.
 * @param {object[]} value
 * @param {(next: object[]) => void} onChange
 * @param {string} [idPrefix]
 */
export default function WorkHistoryFields({
  value = [],
  onChange,
  idPrefix = "work",
  readOnly = false,
}) {
  const entries = Array.isArray(value) ? value : [];

  const updateEntry = (index, patch) => {
    if (readOnly) return;
    const next = entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
    onChange(next);
  };

  const addEntry = () => {
    if (readOnly) return;
    onChange([...entries, emptyWorkHistoryEntry()]);
  };

  const removeEntry = (index) => {
    if (readOnly) return;
    onChange(entries.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>Previous work history</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add prior companies this employee worked at before joining
          </p>
        </div>
        {!readOnly ? (
          <Button type="button" variant="outline" size="sm" onClick={addEntry}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed border-border px-3 py-4 text-center">
          No previous employers added yet
        </p>
      ) : (
        <div className="space-y-4">
          {entries.map((entry, index) => (
            <div
              key={`${idPrefix}-${index}`}
              className="rounded-lg border border-border p-3 space-y-3 bg-muted/20"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Employer {index + 1}</p>
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-8 px-2"
                    onClick={() => removeEntry(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${idPrefix}-company-${index}`}>Company</Label>
                  <Input
                    id={`${idPrefix}-company-${index}`}
                    value={entry.company || ""}
                    onChange={(e) => updateEntry(index, { company: e.target.value })}
                    placeholder="Company name"
                    disabled={readOnly}
                    className={readOnly ? "bg-muted" : undefined}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${idPrefix}-position-${index}`}>Position / Job title</Label>
                  <Input
                    id={`${idPrefix}-position-${index}`}
                    value={entry.position || ""}
                    onChange={(e) => updateEntry(index, { position: e.target.value })}
                    placeholder="e.g. Accountant"
                    disabled={readOnly}
                    className={readOnly ? "bg-muted" : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${idPrefix}-start-${index}`}>Start date</Label>
                  <Input
                    id={`${idPrefix}-start-${index}`}
                    type="month"
                    value={(entry.startDate || "").slice(0, 7)}
                    onChange={(e) => updateEntry(index, { startDate: e.target.value })}
                    disabled={readOnly}
                    className={readOnly ? "bg-muted" : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${idPrefix}-end-${index}`}>End date</Label>
                  <Input
                    id={`${idPrefix}-end-${index}`}
                    type="month"
                    value={(entry.endDate || "").slice(0, 7)}
                    onChange={(e) => updateEntry(index, { endDate: e.target.value })}
                    disabled={readOnly}
                    className={readOnly ? "bg-muted" : undefined}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${idPrefix}-desc-${index}`}>Notes (optional)</Label>
                  <Textarea
                    id={`${idPrefix}-desc-${index}`}
                    value={entry.description || ""}
                    onChange={(e) => updateEntry(index, { description: e.target.value })}
                    placeholder="Responsibilities, achievements, reason for leaving…"
                    className={readOnly ? "min-h-[64px] bg-muted" : "min-h-[64px]"}
                    disabled={readOnly}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
