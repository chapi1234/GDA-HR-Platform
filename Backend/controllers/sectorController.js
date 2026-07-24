import Sector from "../models/Sector.js";
import { canManageOrgStructure, isOrgWide, ROLES } from "../utils/roles.js";

/**
 * Which sector documents a viewer may see in the org tree.
 * Org-wide roles: everything.
 * Sector Lead: their sector + all descendants.
 * Manager / Employee: their unit + descendants (and nothing else).
 */
function sectorVisibilityFilter(user) {
  if (!user) return { _id: null };
  if (user.role === ROLES.SUPERADMIN || isOrgWide(user)) {
    return { status: "active" };
  }

  if (user.role === ROLES.SECTOR_LEAD && user.sectorId) {
    const sid = user.sectorId;
    return {
      status: "active",
      $or: [{ _id: sid }, { ancestors: sid }, { parent: sid }],
    };
  }

  if (user.subSubSectorId) {
    const id = user.subSubSectorId;
    return {
      status: "active",
      $or: [{ _id: id }, { ancestors: id }, { parent: id }],
    };
  }

  if (user.subSectorId) {
    const id = user.subSectorId;
    return {
      status: "active",
      $or: [{ _id: id }, { ancestors: id }, { parent: id }],
    };
  }

  if (user.sectorId) {
    const sid = user.sectorId;
    return {
      status: "active",
      $or: [{ _id: sid }, { ancestors: sid }, { parent: sid }],
    };
  }

  return { _id: null };
}

function buildTree(nodes) {
  const byId = new Map(nodes.map((n) => [String(n._id), { ...n, children: [] }]));
  const roots = [];

  for (const node of byId.values()) {
    if (node.parent) {
      const parent = byId.get(String(node.parent));
      if (parent) parent.children.push(node);
      else roots.push(node); // parent outside visible set → treat as local root
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export const getSectorTree = async (req, res) => {
  try {
    const filter = sectorVisibilityFilter(req.user);
    const nodes = await Sector.find(filter)
      .sort({ level: 1, sortOrder: 1, name: 1 })
      .lean();

    const roots = buildTree(nodes);

    res.status(200).json({
      status: true,
      message: "Sector tree fetched successfully",
      data: roots,
      meta: {
        scoped:
          req.user?.role === ROLES.SECTOR_LEAD ||
          (!isOrgWide(req.user) && req.user?.role !== ROLES.SUPERADMIN),
      },
    });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error: " + error });
  }
};

export const getPublicSectors = async (_req, res) => {
  try {
    const nodes = await Sector.find({ status: "active" })
      .select("name level parent pathNames sortOrder")
      .sort({ level: 1, sortOrder: 1, name: 1 })
      .lean();

    res.status(200).json({
      status: true,
      message: "Public sectors fetched",
      data: nodes,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error: " + error });
  }
};

export const getSectorChildren = async (req, res) => {
  try {
    const { id } = req.params;
    const parentId = id === "root" ? null : id;
    const children = await Sector.find({
      parent: parentId,
      status: "active",
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    res.status(200).json({ status: true, data: children });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error: " + error });
  }
};

export const getSectorById = async (req, res) => {
  try {
    const sector = await Sector.findById(req.params.id)
      .populate("head", "name email role")
      .lean();
    if (!sector) {
      return res.status(404).json({ status: false, message: "Sector unit not found" });
    }
    res.status(200).json({ status: true, data: sector });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error: " + error });
  }
};

export const createSector = async (req, res) => {
  try {
    if (!canManageOrgStructure(req.user)) {
      return res.status(403).json({
        status: false,
        message: "Only Super Admin, Org Admin, or Org HR can manage the sector tree",
      });
    }

    const { name, description, level, parent, location, sortOrder, head } = req.body;
    if (!name || !level) {
      return res.status(400).json({ status: false, message: "Name and level are required" });
    }

    let ancestors = [];
    let pathNames = [name];
    let parentId = parent || null;

    if (parentId) {
      const parentDoc = await Sector.findById(parentId);
      if (!parentDoc) {
        return res.status(400).json({ status: false, message: "Invalid parent sector" });
      }
      ancestors = [...(parentDoc.ancestors || []), parentDoc._id];
      pathNames = [...(parentDoc.pathNames || [parentDoc.name]), name];
    }

    const sector = await Sector.create({
      name,
      description,
      level,
      parent: parentId,
      ancestors,
      pathNames,
      location,
      sortOrder: sortOrder || 0,
      head: head || null,
    });

    res.status(201).json({
      status: true,
      message: "Sector unit created successfully",
      data: sector,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        status: false,
        message: "A unit with this name already exists under the same parent",
      });
    }
    res.status(500).json({ status: false, message: "Internal server error: " + error });
  }
};

export const updateSector = async (req, res) => {
  try {
    if (!canManageOrgStructure(req.user)) {
      return res.status(403).json({
        status: false,
        message: "Only Super Admin, Org Admin, or Org HR can manage the sector tree",
      });
    }

    const { name, description, location, sortOrder, head, status } = req.body;
    const sector = await Sector.findById(req.params.id);
    if (!sector) {
      return res.status(404).json({ status: false, message: "Sector unit not found" });
    }

    if (name && name !== sector.name) {
      const oldName = sector.name;
      sector.name = name;
      const parentNames = (sector.pathNames || []).slice(0, -1);
      sector.pathNames = [...parentNames, name];

      // Keep descendant path labels in sync
      const descendants = await Sector.find({ ancestors: sector._id });
      for (const child of descendants) {
        const paths = child.pathNames || [];
        const idx = paths.indexOf(oldName);
        if (idx !== -1) {
          paths[idx] = name;
          child.pathNames = paths;
          await child.save();
        }
      }
    }
    if (description !== undefined) sector.description = description;
    if (location !== undefined) sector.location = location;
    if (sortOrder !== undefined) sector.sortOrder = sortOrder;
    if (head !== undefined) sector.head = head;
    if (status !== undefined) sector.status = status;

    await sector.save();
    res.status(200).json({ status: true, message: "Sector updated", data: sector });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error: " + error });
  }
};

export const deleteSector = async (req, res) => {
  try {
    if (!canManageOrgStructure(req.user) || req.user?.role === "hr") {
      return res.status(403).json({
        status: false,
        message: "Only Super Admin / Org Admin can delete sector units",
      });
    }

    const sector = await Sector.findById(req.params.id);
    if (!sector) {
      return res.status(404).json({ status: false, message: "Sector unit not found" });
    }

    const childCount = await Sector.countDocuments({ parent: sector._id });
    if (childCount > 0) {
      return res.status(400).json({
        status: false,
        message: "Cannot delete a unit that still has child units. Remove children first.",
      });
    }

    await Sector.findByIdAndDelete(sector._id);
    res.status(200).json({ status: true, message: "Sector unit deleted" });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error: " + error });
  }
};
