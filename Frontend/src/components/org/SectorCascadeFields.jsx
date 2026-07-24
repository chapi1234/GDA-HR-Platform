import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

/**
 * Cascading Sector → Sub-sector → Sub-sub-sector fields.
 * Expects flat sector nodes from /api/sectors/public-list or tree flattened.
 *
 * @param {string|null} unitDepth
 *   - "sub_sector": stop at sub-sector (Manager)
 *   - "sub_sub_sector": require nested unit (Unit Manager)
 *   - null/undefined: optional nested unit (Employee)
 */
export default function SectorCascadeFields({
  sectors = [],
  value = {},
  onChange,
  showOrgWide = false,
  disabled = false,
  unitDepth = null,
}) {
  const {
    scopeLevel = "sub_sector",
    sectorId = "",
    subSectorId = "",
    subSubSectorId = "",
  } = value;

  const rootSectors = sectors.filter((s) => s.level === "sector");
  const subSectors = sectors.filter(
    (s) => s.level === "sub_sector" && String(s.parent) === String(sectorId)
  );
  const subSubSectors = sectors.filter(
    (s) =>
      s.level === "sub_sub_sector" && String(s.parent) === String(subSectorId)
  );

  const patch = (next) => onChange({ ...value, ...next });
  const forceSubSector = unitDepth === "sub_sector";
  const forceSubSub = unitDepth === "sub_sub_sector";
  const showNestedUnit =
    subSectorId &&
    subSubSectors.length > 0 &&
    !forceSubSector &&
    (forceSubSub || !unitDepth);

  return (
    <div className="space-y-3">
      {showOrgWide && (
        <div className="space-y-2">
          <Label>Scope level</Label>
          <Select
            value={scopeLevel}
            disabled={disabled}
            onValueChange={(v) =>
              patch({
                scopeLevel: v,
                sectorId: v === "organization" ? "" : sectorId,
                subSectorId: "",
                subSubSectorId: "",
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="organization">Organization-wide</SelectItem>
              <SelectItem value="sector">Sector</SelectItem>
              <SelectItem value="sub_sector">Sub-sector</SelectItem>
              <SelectItem value="sub_sub_sector">Sub-sub-sector</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {scopeLevel !== "organization" && (
        <>
          <div className="space-y-2">
            <Label>Sector *</Label>
            <Select
              value={sectorId || undefined}
              disabled={disabled}
              onValueChange={(v) =>
                patch({
                  sectorId: v,
                  subSectorId: "",
                  subSubSectorId: "",
                  scopeLevel:
                    scopeLevel === "organization" ? "sector" : scopeLevel,
                })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    rootSectors.length ? "Select sector..." : "No sectors — run seed"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {rootSectors.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sectorId && scopeLevel !== "sector" && (
            <div className="space-y-2">
              <Label>Sub-sector *</Label>
              <Select
                value={subSectorId || undefined}
                disabled={disabled}
                onValueChange={(v) =>
                  patch({
                    subSectorId: v,
                    subSubSectorId: "",
                    scopeLevel: forceSubSub ? "sub_sub_sector" : "sub_sector",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      subSectors.length
                        ? "Select sub-sector..."
                        : "No sub-sectors"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {subSectors.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showNestedUnit && (
            <div className="space-y-2">
              <Label>{forceSubSub ? "Unit *" : "Unit (optional)"}</Label>
              <Select
                value={subSubSectorId || undefined}
                disabled={disabled}
                onValueChange={(v) =>
                  patch({
                    subSubSectorId: v,
                    scopeLevel: "sub_sub_sector",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit..." />
                </SelectTrigger>
                <SelectContent>
                  {subSubSectors.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function getLeafUnitId(value = {}) {
  if (value.scopeLevel === "organization") return null;
  return value.subSubSectorId || value.subSectorId || value.sectorId || null;
}
