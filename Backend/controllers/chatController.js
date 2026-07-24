import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Employee from "../models/Employee.js";
import Sector from "../models/Sector.js";
import { emitToUser, getIO, isUserInChatRoom } from "../socket.js";
import Notification from "../models/Notification.js";

const toId = (v) => String(v?._id || v?.id || v || "");

function dmKeyFor(a, b) {
  const x = toId(a);
  const y = toId(b);
  return [x, y].sort().join(":");
}

function mapEmployeeLite(emp) {
  if (!emp) return null;
  return {
    id: emp._id,
    name: emp.name,
    avatar:
      emp.profileImage ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name || "U")}&background=3b82f6&color=fff`,
    role: emp.role,
    unitPath:
      emp.subSubSectorId?.pathNames?.join(" › ") ||
      emp.subSectorId?.pathNames?.join(" › ") ||
      emp.sectorId?.pathNames?.join(" › ") ||
      "",
  };
}

function mapConversation(doc, viewerId) {
  const members = (doc.members || []).map((m) =>
    typeof m === "object" && m?.name ? mapEmployeeLite(m) : { id: m }
  );
  let title = doc.name;
  if (doc.type === "dm") {
    const other = members.find((m) => toId(m.id) !== toId(viewerId));
    title = other?.name || "Direct message";
  }
  return {
    id: doc._id,
    type: doc.type,
    name: title,
    description: doc.description || "",
    sectorRef: doc.sectorRef || null,
    members,
    memberCount: members.length,
    isPrivate: doc.isPrivate !== false,
    avatar: doc.avatar || "",
    lastMessageAt: doc.lastMessageAt,
    lastMessagePreview: doc.lastMessagePreview || "",
    lastMessageSender: doc.lastMessageSender
      ? mapEmployeeLite(doc.lastMessageSender) || { id: doc.lastMessageSender }
      : null,
    createdBy: doc.createdBy?._id || doc.createdBy || null,
    createdAt: doc.createdAt,
  };
}

function mapMessage(doc) {
  const deleted = !!doc.deletedAt;
  return {
    id: doc._id,
    conversationId: doc.conversation,
    body: deleted ? "" : doc.body || "",
    attachments: deleted
      ? []
      : (doc.attachments || []).map((a) => ({
          url: a.url,
          name: a.name || "",
          mimeType: a.mimeType || "",
          size: a.size || 0,
          resourceType: a.resourceType || "raw",
        })),
    deleted,
    deletedBy: doc.deletedBy ? toId(doc.deletedBy) : null,
    deleteReason: doc.deleteReason || "",
    editedAt: doc.editedAt || null,
    sender: mapEmployeeLite(doc.sender) || { id: doc.sender },
    readBy: (doc.readBy || []).map((r) => toId(r)),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function isChatModerator(user) {
  const role = String(user?.role || "").toLowerCase();
  return (
    role === "superadmin" ||
    role === "admin" ||
    role === "hr"
  );
}

/**
 * Rename permissions:
 * - DMs: never
 * - Groups: org mods, or group creator
 * - Org channel: org mods only
 * - Sector / sub / unit channels: org mods, or lead/manager of that node (or its ancestor)
 */
async function canRenameConversation(user, conv) {
  if (!conv || conv.type === "dm") return false;
  if (isChatModerator(user)) return true;

  const role = String(user?.role || "").toLowerCase();
  const me = toId(user?._id || user?.id);

  if (conv.type === "group") {
    return toId(conv.createdBy) === me;
  }

  if (conv.type === "org") return false;

  if (!["sector", "sub_sector", "sub_sub_sector"].includes(conv.type)) {
    return false;
  }
  if (!conv.sectorRef) return false;

  const sector = await Sector.findById(conv.sectorRef)
    .select("ancestors level")
    .lean();
  if (!sector) return false;

  const sId = toId(sector._id);
  const ancestors = (sector.ancestors || []).map(toId);

  if (role === "sector_lead") {
    const managed = toId(user.sectorId);
    return managed && (managed === sId || ancestors.includes(managed));
  }
  if (role === "manager") {
    const managed = toId(user.subSectorId || user.sectorId);
    return managed && (managed === sId || ancestors.includes(managed));
  }
  if (role === "unit_manager") {
    const managed = toId(user.subSubSectorId || user.subSectorId);
    return managed && (managed === sId || ancestors.includes(managed));
  }

  return false;
}

/**
 * Invite / add-user permissions:
 * - superadmin / admin / hr → any conversation (except maybe N/A for DM — DM still allowed to promote)
 * - sector_lead → their sector channel + all descendant sub/unit channels
 * - manager → their sub-sector + descendant unit channels
 * - unit_manager → their unit channel only
 * - group → creator or org mods
 * - org Everyone → org mods only
 */
async function canInviteToConversation(user, conv) {
  if (!conv || !user) return false;
  if (isChatModerator(user)) return true;

  const role = String(user.role || "").toLowerCase();
  const me = toId(user._id || user.id);

  if (conv.type === "group") {
    return toId(conv.createdBy) === me;
  }
  if (conv.type === "dm") {
    // Any DM participant can invite (promotes to group)
    return (conv.members || []).some((m) => toId(m) === me);
  }
  if (conv.type === "org") return false;

  if (!["sector", "sub_sector", "sub_sub_sector"].includes(conv.type)) {
    return false;
  }
  if (!conv.sectorRef) return false;

  const sector = await Sector.findById(conv.sectorRef)
    .select("ancestors level")
    .lean();
  if (!sector) return false;

  const sId = toId(sector._id);
  const ancestors = (sector.ancestors || []).map(toId);

  if (role === "sector_lead") {
    const managed = toId(user.sectorId);
    return managed && (managed === sId || ancestors.includes(managed));
  }
  if (role === "manager") {
    const managed = toId(user.subSectorId || user.sectorId);
    return managed && (managed === sId || ancestors.includes(managed));
  }
  if (role === "unit_manager") {
    const managed = toId(user.subSubSectorId || user.subSectorId);
    // Unit managers: only their exact unit channel
    return managed && managed === sId;
  }

  return false;
}

async function assertMember(conversationId, userId) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) return { error: "Conversation not found", status: 404 };
  const ok = (conv.members || []).some((m) => toId(m) === toId(userId));
  if (!ok) return { error: "Access denied", status: 403 };
  return { conv };
}

/**
 * Channel membership rules:
 * - GammoDA Everyone → all active staff
 * - superadmin / admin / hr → every sector, sub-sector, and unit channel
 * - staff assigned under a node → that node’s channel (and parent channels via leaf ancestors)
 * - sector_lead / manager / unit_manager → their managed node + all descendant channels
 */
function computeLeafAncestors(emp, sectorsById) {
  const leafId = toId(emp.subSubSectorId || emp.subSectorId || emp.sectorId);
  if (!leafId) return { leafId: null, ancestors: [] };
  const leaf = sectorsById.get(leafId);
  return {
    leafId,
    ancestors: (leaf?.ancestors || []).map(toId),
  };
}

function userShouldJoinChannel(emp, sectorNode, sectorsById) {
  const role = String(emp.role || "").toLowerCase();
  if (
    role === "superadmin" ||
    role === "admin" ||
    role === "hr" ||
    emp.scopeLevel === "organization"
  ) {
    return true;
  }

  const sId = toId(sectorNode._id);
  const { leafId, ancestors: leafAncestors } = computeLeafAncestors(emp, sectorsById);
  if (!leafId) return false;

  // On this node or anywhere under it
  if (leafId === sId || leafAncestors.includes(sId)) return true;

  // Leaders also join every descendant channel under what they manage
  if (role === "sector_lead" || role === "manager" || role === "unit_manager") {
    const managedId =
      role === "sector_lead"
        ? toId(emp.sectorId)
        : role === "manager"
          ? toId(emp.subSectorId || emp.sectorId)
          : toId(emp.subSubSectorId || emp.subSectorId || emp.sectorId);

    if (!managedId) return false;
    if (managedId === sId) return true;
    const nodeAncestors = (sectorNode.ancestors || []).map(toId);
    if (nodeAncestors.includes(managedId)) return true;
  }

  return false;
}

export async function syncOrgChannelsForUser(userId) {
  const emp = await Employee.findById(userId).select(
    "name role sectorId subSectorId subSubSectorId scopeLevel status chatOptOut"
  );
  if (!emp || emp.status === "terminated") return;

  const optedOut = new Set((emp.chatOptOut || []).map(toId));
  const role = String(emp.role || "").toLowerCase();
  const isOrgMod =
    role === "superadmin" ||
    role === "admin" ||
    role === "hr" ||
    emp.scopeLevel === "organization";

  // Org-wide channel — every active employee
  let org = await Conversation.findOne({ type: "org", name: "GammoDA Everyone" });
  if (!org) {
    org = await Conversation.create({
      type: "org",
      name: "GammoDA Everyone",
      description: "Organization-wide announcements and chat",
      isPrivate: false,
      members: [],
    });
  }

  if (isOrgMod) {
    // Keep Everyone populated for the whole org
    const everyone = await Employee.find({ status: { $ne: "terminated" } })
      .select("_id chatOptOut")
      .lean();
    const orgId = toId(org._id);
    const memberSet = new Set((org.members || []).map(toId));
    let changed = false;
    for (const person of everyone) {
      const pid = toId(person._id);
      const personOptOut = new Set((person.chatOptOut || []).map(toId));
      if (personOptOut.has(orgId)) continue;
      if (!memberSet.has(pid)) {
        org.members.push(person._id);
        memberSet.add(pid);
        changed = true;
      }
    }
    if (changed) await org.save();
  } else {
    const orgId = toId(org._id);
    const inOrg = (org.members || []).some((m) => toId(m) === toId(emp._id));
    if (!optedOut.has(orgId) && !inOrg) {
      org.members.push(emp._id);
      await org.save();
    }
  }

  const sectors = await Sector.find({ status: "active" }).lean();
  const sectorsById = new Map(sectors.map((s) => [toId(s._id), s]));
  const activeSectorIds = new Set(sectors.map((s) => toId(s._id)));

  // Drop stale auto-channels whose sector was deleted/recreated (old path-style leftovers)
  if (isOrgMod) {
    const stale = await Conversation.find({
      type: { $in: ["sector", "sub_sector", "sub_sub_sector"] },
      $or: [
        { sectorRef: null },
        { sectorRef: { $nin: [...activeSectorIds] } },
      ],
    }).select("_id name");
    for (const staleConv of stale) {
      await Conversation.deleteOne({ _id: staleConv._id });
    }
  }

  // When an org moderator syncs, reconcile all staff into tree channels
  const staffForReconcile = isOrgMod
    ? await Employee.find({ status: { $ne: "terminated" } })
        .select("role sectorId subSectorId subSubSectorId scopeLevel chatOptOut")
        .lean()
    : [emp.toObject ? emp.toObject() : emp];

  for (const s of sectors) {
    const type =
      s.level === "sector"
        ? "sector"
        : s.level === "sub_sector"
          ? "sub_sector"
          : "sub_sub_sector";
    const channelName = s.name || "Channel";

    let conv = await Conversation.findOne({ type, sectorRef: s._id });
    if (!conv) {
      conv = await Conversation.create({
        type,
        sectorRef: s._id,
        name: channelName,
        description: `${String(s.level || "").replace(/_/g, " ")} channel`,
        isPrivate: false,
        members: [],
      });
    } else if (!conv.nameCustomized) {
      // Keep display name = sector label (fixes old "A › B › C" path names)
      const looksLikePath = String(conv.name || "").includes("›");
      if (looksLikePath || conv.name !== channelName) {
        conv.name = channelName;
        await conv.save();
      }
    }

    const convId = toId(conv._id);
    let memberSet = new Set((conv.members || []).map(toId));
    let changed = false;

    for (const person of staffForReconcile) {
      const pid = toId(person._id);
      const personOptOut = new Set((person.chatOptOut || []).map(toId));
      const shouldJoin = userShouldJoinChannel(person, s, sectorsById);
      const isMember = memberSet.has(pid);

      if (shouldJoin && !personOptOut.has(convId) && !isMember) {
        conv.members.push(person._id);
        memberSet.add(pid);
        changed = true;
      } else if (!shouldJoin && isMember) {
        conv.members = conv.members.filter((m) => toId(m) !== pid);
        memberSet.delete(pid);
        changed = true;
      }
    }

    // Non-moderator path still applies opt-out for self only (already handled in loop)
    if (!isOrgMod) {
      const selfId = toId(emp._id);
      if (optedOut.has(convId) && memberSet.has(selfId)) {
        conv.members = conv.members.filter((m) => toId(m) !== selfId);
        changed = true;
      }
    }

    if (changed) await conv.save();
  }
}

export const listDirectory = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    const q = String(req.query.q || "").trim();
    const filter = {
      status: { $ne: "terminated" },
      _id: { $ne: me },
    };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }
    const people = await Employee.find(filter)
      .select("name profileImage role sectorId subSectorId subSubSectorId")
      .populate({ path: "sectorId", select: "name pathNames" })
      .populate({ path: "subSectorId", select: "name pathNames" })
      .populate({ path: "subSubSectorId", select: "name pathNames" })
      .sort({ name: 1 })
      .limit(100)
      .lean();
    res.json({ status: true, data: people.map(mapEmployeeLite) });
  } catch (err) {
    console.error("listDirectory", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

export const listConversations = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    await syncOrgChannelsForUser(me);

    const convs = await Conversation.find({
      members: me,
      hiddenFor: { $ne: me },
    })
      .populate({ path: "members", select: "name profileImage role" })
      .populate({ path: "lastMessageSender", select: "name profileImage role" })
      .sort({ lastMessageAt: -1 });

    // Unread counts
    const withUnread = await Promise.all(
      convs.map(async (c) => {
        const unread = await Message.countDocuments({
          conversation: c._id,
          deletedAt: null,
          sender: { $ne: me },
          readBy: { $ne: me },
        });
        return { ...mapConversation(c, me), unread };
      })
    );

    res.json({ status: true, data: withUnread });
  } catch (err) {
    console.error("listConversations", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

export const getOrCreateDm = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    const otherId = toId(req.body.userId);
    if (!otherId || otherId === me) {
      return res.status(400).json({ status: false, message: "Invalid user" });
    }
    const other = await Employee.findById(otherId).select("_id name status");
    if (!other || other.status === "terminated") {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const key = dmKeyFor(me, otherId);
    let conv = await Conversation.findOne({ type: "dm", dmKey: key });
    if (!conv) {
      conv = await Conversation.create({
        type: "dm",
        dmKey: key,
        name: "",
        members: [me, otherId],
        isPrivate: true,
        createdBy: me,
      });
    } else {
      // Opening DM again un-hides it for this user
      await Conversation.updateOne(
        { _id: conv._id },
        { $pull: { hiddenFor: me } }
      );
    }

    const populated = await Conversation.findById(conv._id)
      .populate({ path: "members", select: "name profileImage role" })
      .populate({ path: "lastMessageSender", select: "name profileImage role" });

    res.json({ status: true, data: mapConversation(populated, me) });
  } catch (err) {
    console.error("getOrCreateDm", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

export const createGroup = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();
    const memberIds = Array.isArray(req.body.memberIds)
      ? [...new Set(req.body.memberIds.map(toId).filter((id) => id && id !== me))]
      : [];

    if (!name) {
      return res.status(400).json({ status: false, message: "Group name is required" });
    }

    const validMembers = await Employee.find({
      _id: { $in: memberIds },
      status: { $ne: "terminated" },
    }).select("_id");

    const members = [me, ...validMembers.map((m) => toId(m._id))];

    const conv = await Conversation.create({
      type: "group",
      name,
      description,
      members,
      createdBy: me,
      isPrivate: true,
    });

    const populated = await Conversation.findById(conv._id).populate({
      path: "members",
      select: "name profileImage role",
    });

    // Notify invitees
    for (const mid of members) {
      if (mid === me) continue;
      emitToUser(mid, "chat:conversation", mapConversation(populated, mid));
    }

    res.status(201).json({ status: true, data: mapConversation(populated, me) });
  } catch (err) {
    console.error("createGroup", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

export const inviteMembers = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    const { id } = req.params;
    const { conv, error, status } = await assertMember(id, me);
    if (error) return res.status(status).json({ status: false, message: error });

    let actor = req.user;
    const dbUser = await Employee.findById(me)
      .select("role scopeLevel sectorId subSectorId subSubSectorId")
      .lean();
    if (dbUser) {
      actor = { ...req.user, ...dbUser, _id: dbUser._id, role: dbUser.role };
    }

    const allowed = await canInviteToConversation(actor, conv);
    if (!allowed) {
      return res.status(403).json({
        status: false,
        message: "You do not have permission to add people to this conversation",
      });
    }

    const memberIds = Array.isArray(req.body.memberIds)
      ? req.body.memberIds.map(toId).filter(Boolean)
      : [];
    if (!memberIds.length) {
      return res.status(400).json({ status: false, message: "No members to invite" });
    }

    const valid = await Employee.find({
      _id: { $in: memberIds },
      status: { $ne: "terminated" },
    }).select("_id");

    let changed = false;
    const addedIds = [];
    for (const v of valid) {
      const vid = toId(v._id);
      if (!conv.members.some((m) => toId(m) === vid)) {
        conv.members.push(v._id);
        changed = true;
        addedIds.push(vid);
      }
    }

    // Re-join: clear leave opt-out for org/sector channels
    if (
      addedIds.length &&
      ["org", "sector", "sub_sector", "sub_sub_sector"].includes(conv.type)
    ) {
      await Employee.updateMany(
        { _id: { $in: addedIds } },
        { $pull: { chatOptOut: conv._id } }
      );
    }

    if (conv.type === "dm" && conv.members.length > 2) {
      conv.type = "group";
      if (!conv.name) conv.name = "Group chat";
      await Conversation.updateOne({ _id: conv._id }, { $unset: { dmKey: 1 } });
      conv.dmKey = undefined;
      changed = true;
    }

    if (changed) await conv.save();

    const populated = await Conversation.findById(conv._id).populate({
      path: "members",
      select: "name profileImage role",
    });

    const mapped = mapConversation(populated, me);
    const io = getIO();
    if (io) io.to(`chat:${id}`).emit("chat:conversation_updated", mapped);
    for (const mid of memberIds) {
      emitToUser(mid, "chat:conversation", mapConversation(populated, mid));
    }

    res.json({ status: true, data: mapped });
  } catch (err) {
    console.error("inviteMembers", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

export const leaveConversation = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    const { id } = req.params;
    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ status: false, message: "Not found" });

    const isMember = (conv.members || []).some((m) => toId(m) === me);
    if (!isMember) {
      return res.status(400).json({ status: false, message: "You are not a member" });
    }

    if (conv.type === "dm") {
      return res.status(400).json({
        status: false,
        message: "Use Delete chat to remove a DM from your list",
      });
    }

    conv.members = conv.members.filter((m) => toId(m) !== me);
    await conv.save();

    // Remember opt-out so org/sector sync does not auto-rejoin
    if (["sector", "sub_sector", "sub_sub_sector", "org"].includes(conv.type)) {
      await Employee.findByIdAndUpdate(me, {
        $addToSet: { chatOptOut: conv._id },
      });
    }

    const io = getIO();
    if (io) {
      io.to(`chat:${id}`).emit("chat:member_left", {
        conversationId: id,
        userId: me,
      });
    }

    res.json({ status: true, message: "Left conversation" });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/** Hide a DM from the current user's sidebar (does not delete for the other person) */
export const deleteConversation = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    const { id } = req.params;
    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ status: false, message: "Not found" });

    const isMember = (conv.members || []).some((m) => toId(m) === me);
    if (!isMember) {
      return res.status(403).json({ status: false, message: "Access denied" });
    }

    if (conv.type !== "dm") {
      return res.status(400).json({
        status: false,
        message: "Only direct messages can be deleted this way. Use Leave for channels/groups.",
      });
    }

    await Conversation.updateOne(
      { _id: conv._id },
      { $addToSet: { hiddenFor: me } }
    );

    res.json({ status: true, message: "Chat deleted from your list" });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

export const rejoinConversation = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    const { id } = req.params;
    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ status: false, message: "Not found" });

    if (!["sector", "sub_sector", "sub_sub_sector", "org"].includes(conv.type)) {
      return res.status(400).json({
        status: false,
        message: "Only organization channels can be rejoined this way",
      });
    }

    await Employee.findByIdAndUpdate(me, { $pull: { chatOptOut: conv._id } });
    if (!conv.members.some((m) => toId(m) === me)) {
      conv.members.push(me);
      await conv.save();
    }

    const populated = await Conversation.findById(conv._id).populate({
      path: "members",
      select: "name profileImage role",
    });
    res.json({ status: true, data: mapConversation(populated, me) });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

export const listLeftChannels = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    const emp = await Employee.findById(me).select("chatOptOut").lean();
    const ids = emp?.chatOptOut || [];
    if (!ids.length) return res.json({ status: true, data: [] });

    const convs = await Conversation.find({ _id: { $in: ids } })
      .select("name type description lastMessageAt")
      .lean();
    res.json({
      status: true,
      data: convs.map((c) => ({
        id: c._id,
        name: c.name,
        type: c.type,
        description: c.description || "",
        lastMessageAt: c.lastMessageAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

export const listMessages = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    const { id } = req.params;
    const { error, status } = await assertMember(id, me);
    if (error) return res.status(status).json({ status: false, message: error });

    const limit = Math.min(parseInt(req.query.limit || "50", 10), 100);
    const before = req.query.before ? new Date(req.query.before) : null;

    const q = { conversation: id };
    if (before && !Number.isNaN(before.getTime())) q.createdAt = { $lt: before };

    const messages = await Message.find(q)
      .populate({ path: "sender", select: "name profileImage role" })
      .sort({ createdAt: -1 })
      .limit(limit);

    // Mark as read
    await Message.updateMany(
      {
        conversation: id,
        sender: { $ne: me },
        readBy: { $ne: me },
      },
      { $addToSet: { readBy: me } }
    );

    res.json({
      status: true,
      data: messages.reverse().map(mapMessage),
    });
  } catch (err) {
    console.error("listMessages", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

export async function persistAndBroadcastMessage({
  conversationId,
  senderId,
  body,
  attachments = [],
}) {
  const text = String(body || "").trim();
  const files = Array.isArray(attachments) ? attachments.filter((a) => a?.url) : [];
  if (!text && files.length === 0) {
    throw Object.assign(new Error("Message is empty"), { status: 400 });
  }

  const { conv, error, status } = await assertMember(conversationId, senderId);
  if (error) throw Object.assign(new Error(error), { status });

  const msg = await Message.create({
    conversation: conversationId,
    sender: senderId,
    body: text,
    attachments: files,
    readBy: [senderId],
  });

  const preview =
    text.slice(0, 140) ||
    (files[0]?.mimeType?.startsWith("image/")
      ? "📷 Image"
      : `📎 ${files[0]?.name || "Attachment"}`);

  conv.lastMessageAt = msg.createdAt;
  conv.lastMessagePreview = preview;
  conv.lastMessageSender = senderId;
  // New activity brings the chat back for anyone who hid it
  if (Array.isArray(conv.hiddenFor) && conv.hiddenFor.length) {
    conv.hiddenFor = [];
  }
  await conv.save();

  const populated = await Message.findById(msg._id).populate({
    path: "sender",
    select: "name profileImage role",
  });
  const mapped = mapMessage(populated);

  const io = getIO();
  if (io) {
    io.to(`chat:${conversationId}`).emit("chat:message", mapped);
  }

  // Conversation title for notifications
  let channelLabel = conv.name || "Chat";
  if (conv.type === "dm") {
    channelLabel = mapped.sender?.name || "Direct message";
  }

  const recipientIds = (conv.members || [])
    .map(toId)
    .filter((id) => id && id !== toId(senderId));

  for (const id of recipientIds) {
    emitToUser(id, "chat:message_notify", {
      conversationId,
      preview,
      sender: mapped.sender,
      createdAt: mapped.createdAt,
    });

    // Skip bell notification if they are already viewing this thread
    if (isUserInChatRoom(id, conversationId)) continue;

    try {
      const title =
        conv.type === "dm"
          ? `New message from ${mapped.sender?.name || "someone"}`
          : `${mapped.sender?.name || "Someone"} in ${channelLabel}`;
      const note = await Notification.create({
        recipient: id,
        kind: "chat_message",
        title,
        description: preview,
        href: `/chat?c=${conversationId}`,
        meta: {
          conversationId: String(conversationId),
          messageId: String(mapped.id),
          senderId: toId(senderId),
        },
      });
      emitToUser(id, "notify:personal", {
        id: String(note._id),
        kind: "chat_message",
        title,
        description: preview,
        href: `/chat?c=${conversationId}`,
        createdAt: note.createdAt.toISOString(),
      });
    } catch (err) {
      console.error("chat notification failed", id, err?.message || err);
    }
  }

  return mapped;
}

export const sendMessage = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    const { id } = req.params;
    let attachments = [];
    if (typeof req.body.attachments === "string") {
      try {
        attachments = JSON.parse(req.body.attachments);
      } catch {
        attachments = [];
      }
    } else if (Array.isArray(req.body.attachments)) {
      attachments = req.body.attachments;
    }

    // Files uploaded via multipart (Cloudinary URL in file.path)
    if (req.files?.length) {
      attachments = [
        ...attachments,
        ...req.files.map((f) => ({
          url: f.path || f.secure_url || f.url,
          name: f.originalname || f.filename || "file",
          mimeType: f.mimetype || "",
          size: f.size || 0,
          resourceType: (f.mimetype || "").startsWith("image/") ? "image" : "raw",
        })),
      ];
    }

    const mapped = await persistAndBroadcastMessage({
      conversationId: id,
      senderId: me,
      body: req.body.body,
      attachments,
    });
    res.status(201).json({ status: true, data: mapped });
  } catch (err) {
    console.error("sendMessage", err?.message || err);
    res.status(err.status || 500).json({
      status: false,
      message: err.message || "Failed to send message",
    });
  }
};

export const uploadChatFiles = async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ status: false, message: "No files uploaded" });
    }
    const data = files.map((f) => ({
      url: f.path || f.secure_url || f.url,
      name: f.originalname || f.filename || "file",
      mimeType: f.mimetype || "",
      size: f.size || 0,
      resourceType: (f.mimetype || "").startsWith("image/") ? "image" : "raw",
    }));
    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

export const editMessage = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    const { messageId } = req.params;
    const body = String(req.body.body || "").trim();
    if (!body) {
      return res.status(400).json({ status: false, message: "Message text is required" });
    }

    const msg = await Message.findById(messageId);
    if (!msg || msg.deletedAt) {
      return res.status(404).json({ status: false, message: "Message not found" });
    }

    const { conv, error, status } = await assertMember(msg.conversation, me);
    if (error) return res.status(status).json({ status: false, message: error });

    const isOwner = toId(msg.sender) === me;
    // DMs: only the sender may edit. Channels/groups: sender or moderator.
    if (conv.type === "dm") {
      if (!isOwner) {
        return res.status(403).json({
          status: false,
          message: "Only the sender can edit this message",
        });
      }
    } else if (!isOwner && !isChatModerator(req.user)) {
      return res.status(403).json({ status: false, message: "Not allowed to edit" });
    }

    msg.body = body;
    msg.editedAt = new Date();
    await msg.save();

    const populated = await Message.findById(msg._id).populate({
      path: "sender",
      select: "name profileImage role",
    });
    const mapped = mapMessage(populated);
    const io = getIO();
    if (io) io.to(`chat:${msg.conversation}`).emit("chat:message_updated", mapped);

    res.json({ status: true, data: mapped });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    const { messageId } = req.params;
    const reason = String(req.body.reason || "").trim();

    const msg = await Message.findById(messageId);
    if (!msg) {
      return res.status(404).json({ status: false, message: "Message not found" });
    }
    if (msg.deletedAt) {
      return res.json({ status: true, data: mapMessage(msg) });
    }

    const isOwner = toId(msg.sender) === me;
    const moderator = isChatModerator(req.user);
    if (!isOwner && !moderator) {
      return res.status(403).json({ status: false, message: "Not allowed to delete" });
    }

    // Moderators can delete in any conversation; owners must still be members
    if (!moderator) {
      const { error, status } = await assertMember(msg.conversation, me);
      if (error) return res.status(status).json({ status: false, message: error });
    }

    msg.deletedAt = new Date();
    msg.deletedBy = me;
    msg.deleteReason = moderator && !isOwner ? reason || "Removed by moderator" : reason;
    await msg.save();

    const populated = await Message.findById(msg._id).populate({
      path: "sender",
      select: "name profileImage role",
    });
    const mapped = mapMessage(populated);
    const io = getIO();
    if (io) io.to(`chat:${msg.conversation}`).emit("chat:message_updated", mapped);

    res.json({ status: true, data: mapped });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

export const removeMember = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    const { id } = req.params;
    const targetId = toId(req.body.userId);
    if (!targetId) {
      return res.status(400).json({ status: false, message: "userId is required" });
    }

    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ status: false, message: "Not found" });

    const moderator = isChatModerator(req.user);
    const isCreator = toId(conv.createdBy) === me;
    if (!moderator && !(conv.type === "group" && isCreator)) {
      return res.status(403).json({
        status: false,
        message: "Only moderators or the group creator can remove members",
      });
    }

    if (conv.type === "dm") {
      return res.status(400).json({ status: false, message: "Cannot remove from a DM" });
    }

    conv.members = conv.members.filter((m) => toId(m) !== targetId);
    await conv.save();

    if (["sector", "sub_sector", "sub_sub_sector", "org"].includes(conv.type)) {
      await Employee.findByIdAndUpdate(targetId, {
        $addToSet: { chatOptOut: conv._id },
      });
    }

    const populated = await Conversation.findById(conv._id).populate({
      path: "members",
      select: "name profileImage role",
    });
    const mapped = mapConversation(populated, me);
    const io = getIO();
    if (io) {
      io.to(`chat:${id}`).emit("chat:conversation_updated", mapped);
      emitToUser(targetId, "chat:removed", { conversationId: id });
    }

    res.json({ status: true, data: mapped });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

export const getConversation = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    const { id } = req.params;
    const { conv, error, status } = await assertMember(id, me);
    if (error) return res.status(status).json({ status: false, message: error });

    let actor = req.user;
    const dbUser = await Employee.findById(me)
      .select("role scopeLevel sectorId subSectorId subSubSectorId")
      .lean();
    if (dbUser) {
      actor = { ...req.user, ...dbUser, _id: dbUser._id, role: dbUser.role };
    }

    const populated = await Conversation.findById(conv._id)
      .populate({ path: "members", select: "name profileImage role" })
      .populate({ path: "lastMessageSender", select: "name profileImage role" });

    const canRename = await canRenameConversation(actor, conv);
    const canInvite = await canInviteToConversation(actor, conv);

    res.json({
      status: true,
      data: {
        ...mapConversation(populated, me),
        canModerate: isChatModerator(actor),
        canRename,
        canInvite,
      },
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

export const renameConversation = async (req, res) => {
  try {
    const me = toId(req.user?._id || req.user?.id);
    const { id } = req.params;
    const name = String(req.body.name || "").trim();
    const description =
      req.body.description !== undefined
        ? String(req.body.description || "").trim()
        : undefined;

    if (!name || name.length > 80) {
      return res.status(400).json({
        status: false,
        message: "Name is required (max 80 characters)",
      });
    }

    const { conv, error, status } = await assertMember(id, me);
    if (error) return res.status(status).json({ status: false, message: error });

    const allowed = await canRenameConversation(req.user, conv);
    if (!allowed) {
      return res.status(403).json({
        status: false,
        message: "You do not have permission to rename this conversation",
      });
    }

    conv.name = name;
    conv.nameCustomized = true;
    if (description !== undefined) conv.description = description.slice(0, 300);
    await conv.save();

    const populated = await Conversation.findById(conv._id)
      .populate({ path: "members", select: "name profileImage role" })
      .populate({ path: "lastMessageSender", select: "name profileImage role" });

    const mapped = {
      ...mapConversation(populated, me),
      canModerate: isChatModerator(req.user),
      canRename: true,
      canInvite: true,
    };

    const io = getIO();
    if (io) {
      io.to(`chat:${id}`).emit("chat:conversation_updated", mapped);
      for (const mid of conv.members || []) {
        emitToUser(toId(mid), "chat:conversation", mapped);
      }
    }

    res.json({ status: true, data: mapped });
  } catch (err) {
    console.error("renameConversation", err);
    res.status(500).json({ status: false, message: err.message });
  }
};
