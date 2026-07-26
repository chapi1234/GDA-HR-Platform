import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import SectorCascadeFields, { getLeafUnitId } from "../components/org/SectorCascadeFields";
import { Building2, Shield, Users, UserPlus } from "lucide-react";
import { toast } from "react-toastify";
import { getRoleLabel } from "../utils/permissions";

const API_BASE = import.meta.env.VITE_API_URL;

export default function AdminConsole() {
  const { isSuperAdmin, canAccessAdminConsole, canAssignOrgWide } = useAuth();
  const { t } = useLanguage();
  const allowed = canAccessAdminConsole;
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

  const [employees, setEmployees] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "hr",
    scopeLevel: "organization",
    sectorId: "",
    subSectorId: "",
    subSubSectorId: "",
    position: "",
  });

  const stats = useMemo(() => {
    const byRole = {};
    for (const e of employees) {
      byRole[e.role || "employee"] = (byRole[e.role || "employee"] || 0) + 1;
    }
    return {
      total: employees.length,
      byRole,
      orgWide: employees.filter((e) => e.scopeLevel === "organization").length,
    };
  }, [employees]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [empRes, sectorRes] = await Promise.all([
        axios.get(`${API_BASE}/api/employees`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE}/api/sectors/public-list`),
      ]);
      setEmployees(Array.isArray(empRes.data?.data) ? empRes.data.data : []);
      setSectors(Array.isArray(sectorRes.data?.data) ? sectorRes.data.data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, token]);

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error("Name, email, and password are required");
      return;
    }
    const isOrgRole = ["superadmin", "admin", "hr"].includes(form.role);
    const isSectorLead = form.role === "sector_lead";
    const isOrg = isOrgRole || form.scopeLevel === "organization";
    const leafUnitId = getLeafUnitId(form);
    if (isSectorLead && !form.sectorId) {
      toast.error("Select a sector for Sector Lead");
      return;
    }
    if (form.role === "manager" && !form.subSectorId) {
      toast.error("Select a sub-sector for Manager");
      return;
    }
    if (form.role === "unit_manager" && !form.subSubSectorId) {
      toast.error("Select a nested unit for Unit Manager");
      return;
    }
    if (!isOrg && !isSectorLead && !leafUnitId) {
      toast.error("Select a sector assignment or organization-wide scope");
      return;
    }
    try {
      setSaving(true);
      await axios.post(
        `${API_BASE}/api/employees/create`,
        {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          scopeLevel: isSectorLead ? "sector" : isOrg ? "organization" : form.scopeLevel,
          leafUnitId: isOrg || isSectorLead ? undefined : leafUnitId,
          sectorId: isOrg ? undefined : form.sectorId || undefined,
          subSectorId: isOrg || isSectorLead ? undefined : form.subSectorId || undefined,
          subSubSectorId:
            isOrg || isSectorLead ? undefined : form.subSubSectorId || undefined,
          position: form.position || getRoleLabel(form.role),
          status: "active",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Account created");
      setForm({
        name: "",
        email: "",
        password: "",
        role: "hr",
        scopeLevel: "organization",
        sectorId: "",
        subSectorId: "",
        subSubSectorId: "",
        position: "",
      });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("common.error")}</CardTitle>
            <CardDescription>
              {t("pages.adminConsoleDesc")}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            {t("pages.adminConsole")}
          </h1>
          <p className="text-muted-foreground">
            {t("pages.adminConsoleDesc")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/sectors">
              <Building2 className="w-4 h-4 mr-2" />
              {t("pages.sectors")}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/employees">
              <Users className="w-4 h-4 mr-2" />
              {t("pages.employees")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total users (in your scope)</CardDescription>
            <CardTitle className="text-3xl">{loading ? "…" : stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Organization-wide accounts</CardDescription>
            <CardTitle className="text-3xl">{loading ? "…" : stats.orgWide}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>By role</CardDescription>
            <CardContent className="p-0 pt-2 flex flex-wrap gap-2">
              {Object.entries(stats.byRole).map(([role, count]) => (
                <Badge key={role} variant="secondary" className="capitalize">
                  {getRoleLabel(role)}: {count}
                </Badge>
              ))}
              {!loading && !Object.keys(stats.byRole).length && (
                <span className="text-sm text-muted-foreground">No users yet</span>
              )}
            </CardContent>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create privileged account
          </CardTitle>
          <CardDescription>
            Create Org HR / Admin / Manager accounts and assign them to a sector when needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-2xl">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Full name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Temporary password *</Label>
              <Input
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select
                value={form.role}
                onValueChange={(role) => {
                  const next = { ...form, role };
                  if (["superadmin", "admin", "hr"].includes(role)) {
                    next.scopeLevel = "organization";
                    next.sectorId = "";
                    next.subSectorId = "";
                    next.subSubSectorId = "";
                  } else if (role === "sector_lead") {
                    next.scopeLevel = "sector";
                    next.subSectorId = "";
                    next.subSubSectorId = "";
                  } else if (role === "manager") {
                    next.scopeLevel = "sub_sector";
                    next.subSubSectorId = "";
                  } else if (role === "unit_manager") {
                    next.scopeLevel = "sub_sub_sector";
                  }
                  setForm(next);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hr">Org HR</SelectItem>
                  <SelectItem value="admin">Org Admin</SelectItem>
                  <SelectItem value="sector_lead">Sector Lead</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="unit_manager">Unit Manager</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  {isSuperAdmin && (
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SectorCascadeFields
            sectors={sectors}
            unitDepth={
              form.role === "manager"
                ? "sub_sector"
                : form.role === "unit_manager"
                  ? "sub_sub_sector"
                  : null
            }
            showOrgWide={
              canAssignOrgWide && ["superadmin", "admin", "hr"].includes(form.role)
            }
            value={{
              scopeLevel: form.scopeLevel,
              sectorId: form.sectorId,
              subSectorId: form.subSectorId,
              subSubSectorId: form.subSubSectorId,
            }}
            onChange={(org) => {
              if (form.role === "sector_lead") {
                setForm((p) => ({
                  ...p,
                  ...org,
                  scopeLevel: "sector",
                  subSectorId: "",
                  subSubSectorId: "",
                }));
                return;
              }
              if (form.role === "manager") {
                setForm((p) => ({
                  ...p,
                  ...org,
                  scopeLevel: "sub_sector",
                  subSubSectorId: "",
                }));
                return;
              }
              if (form.role === "unit_manager") {
                setForm((p) => ({
                  ...p,
                  ...org,
                  scopeLevel: "sub_sub_sector",
                }));
                return;
              }
              setForm((p) => ({ ...p, ...org }));
            }}
          />

          <div className="space-y-2">
            <Label>Position (optional)</Label>
            <Input
              value={form.position}
              onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
              placeholder="e.g. Business Sector Lead"
            />
          </div>

          <Button className="btn-gradient" onClick={handleCreate} disabled={saving}>
            {saving ? "Creating..." : "Create account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
