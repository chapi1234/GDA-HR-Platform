import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Plus, Search, Filter, Ban } from "lucide-react";
import { toast } from "react-toastify";
import { useClientPagination } from "../hooks/useClientPagination";
import ListPagination from "../components/ListPagination";
import { Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

function money(v) {
  return `${Number(v || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ETB`;
}

function emptyForm() {
  return {
    employeeId: "",
    amount: "",
    takenDate: new Date().toISOString().split("T")[0],
    reason: "",
    repaymentType: "full",
    installmentMonths: "4",
  };
}

function monthlyPreview(amount, months) {
  const a = Number(amount);
  const m = Math.floor(Number(months));
  if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(m) || m < 2) return null;
  return Math.ceil((a / m) * 100) / 100;
}

export default function SalaryAdvances() {
  const { t } = useLanguage();
  const {
    canViewSalaryAdvances,
    canViewPayrollOps,
    canCreatePayroll,
    canEditPayroll,
    payrollReadOnly,
    isEmployee,
  } = useAuth();

  const canCreateUi = canCreatePayroll && !payrollReadOnly;
  const canMutateUi = (canEditPayroll || canCreatePayroll) && !payrollReadOnly;
  const isSelfView = isEmployee || !canViewPayrollOps;

  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/salary-advances`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { status: filterStatus === "all" ? undefined : filterStatus },
      });
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load advances");
    }
  };

  useEffect(() => {
    if (!token) return;
    load();
    if (canCreateUi) {
      axios
        .get(`${API_URL}/api/employees`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          setEmployees(Array.isArray(res.data?.data) ? res.data.data : []);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterStatus]);

  const filtered = rows.filter((r) => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      String(r.employeeName || "").toLowerCase().includes(q) ||
      String(r.employeeId || "").toLowerCase().includes(q) ||
      String(r.reason || "").toLowerCase().includes(q)
    );
  });

  const paging = useClientPagination(filtered, 10, [
    searchTerm,
    filterStatus,
    rows.length,
  ]);

  const setField = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreate = async () => {
    if (!form.employeeId || !form.amount || !form.takenDate) {
      toast.error("Employee, amount, and date are required");
      return;
    }
    if (form.repaymentType === "installment") {
      const months = Math.floor(Number(form.installmentMonths));
      if (!Number.isFinite(months) || months < 2) {
        toast.error("Installment plan needs at least 2 months");
        return;
      }
    }
    try {
      const payload = {
        employee: form.employeeId,
        amount: Number(form.amount),
        takenDate: form.takenDate,
        reason: form.reason,
        repaymentType: form.repaymentType || "full",
      };
      if (form.repaymentType === "installment") {
        payload.installmentMonths = Math.floor(Number(form.installmentMonths));
      }
      await axios.post(`${API_URL}/api/salary-advances`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(
        form.repaymentType === "installment"
          ? "Installment advance recorded — monthly portion will be deducted on payroll"
          : "Advance recorded — will be deducted on next payroll"
      );
      setForm(emptyForm());
      setShowAdd(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record advance");
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm("Cancel this open advance?")) return;
    try {
      await axios.patch(
        `${API_URL}/api/salary-advances/${id}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Advance cancelled");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Cancel failed");
    }
  };

  const statusBadge = (status) => {
    const map = {
      open: { variant: "secondary", label: "Open" },
      applied: { variant: "outline", label: "On pending payroll" },
      recovered: { variant: "default", label: "Recovered" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };
    const c = map[status] || map.open;
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  if (!canViewSalaryAdvances) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">You do not have access to salary advances.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {isSelfView ? t('nav.myAdvances') : t('pages.advances')}
          </h1>
          <p className="text-muted-foreground">{t('pages.advancesDesc')}</p>
        </div>
        {canCreateUi && (
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button className="btn-gradient">
                <Plus className="w-4 h-4 mr-2" />
                {t('advances.recordAdvance')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Record salary advance</DialogTitle>
                <DialogDescription>
                  Choose full recovery on the next payroll, or spread repayment
                  over several months.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Employee *</Label>
                  <Select
                    value={form.employeeId}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, employeeId: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={String(emp.id)}>
                          {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.amount}
                    onChange={setField("amount")}
                  />
                </div>
                <div>
                  <Label>Repayment type *</Label>
                  <Select
                    value={form.repaymentType}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, repaymentType: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">
                        Full — deduct all on next payroll
                      </SelectItem>
                      <SelectItem value="installment">
                        Installment — split across months
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.repaymentType === "installment" && (
                  <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <div>
                      <Label>Number of months *</Label>
                      <Input
                        type="number"
                        min="2"
                        max="60"
                        value={form.installmentMonths}
                        onChange={setField("installmentMonths")}
                      />
                    </div>
                    {monthlyPreview(form.amount, form.installmentMonths) !=
                      null && (
                      <p className="text-sm text-muted-foreground">
                        About{" "}
                        <span className="font-semibold text-foreground">
                          {money(
                            monthlyPreview(form.amount, form.installmentMonths)
                          )}
                        </span>{" "}
                        deducted each payroll until the balance is cleared.
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <Label>Date taken *</Label>
                  <Input
                    type="date"
                    value={form.takenDate}
                    onChange={setField("takenDate")}
                  />
                </div>
                <div>
                  <Label>Reason</Label>
                  <Input value={form.reason} onChange={setField("reason")} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button className="btn-gradient" onClick={handleCreate}>
                  Save advance
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="applied">On payroll</SelectItem>
              <SelectItem value="recovered">Recovered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="data-table">
        <CardHeader>
          <CardTitle className="text-base">Advance register</CardTitle>
          {paging.rangeLabel && (
            <CardDescription>{paging.rangeLabel}</CardDescription>
          )}
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Taken</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              {canMutateUi && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paging.pagedItems.map((row) => (
              <TableRow key={row.id || row._id}>
                <TableCell>
                  <p className="font-medium">{row.employeeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.employeeId || ""}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="font-semibold">{money(row.amount)}</p>
                  {row.remainingAmount != null &&
                    Number(row.remainingAmount) !== Number(row.amount) && (
                      <p className="text-xs text-muted-foreground">
                        Remaining {money(row.remainingAmount)}
                      </p>
                    )}
                </TableCell>
                <TableCell className="text-sm">
                  {row.repaymentType === "installment" ? (
                    <div>
                      <p>
                        {row.installmentMonths} mo ·{" "}
                        {money(row.monthlyInstallment)}/mo
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Paid {Number(row.installmentsPaid || 0)}/
                        {Number(row.installmentMonths || 0)}
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Full (next payroll)</span>
                  )}
                </TableCell>
                <TableCell>
                  {row.takenDate
                    ? new Date(row.takenDate).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {row.reason || "—"}
                </TableCell>
                <TableCell>{statusBadge(row.status)}</TableCell>
                {canMutateUi && (
                  <TableCell>
                    {row.status === "open" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleCancel(row.id || row._id)}
                      >
                        <Ban className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                    {payrollReadOnly && (
                      <span className="text-xs text-muted-foreground">View only</span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {paging.showControls && (
          <div className="p-4 pt-0">
            <ListPagination
              page={paging.page}
              totalPages={paging.totalPages}
              hasPrev={paging.hasPrev}
              hasNext={paging.hasNext}
              rangeLabel={paging.rangeLabel}
              onPrev={() => paging.setPage((p) => Math.max(1, p - 1))}
              onNext={() =>
                paging.setPage((p) => Math.min(paging.totalPages, p + 1))
              }
            />
          </div>
        )}
      </Card>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No salary advances found
        </p>
      )}
    </div>
  );
}
