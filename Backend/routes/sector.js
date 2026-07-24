import express from "express";
import authorize from "../middlewares/authorize.js";
import {
  ALL_STAFF_ROLES,
  HR_AND_ABOVE,
  ADMIN_AND_ABOVE,
} from "../utils/roles.js";
import {
  getSectorTree,
  getPublicSectors,
  getSectorChildren,
  getSectorById,
  createSector,
  updateSector,
  deleteSector,
} from "../controllers/sectorController.js";

const router = express.Router();

router.get("/public-list", getPublicSectors);
router.get("/tree", authorize(ALL_STAFF_ROLES), getSectorTree);
router.get("/children/:id", authorize(ALL_STAFF_ROLES), getSectorChildren);
router.get("/:id", authorize(ALL_STAFF_ROLES), getSectorById);
router.post("/", authorize([...HR_AND_ABOVE, ...ADMIN_AND_ABOVE]), createSector);
router.put("/:id", authorize([...HR_AND_ABOVE, ...ADMIN_AND_ABOVE]), updateSector);
router.delete("/:id", authorize(ADMIN_AND_ABOVE), deleteSector);

export default router;
