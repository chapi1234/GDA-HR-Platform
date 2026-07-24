import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Building2, ChevronRight, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_URL;

function flattenTree(nodes, acc = []) {
  for (const n of nodes || []) {
    acc.push(n);
    if (n.children?.length) flattenTree(n.children, acc);
  }
  return acc;
}

function UnitNode({
  node,
  depth = 0,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
  deletingId,
}) {
  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
        style={{ marginLeft: depth * 16 }}
      >
        {depth > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <Building2 className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{node.name}</p>
          {node.description ? (
            <p className="text-xs text-muted-foreground line-clamp-2">{node.description}</p>
          ) : null}
          {node.pathNames?.length ? (
            <p className="text-xs text-muted-foreground truncate">
              {node.pathNames.join(" › ")}
            </p>
          ) : null}
        </div>
        <Badge variant="secondary" className="shrink-0 capitalize">
          {node.level?.replaceAll("_", " ")}
        </Badge>
        {node.status && node.status !== "active" && (
          <Badge variant="outline" className="shrink-0">
            {node.status}
          </Badge>
        )}
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-0.5 shrink-0">
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit?.(node)}
                aria-label={`Edit ${node.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                disabled={deletingId === node._id}
                onClick={() => onDelete?.(node)}
                aria-label={`Delete ${node.name}`}
              >
                {deletingId === node._id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        )}
      </div>
      {(node.children || []).map((child) => (
        <UnitNode
          key={child._id}
          node={child}
          depth={depth + 1}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={onEdit}
          onDelete={onDelete}
          deletingId={deletingId}
        />
      ))}
    </div>
  );
}

export default function Sectors() {
  const {
    canManage,
    canManageOrgStructure,
    isOrgWide,
    isSectorLead,
    isSuperAdmin,
    isAdmin,
    roleLabel,
  } = useAuth();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingUnit, setEditingUnit] = useState(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    level: "sub_sector",
    parent: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    location: "",
    status: "active",
  });
  const [allUnits, setAllUnits] = useState([]);
  const [sectorFilter, setSectorFilter] = useState("all");

  const flat = useMemo(() => flattenTree(tree), [tree]);
  const canEdit = canManageOrgStructure;
  // Match backend: Super Admin / Org Admin can delete (not Org HR)
  const canDelete = isSuperAdmin || (isAdmin && isOrgWide);
  const seesFullOrg = isSuperAdmin || isOrgWide;

  const unitSource = useMemo(() => {
    if (seesFullOrg && allUnits.length) return allUnits;
    return flat;
  }, [seesFullOrg, allUnits, flat]);

  const topSectors = useMemo(
    () => unitSource.filter((n) => n.level === "sector"),
    [unitSource]
  );

  const parentOptions = useMemo(() => {
    if (form.level === "sector") return [];
    if (form.level === "sub_sector") {
      return topSectors;
    }
    let subs = unitSource.filter((n) => n.level === "sub_sector");
    if (sectorFilter !== "all") {
      subs = subs.filter(
        (n) =>
          String(n.parent) === String(sectorFilter) ||
          (n.ancestors || []).some((a) => String(a) === String(sectorFilter))
      );
    }
    return [...subs].sort((a, b) => {
      const pa = (a.pathNames || [a.name]).join(" › ");
      const pb = (b.pathNames || [b.name]).join(" › ");
      return pa.localeCompare(pb);
    });
  }, [form.level, unitSource, topSectors, sectorFilter]);

  const parentOptionsGrouped = useMemo(() => {
    if (form.level !== "sub_sub_sector") return null;
    const groups = new Map();
    for (const sub of parentOptions) {
      const sectorName =
        (sub.pathNames && sub.pathNames[0]) ||
        topSectors.find((s) => String(s._id) === String(sub.parent))?.name ||
        "Other";
      if (!groups.has(sectorName)) groups.set(sectorName, []);
      groups.get(sectorName).push(sub);
    }
    return [...groups.entries()];
  }, [form.level, parentOptions, topSectors]);

  const loadAllUnits = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/sectors/public-list`);
      setAllUnits(res.data?.data || []);
    } catch {
      // fall back to tree flatten
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const res = await axios.get(`${API_BASE}/api/sectors/tree`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTree(res.data?.data || []);
      setError("");
      if (canEdit) await loadAllUnits();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load sectors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("authToken")}`,
  });

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (form.level !== "sector" && !form.parent) {
      toast.error("Parent unit is required for this level");
      return;
    }
    try {
      setSaving(true);
      await axios.post(
        `${API_BASE}/api/sectors`,
        {
          name: form.name.trim(),
          description: form.description,
          level: form.level,
          parent: form.level === "sector" ? null : form.parent,
        },
        { headers: authHeaders() }
      );
      toast.success("Sector unit created");
      setShowAdd(false);
      setForm({ name: "", description: "", level: "sub_sector", parent: "" });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create unit");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (node) => {
    setEditingUnit(node);
    setEditForm({
      name: node.name || "",
      description: node.description || "",
      location: node.location || "",
      status: node.status || "active",
    });
    setShowEdit(true);
  };

  const handleUpdate = async () => {
    if (!editingUnit?._id) return;
    if (!editForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      setSaving(true);
      await axios.put(
        `${API_BASE}/api/sectors/${editingUnit._id}`,
        {
          name: editForm.name.trim(),
          description: editForm.description,
          location: editForm.location,
          status: editForm.status,
        },
        { headers: authHeaders() }
      );
      toast.success("Sector unit updated");
      setShowEdit(false);
      setEditingUnit(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update unit");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (node) => {
    const childCount = node.children?.length || 0;
    if (childCount > 0) {
      toast.error(
        `Remove ${childCount} child unit${childCount === 1 ? "" : "s"} under "${node.name}" first.`
      );
      return;
    }
    const ok = window.confirm(
      `Delete "${node.name}"?\n\nThis cannot be undone. Employees assigned to this unit may need reassignment.`
    );
    if (!ok) return;

    try {
      setDeletingId(node._id);
      await axios.delete(`${API_BASE}/api/sectors/${node._id}`, {
        headers: authHeaders(),
      });
      toast.success("Sector unit deleted");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete unit");
    } finally {
      setDeletingId(null);
    }
  };

  if (!canManage) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>
              Only managers and above can view the sector structure.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizational Sectors</h1>
          <p className="text-muted-foreground">
            {seesFullOrg
              ? "Full organization structure — all sectors and units."
              : isSectorLead
                ? "Your sector and its sub-sectors / units only."
                : "Units in your assigned area."}
            {roleLabel ? ` (${roleLabel})` : ""}
          </p>
          {canEdit && (
            <p className="text-xs text-muted-foreground mt-1">
              {canDelete
                ? "You can add, edit, and delete units."
                : "You can add and edit units. Delete requires Super Admin or Org Admin."}
            </p>
          )}
        </div>
        {canEdit && (
          <Dialog
            open={showAdd}
            onOpenChange={(open) => {
              setShowAdd(open);
              if (open) {
                loadAllUnits();
                setSectorFilter("all");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="btn-gradient">
                <Plus className="w-4 h-4 mr-2" />
                Add Unit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Sector Unit</DialogTitle>
                <DialogDescription>
                  Create a sector, sub-sector, or nested unit. For sub-sub-sectors,
                  pick any sub-sector from any top sector.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select
                    value={form.level}
                    onValueChange={(level) => {
                      setForm((prev) => ({ ...prev, level, parent: "" }));
                      setSectorFilter("all");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sector">Top sector</SelectItem>
                      <SelectItem value="sub_sector">Sub-sector</SelectItem>
                      <SelectItem value="sub_sub_sector">Sub-sub-sector</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.level === "sub_sub_sector" && topSectors.length > 0 && (
                  <div className="space-y-2">
                    <Label>Filter by sector (optional)</Label>
                    <Select
                      value={sectorFilter}
                      onValueChange={(v) => {
                        setSectorFilter(v);
                        setForm((prev) => ({ ...prev, parent: "" }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All sectors" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All sectors</SelectItem>
                        {topSectors.map((s) => (
                          <SelectItem key={s._id} value={String(s._id)}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {form.level !== "sector" && (
                  <div className="space-y-2">
                    <Label>
                      {form.level === "sub_sector"
                        ? "Parent sector *"
                        : "Parent sub-sector *"}
                    </Label>
                    <Select
                      value={form.parent || undefined}
                      onValueChange={(parent) =>
                        setForm((prev) => ({ ...prev, parent }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            form.level === "sub_sector"
                              ? "Select sector..."
                              : "Select sub-sector..."
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {parentOptions.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            No parents available. Create a sub-sector under the
                            sector first.
                          </div>
                        ) : parentOptionsGrouped ? (
                          parentOptionsGrouped.map(([sectorName, subs]) => (
                            <SelectGroup key={sectorName}>
                              <SelectLabel>{sectorName}</SelectLabel>
                              {subs.map((p) => (
                                <SelectItem key={p._id} value={String(p._id)}>
                                  {(p.pathNames || [p.name]).join(" › ")}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))
                        ) : (
                          parentOptions.map((p) => (
                            <SelectItem key={p._id} value={String(p._id)}>
                              {(p.pathNames || [p.name]).join(" › ")}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g. Water Project"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={saving} className="btn-gradient">
                  {saving ? "Saving..." : "Create"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sector Hierarchy</CardTitle>
          <CardDescription>
            {seesFullOrg
              ? "Complete GammoDA sector tree from the database."
              : "Scoped to your assignment — other sectors are hidden."}
            {canEdit ? " Use the pencil to edit a unit." : ""}
            {canDelete ? " Use the trash to delete empty units." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p>Loading sectors...</p>}
          {error && <p className="text-destructive">{error}</p>}
          {!loading && !error && tree.length === 0 && (
            <p className="text-muted-foreground">
              No sectors found. Run the sector seed script.
            </p>
          )}
          {tree.map((root) => (
            <UnitNode
              key={root._id}
              node={root}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={openEdit}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          ))}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog
        open={showEdit}
        onOpenChange={(open) => {
          setShowEdit(open);
          if (!open) setEditingUnit(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit unit</DialogTitle>
            <DialogDescription>
              {editingUnit?.pathNames?.join(" › ") ||
                editingUnit?.name ||
                "Update this sector unit"}
              {editingUnit?.level
                ? ` · ${editingUnit.level.replaceAll("_", " ")}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={editForm.location}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, location: e.target.value }))
                }
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(status) =>
                  setEditForm((prev) => ({ ...prev, status }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEdit(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className="btn-gradient"
              onClick={handleUpdate}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
