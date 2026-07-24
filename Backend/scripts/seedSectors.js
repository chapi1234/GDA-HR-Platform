import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectDB from "../config/DBconnect.js";
import Sector from "../models/Sector.js";
import Employee from "../models/Employee.js";

async function upsertUnit({ name, level, parent = null, sortOrder = 0, description = "" }) {
  const parentId = parent?._id || null;
  let ancestors = [];
  let pathNames = [name];

  if (parent) {
    ancestors = [...(parent.ancestors || []), parent._id];
    pathNames = [...(parent.pathNames || [parent.name]), name];
  }

  let doc = await Sector.findOne({ name, parent: parentId });
  if (doc) {
    doc.level = level;
    doc.description = description || doc.description;
    doc.sortOrder = sortOrder;
    doc.ancestors = ancestors;
    doc.pathNames = pathNames;
    doc.status = "active";
    await doc.save();
    return doc;
  }

  return Sector.create({
    name,
    level,
    parent: parentId,
    ancestors,
    pathNames,
    sortOrder,
    description,
    status: "active",
  });
}

async function seed() {
  await connectDB();

  console.log("Seeding sector hierarchy...");

  const business = await upsertUnit({
    name: "Business Sector",
    level: "sector",
    sortOrder: 1,
    description: "Commercial and enterprise units of GammoDA",
  });

  const charity = await upsertUnit({
    name: "Charity Sector",
    level: "sector",
    sortOrder: 2,
    description: "Community and charity programs (sub-units TBD)",
  });

  const businessSubs = [
    "Nechisar Hotel",
    "Lolashe Construction",
    "Garo Garage",
    "Arbaminch Agriculture Association",
    "Guge Inset Reproduction",
    "Tourism Development",
  ];

  const subDocs = {};
  for (let i = 0; i < businessSubs.length; i++) {
    subDocs[businessSubs[i]] = await upsertUnit({
      name: businessSubs[i],
      level: "sub_sector",
      parent: business,
      sortOrder: i + 1,
    });
  }

  await upsertUnit({
    name: "Crocodile Breeding",
    level: "sub_sub_sector",
    parent: subDocs["Tourism Development"],
    sortOrder: 1,
  });

  const springs = await upsertUnit({
    name: "40 Springs",
    level: "sub_sub_sector",
    parent: subDocs["Tourism Development"],
    sortOrder: 2,
  });

  // Migrate managers who were scoped to nested units → Unit Manager
  const nestedManagers = await Employee.updateMany(
    { role: "manager", scopeLevel: "sub_sub_sector", subSubSectorId: { $ne: null } },
    { $set: { role: "unit_manager" } }
  );
  if (nestedManagers.modifiedCount) {
    console.log(`Migrated ${nestedManagers.modifiedCount} nested manager(s) → unit_manager`);
  }

  // Optional bootstrap Super Admin from env
  const email = process.env.SUPERADMIN_EMAIL || "superadmin@gammoda.local";
  const password = process.env.SUPERADMIN_PASSWORD || "SuperAdmin123!";
  const existing = await Employee.findOne({ email }).select("+password");

  if (!existing) {
    const hashed = await bcrypt.hash(password, 10);
    await Employee.create({
      name: "GammoDA Super Admin",
      email,
      password: hashed,
      role: "superadmin",
      scopeLevel: "organization",
      position: "Super Administrator",
      status: "active",
    });
    console.log(`Created Super Admin: ${email} / ${password}`);
  } else {
    console.log(`Super Admin already exists: ${email}`);
  }

  // Demo accounts for each role / scope (idempotent)
  const hotel = subDocs["Nechisar Hotel"];
  const demoPassword = "Demo123!";

  // Migrate legacy Sector Admin / Sector HR → Sector Lead
  const legacySector = await Employee.updateMany(
    {
      role: { $in: ["admin", "hr"] },
      scopeLevel: { $ne: "organization" },
    },
    {
      $set: {
        role: "sector_lead",
        scopeLevel: "sector",
        subSectorId: null,
        subSubSectorId: null,
      },
    }
  );
  if (legacySector.modifiedCount) {
    console.log(
      `Migrated ${legacySector.modifiedCount} sector admin/hr account(s) → sector_lead`
    );
  }

  const demoAccounts = [
    {
      name: "Org Admin",
      email: "orgadmin@gammoda.local",
      role: "admin",
      scopeLevel: "organization",
      position: "Organization Admin",
    },
    {
      name: "Org HR",
      email: "orghr@gammoda.local",
      role: "hr",
      scopeLevel: "organization",
      position: "Organization HR",
    },
    {
      name: "Business Sector Lead",
      email: "business.lead@gammoda.local",
      role: "sector_lead",
      scopeLevel: "sector",
      sectorId: business._id,
      position: "Business Sector Lead",
    },
    {
      name: "Nechisar Hotel Manager",
      email: "hotel.manager@gammoda.local",
      role: "manager",
      scopeLevel: "sub_sector",
      sectorId: business._id,
      subSectorId: hotel._id,
      position: "Hotel Manager",
    },
    {
      name: "40 Springs Unit Manager",
      email: "springs.manager@gammoda.local",
      role: "unit_manager",
      scopeLevel: "sub_sub_sector",
      sectorId: business._id,
      subSectorId: subDocs["Tourism Development"]._id,
      subSubSectorId: springs._id,
      position: "Unit Manager",
    },
    {
      name: "Nechisar Hotel Employee",
      email: "hotel.employee@gammoda.local",
      role: "employee",
      scopeLevel: "sub_sector",
      sectorId: business._id,
      subSectorId: hotel._id,
      position: "Staff",
    },
  ];

  const hashedDemo = await bcrypt.hash(demoPassword, 10);
  for (const acc of demoAccounts) {
    const found = await Employee.findOne({ email: acc.email });
    if (!found) {
      await Employee.create({
        ...acc,
        password: hashedDemo,
        status: "active",
      });
      console.log(`Created ${acc.role}: ${acc.email} / ${demoPassword}`);
    } else {
      // Keep demo accounts aligned with current role model
      found.role = acc.role;
      found.scopeLevel = acc.scopeLevel;
      found.sectorId = acc.sectorId || null;
      found.subSectorId = acc.subSectorId || null;
      found.subSubSectorId = acc.subSubSectorId || null;
      found.position = acc.position;
      found.name = acc.name;
      await found.save();
      console.log(`Updated demo account: ${acc.email} → ${acc.role}`);
    }
  }

  // Point old emails at Sector Lead (same password) if they still exist
  for (const legacyEmail of [
    "business.admin@gammoda.local",
    "business.hr@gammoda.local",
  ]) {
    const legacy = await Employee.findOne({ email: legacyEmail });
    if (legacy) {
      legacy.role = "sector_lead";
      legacy.scopeLevel = "sector";
      legacy.sectorId = business._id;
      legacy.subSectorId = null;
      legacy.subSubSectorId = null;
      legacy.position = "Business Sector Lead";
      await legacy.save();
      console.log(`Legacy account ${legacyEmail} → sector_lead`);
    }
  }

  console.log("Sector seed complete.");
  console.log(`Business Sector id: ${business._id}`);
  console.log(`Charity Sector id: ${charity._id}`);
  console.log("Demo password for role accounts:", demoPassword);

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.connection.close();
  process.exit(1);
});
