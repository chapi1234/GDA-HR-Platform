import Sector from "../models/Sector.js";
import { SCOPE_LEVELS } from "./roles.js";

/**
 * Resolve organizational placement from request body.
 * Accepts leafUnitId (preferred) or sectorId / subSectorId / subSubSectorId.
 */
export async function resolveOrgPlacement(body = {}) {
  const { leafUnitId, sectorId, subSectorId, subSubSectorId, scopeLevel } = body;

  let unit = null;
  if (leafUnitId) {
    unit = await Sector.findById(leafUnitId);
  } else if (subSubSectorId) {
    unit = await Sector.findById(subSubSectorId);
  } else if (subSectorId) {
    unit = await Sector.findById(subSectorId);
  } else if (sectorId) {
    unit = await Sector.findById(sectorId);
  }

  if (!unit) {
    return { error: "Valid sector / sub-sector assignment is required" };
  }

  // Build placement from unit + ancestors
  let resolvedSectorId = null;
  let resolvedSubSectorId = null;
  let resolvedSubSubSectorId = null;
  let resolvedScope = scopeLevel || null;

  if (unit.level === "sector") {
    resolvedSectorId = unit._id;
    resolvedScope = resolvedScope || SCOPE_LEVELS.SECTOR;
  } else if (unit.level === "sub_sector") {
    resolvedSubSectorId = unit._id;
    resolvedSectorId = unit.parent;
    resolvedScope = resolvedScope || SCOPE_LEVELS.SUB_SECTOR;
  } else if (unit.level === "sub_sub_sector") {
    resolvedSubSubSectorId = unit._id;
    resolvedSubSectorId = unit.parent;
    // parent of sub_sector is sector
    const parentSub = await Sector.findById(unit.parent);
    resolvedSectorId = parentSub?.parent || null;
    resolvedScope = resolvedScope || SCOPE_LEVELS.SUB_SUB_SECTOR;
  }

  return {
    sectorId: resolvedSectorId,
    subSectorId: resolvedSubSectorId,
    subSubSectorId: resolvedSubSubSectorId,
    scopeLevel: resolvedScope,
    unit,
    pathLabel: (unit.pathNames || [unit.name]).join(" › "),
  };
}
