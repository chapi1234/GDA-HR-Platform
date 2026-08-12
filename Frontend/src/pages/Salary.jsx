import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
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
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Search,
  Plus,
  Filter,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  TrendingUp,
  Check,
  X,
  Download,
} from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useClientPagination } from "../hooks/useClientPagination";
import ListPagination from "../components/ListPagination";
import { Link } from "react-router-dom";
import { computeEthiopiaPaye } from "../utils/incomeTaxEt";
import { exportGadaPayrollSheet } from "../utils/exportGadaPayroll";
import { exportBankPayrollExcel } from "../utils/exportBankPayroll";

const API_URL = import.meta.env.VITE_API_URL;

function n(value) {
  const x = Number(value);
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
}

/** Mirror of backend GaDA sheet math for live form preview */
function computeSheet(form) {
  const basicSalary = n(form.basicSalary);
  const houseAllowance = n(form.houseAllowance);
  const telephone = n(form.telephone);
  const transportAllowance = n(form.transportAllowance);
  const pensionGada =
    form.pensionGada === "" || form.pensionGada == null
      ? n(basicSalary * 0.11)
      : n(form.pensionGada);
  const pensionEmployee =
    form.pensionEmployee === "" || form.pensionEmployee == null
      ? n(basicSalary * 0.11)
      : n(form.pensionEmployee);
  const grossSalary = n(
    basicSalary + houseAllowance + telephone + transportAllowance
  );
  const incomeTax =
    form.incomeTax === "" || form.incomeTax == null
      ? computeEthiopiaPaye(Math.max(0, grossSalary - pensionEmployee))
      : n(form.incomeTax);
  const membershipFee = n(form.membershipFee);
  const salaryAdvance = n(form.salaryAdvance);
  const other = n(form.other);
  const totalDeduction = n(
    pensionEmployee + incomeTax + membershipFee + salaryAdvance + other
  );
  const netSalary = n(grossSalary - totalDeduction);
  return {
    basicSalary,
    houseAllowance,
    telephone,
    transportAllowance,
    pensionGada,
    pensionEmployee,
    grossSalary,
    incomeTax,
    membershipFee,
    salaryAdvance,
    other,
    totalDeduction,
    netSalary,
  };
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyForm() {
  return {
    employeeId: "",
    basicSalary: "",
    houseAllowance: "",
    telephone: "",
    transportAllowance: "",
    pensionGada: "",
    pensionEmployee: "",
    incomeTax: "",
    membershipFee: "",
    salaryAdvance: "",
    other: "",
    payDate: todayYmd(),
    notes: "",
    advanceIds: [],
  };
}

function normalizeAdvanceIds(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((a) => String(a?._id || a?.id || a))
    .filter((id) => /^[0-9a-fA-F]{24}$/.test(id));
}

/** This-payroll deduction: monthly slice for installments, else full remaining. */
function suggestedAdvanceDeduction(adv) {
  if (adv?.suggestedDeduction != null && Number(adv.suggestedDeduction) >= 0) {
    return n(adv.suggestedDeduction);
  }
  const remaining = n(adv?.remainingAmount ?? adv?.amount ?? 0);
  if (adv?.repaymentType === "installment") {
    const monthly = n(adv?.monthlyInstallment || 0);
    if (monthly > 0) return Math.min(remaining, monthly);
  }
  return remaining;
}

function buildAdvanceAmountsMap(openAdvances, advanceIds) {
  const selected = new Set((advanceIds || []).map(String));
  const map = {};
  for (const adv of openAdvances || []) {
    const id = String(adv.id || adv._id);
    if (!selected.has(id)) continue;
    map[id] = suggestedAdvanceDeduction(adv);
  }
  return map;
}

function mapPayroll(p) {
  return {
    id: p._id || p.id,
    employee: p.employee?._id || p.employee || null,
    employeeId: p.employeeId,
    employeeName: p.employeeName || p.employee?.name || "Unknown",
    department: p.department || "",
    position: p.position || "",
    basicSalary: p.basicSalary ?? p.baseSalary ?? 0,
    houseAllowance: p.houseAllowance ?? 0,
    telephone: p.telephone ?? 0,
    transportAllowance: p.transportAllowance ?? 0,
    pensionGada: p.pensionGada ?? 0,
    pensionEmployee: p.pensionEmployee ?? 0,
    grossSalary: p.grossSalary ?? 0,
    incomeTax: p.incomeTax ?? 0,
    membershipFee: p.membershipFee ?? 0,
    salaryAdvance: p.salaryAdvance ?? 0,
    other: p.other ?? 0,
    totalDeduction: p.totalDeduction ?? p.deductions ?? 0,
    netSalary: p.netSalary ?? 0,
    payDate: p.payDate ? String(p.payDate).slice(0, 10) : "",
    status: p.status || "pending",
    preparedByName: p.preparedBy?.name || null,
    approvedByName: p.approvedBy?.name || null,
    notes: p.notes || "",
    advanceIds: normalizeAdvanceIds(p.advanceIds),
    rejectionReason: p.rejectionReason || "",
    paymentReference: p.paymentReference || "",
    paidAt: p.paidAt || null,
    payrollMonth: p.payrollMonth || null,
  };
}

function money(v) {
  return `${Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ETB`;
}

function SheetFields({
  form,
  setForm,
  computed,
  openAdvances = [],
  advancesLoading = false,
}) {
  const setField = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selected = new Set(form.advanceIds || []);
  const fromRegister = selected.size > 0;

  const toggleAdvance = (id) => {
    setForm((prev) => {
      const current = new Set(prev.advanceIds || []);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      const ids = Array.from(current);
      const total = openAdvances
        .filter((a) => ids.includes(String(a.id || a._id)))
        .reduce((s, a) => s + suggestedAdvanceDeduction(a), 0);
      return {
        ...prev,
        advanceIds: ids,
        salaryAdvance: ids.length ? String(n(total)) : "",
      };
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Basic Salary *</Label>
          <Input
            type="number"
            value={form.basicSalary}
            onChange={setField("basicSalary")}
          />
        </div>
        <div>
          <Label>House allowance</Label>
          <Input
            type="number"
            value={form.houseAllowance}
            onChange={setField("houseAllowance")}
          />
        </div>
        <div>
          <Label>Telephone</Label>
          <Input
            type="number"
            value={form.telephone}
            onChange={setField("telephone")}
          />
        </div>
        <div>
          <Label>Transport allowance</Label>
          <Input
            type="number"
            value={form.transportAllowance}
            onChange={setField("transportAllowance")}
          />
        </div>
        <div>
          <Label>Pension GaDA 11% (auto if blank)</Label>
          <Input
            type="number"
            value={form.pensionGada}
            placeholder={String(computed.pensionGada)}
            onChange={setField("pensionGada")}
          />
        </div>
        <div>
          <Label>Pension 11% (auto if blank)</Label>
          <Input
            type="number"
            value={form.pensionEmployee}
            placeholder={String(computed.pensionEmployee)}
            onChange={setField("pensionEmployee")}
          />
        </div>
        <div>
          <Label>Income tax (PAYE on Gross − pension, auto if blank)</Label>
          <Input
            type="number"
            value={form.incomeTax}
            placeholder={String(computed.incomeTax)}
            onChange={setField("incomeTax")}
          />
        </div>
        <div>
          <Label>Membership fee</Label>
          <Input
            type="number"
            value={form.membershipFee}
            onChange={setField("membershipFee")}
          />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Salary advance (from register)</Label>
            <Link
              to="/salary-advances"
              className="text-xs text-primary underline"
            >
              Manage advances
            </Link>
          </div>
          {advancesLoading ? (
            <p className="text-xs text-muted-foreground">Loading advances…</p>
          ) : !form.employeeId ? (
            <p className="text-xs text-muted-foreground">
              Select an employee to see open advances.
            </p>
          ) : openAdvances.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No open advances for this employee. Record one on the Advances
              page, or enter a one-off amount below.
            </p>
          ) : (
            <div className="rounded-md border divide-y max-h-40 overflow-y-auto">
              {openAdvances.map((adv) => {
                const id = String(adv.id || adv._id);
                const checked = selected.has(id);
                return (
                  <label
                    key={id}
                    className="flex items-start gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={() => toggleAdvance(id)}
                    />
                    <span className="flex-1">
                      <span className="font-medium">
                        {money(suggestedAdvanceDeduction(adv))}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        this payroll
                        {adv.repaymentType === "installment"
                          ? ` · installment ${money(adv.monthlyInstallment)}/mo of ${money(adv.amount)} (${adv.installmentMonths} mo)`
                          : ` · of ${money(adv.amount)} (full)`}
                        {adv.takenDate
                          ? ` — ${new Date(adv.takenDate).toLocaleDateString()}`
                          : ""}
                        {adv.reason ? ` · ${adv.reason}` : ""}
                        {adv.remainingAmount != null &&
                        Number(adv.remainingAmount) !== Number(adv.amount)
                          ? ` · remaining ${money(adv.remainingAmount)}`
                          : ""}
                        {adv.status === "applied" ? " (on this payroll)" : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <Input
            type="number"
            value={form.salaryAdvance}
            onChange={setField("salaryAdvance")}
            readOnly={fromRegister}
            title={
              fromRegister
                ? "Filled from selected advances"
                : "Manual one-off advance (prefer recording on Advances page)"
            }
            placeholder={fromRegister ? "From selected advances" : "0"}
          />
          {fromRegister && (
            <p className="text-xs text-muted-foreground">
              Amount is locked to the selected advance(s).
            </p>
          )}
        </div>
        <div>
          <Label>Other</Label>
          <Input
            type="number"
            value={form.other}
            onChange={setField("other")}
          />
        </div>
        <div>
          <Label>Pay date *</Label>
          <Input
            type="date"
            value={form.payDate}
            onChange={setField("payDate")}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Defaults to today — change if the pay date is different.
          </p>
        </div>
        <div>
          <Label>Notes</Label>
          <Input
            value={form.notes || ""}
            onChange={setField("notes")}
          />
        </div>
      </div>
      <div className="rounded-lg border p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm bg-muted/30">
        <div>
          <p className="text-muted-foreground">Gross Salary</p>
          <p className="font-semibold">{money(computed.grossSalary)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total deduction</p>
          <p className="font-semibold">{money(computed.totalDeduction)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Net</p>
          <p className="font-semibold text-primary">{money(computed.netSalary)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">GaDA pension (report)</p>
          <p className="font-semibold">{money(computed.pensionGada)}</p>
        </div>
      </div>
    </div>
  );
}

const Salary = () => {
  const { t } = useLanguage();
  const marginStyle = { marginBottom: "10px" };
  const button = { width: "220px" };

  const {
    user,
    canViewPayrollOps,
    canCreatePayroll,
    canEditPayroll,
    canDeletePayroll,
    canApprovePayroll,
    payrollReadOnly,
  } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [salaries, setSalaries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [newSalary, setNewSalary] = useState(emptyForm);
  const [editingSalary, setEditingSalary] = useState(null);
  const [openAdvances, setOpenAdvances] = useState([]);
  const [advancesLoading, setAdvancesLoading] = useState(false);
  const [editOpenAdvances, setEditOpenAdvances] = useState([]);
  const [editAdvancesLoading, setEditAdvancesLoading] = useState(false);
  const [monthLocked, setMonthLocked] = useState(false);

  const isOpsView = canViewPayrollOps;
  const canMutateUi = canEditPayroll && !payrollReadOnly && !monthLocked;
  const canDeleteUi = canDeletePayroll && !payrollReadOnly && !monthLocked;
  const canCreateUi = canCreatePayroll && !payrollReadOnly && !monthLocked;
  const canApproveUi = canApprovePayroll && !monthLocked;

  const preview = useMemo(() => computeSheet(newSalary), [newSalary]);
  const editPreview = useMemo(
    () => (editingSalary ? computeSheet(editingSalary) : null),
    [editingSalary]
  );

  const loadOpenAdvances = async (
    employeeMongoId,
    { payrollId, setList, setLoading } = {}
  ) => {
    if (!employeeMongoId || !/^[0-9a-fA-F]{24}$/.test(String(employeeMongoId))) {
      setList([]);
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await axios.get(
        `${API_URL}/api/salary-advances/open/${employeeMongoId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: payrollId ? { payrollId } : undefined,
        }
      );
      setList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error(err);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!showAddDialog || !newSalary.employeeId) {
      setOpenAdvances([]);
      return;
    }
    (async () => {
      await loadOpenAdvances(newSalary.employeeId, {
        setList: setOpenAdvances,
        setLoading: setAdvancesLoading,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddDialog, newSalary.employeeId]);

  // Default-select all open advances when they load for a new payroll
  useEffect(() => {
    if (!showAddDialog || !openAdvances.length) return;
    setNewSalary((prev) => {
      if ((prev.advanceIds || []).length) return prev;
      const ids = openAdvances.map((a) => String(a.id || a._id));
      const total = openAdvances.reduce(
        (s, a) => s + suggestedAdvanceDeduction(a),
        0
      );
      return {
        ...prev,
        advanceIds: ids,
        salaryAdvance: String(total),
      };
    });
  }, [openAdvances, showAddDialog]);

  useEffect(() => {
    if (!editingSalary?.employee) {
      setEditOpenAdvances([]);
      return;
    }
    loadOpenAdvances(editingSalary.employee, {
      payrollId: editingSalary.id,
      setList: setEditOpenAdvances,
      setLoading: setEditAdvancesLoading,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSalary?.id, editingSalary?.employee]);

  const fetchPayrolls = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await axios.get(`${API_URL}/api/payroll/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.data) setSalaries(res.data.data.map(mapPayroll));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load payrolls");
    }
  };

  useEffect(() => {
    fetchPayrolls();
    if (!isOpsView) return;
    (async () => {
      try {
        const token = localStorage.getItem("authToken");
        const res = await axios.get(`${API_URL}/api/employees`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.data) setEmployees(res.data.data);
      } catch (err) {
        console.error("Failed to fetch employees", err);
      }
    })();
  }, [isOpsView]);

  const payDateMonthKey = (payDate) => {
    if (!payDate) return null;
    const raw = String(payDate).trim();
    const match = raw.match(/^(\d{4})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}`;
    const pd = new Date(payDate);
    if (Number.isNaN(pd.getTime())) return null;
    return `${pd.getUTCFullYear()}-${String(pd.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  const salaryMonthKey = (salary) =>
    salary?.payrollMonth || payDateMonthKey(salary?.payDate);

  const selectedMonthLabel = (() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    if (!y || !m) return selectedMonth;
    return new Date(y, m - 1, 1).toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    });
  })();

  const filteredSalaries = salaries.filter((salary) => {
    const matchesMonth = salaryMonthKey(salary) === selectedMonth;
    if (!matchesMonth) return false;
    if (!isOpsView) return true;
    const q = searchTerm.toLowerCase();
    const name = String(salary.employeeName || "").toLowerCase();
    const empId = String(salary.employeeId || "").toLowerCase();
    const matchesSearch = !q || name.includes(q) || empId.includes(q);
    const matchesStatus =
      filterStatus === "all" || salary.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const salaryPaging = useClientPagination(filteredSalaries, 10, [
    searchTerm,
    filterStatus,
    selectedMonth,
    salaries.length,
  ]);

  const buildPayload = (form, openAdvancesList = []) => {
    const c = computeSheet(form);
    const advanceIds = normalizeAdvanceIds(form.advanceIds);
    const advanceAmounts = buildAdvanceAmountsMap(openAdvancesList, advanceIds);
    return {
      employee: form.employeeId || undefined,
      basicSalary: c.basicSalary,
      houseAllowance: c.houseAllowance,
      telephone: c.telephone,
      transportAllowance: c.transportAllowance,
      pensionGada: c.pensionGada,
      pensionEmployee: c.pensionEmployee,
      incomeTax: c.incomeTax,
      membershipFee: c.membershipFee,
      salaryAdvance: c.salaryAdvance,
      other: c.other,
      payDate: form.payDate,
      notes: form.notes || "",
      advanceIds,
      advanceAmounts,
    };
  };

  const handleAddSalary = async () => {
    if (!newSalary.employeeId || !newSalary.basicSalary) {
      toast.error("Employee and Basic Salary are required");
      return;
    }
    try {
      const token = localStorage.getItem("authToken");
      const res = await axios.post(
        `${API_URL}/api/payroll`,
        buildPayload(newSalary, openAdvances),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.data) {
        const mapped = mapPayroll(res.data.data);
        setSalaries((prev) => [mapped, ...prev.filter((s) => s.id !== mapped.id)]);
        // Jump month filter to the payroll's month so the new row is visible
        const month = salaryMonthKey(mapped);
        if (month) setSelectedMonth(month);
        setNewSalary(emptyForm());
        setShowAddDialog(false);
        toast.success(
          month
            ? `Payroll created for ${month} — pending Org HR approval`
            : "Payroll created — pending Org HR approval"
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Error creating payroll");
    }
  };

  const handleUpdateSalary = async () => {
    if (!editingSalary?.basicSalary) {
      toast.error("Basic Salary is required");
      return;
    }
    try {
      const token = localStorage.getItem("authToken");
      const res = await axios.patch(
        `${API_URL}/api/payroll/${editingSalary.id}`,
        buildPayload(editingSalary, editOpenAdvances),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.data) {
        const updated = mapPayroll(res.data.data);
        setSalaries(salaries.map((s) => (s.id === updated.id ? updated : s)));
        setEditingSalary(null);
        toast.success("Payroll updated");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Error updating payroll");
    }
  };

  const handleDeleteSalary = async (id) => {
    if (!window.confirm("Delete this pending payroll record?")) return;
    try {
      const token = localStorage.getItem("authToken");
      const res = await axios.delete(`${API_URL}/api/payroll/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.status) {
        setSalaries(salaries.filter((s) => s.id !== id));
        toast.success("Payroll deleted");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Error deleting payroll");
    }
  };

  const handleApprove = async (id) => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await axios.patch(
        `${API_URL}/api/payroll/${id}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.data) {
        const updated = mapPayroll(res.data.data);
        setSalaries(salaries.map((s) => (s.id === updated.id ? updated : s)));
        toast.success("Payroll approved");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Approve failed");
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt("Rejection reason (optional)") || "";
    try {
      const token = localStorage.getItem("authToken");
      const res = await axios.patch(
        `${API_URL}/api/payroll/${id}/reject`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.data) {
        const updated = mapPayroll(res.data.data);
        setSalaries(salaries.map((s) => (s.id === updated.id ? updated : s)));
        toast.success("Payroll rejected");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Reject failed");
    }
  };

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("authToken")}`,
  });

  const handleMarkPaid = async (id) => {
    const paymentReference =
      window.prompt("Payment reference (cheque / transfer ref)") || "";
    try {
      const res = await axios.patch(
        `${API_URL}/api/payroll/${id}/paid`,
        { paymentReference },
        { headers: authHeaders() }
      );
      if (res.data?.data) {
        setSalaries((prev) =>
          prev.map((s) =>
            s.id === id ? mapPayroll({ ...s, ...res.data.data, _id: id }) : s
          )
        );
        toast.success("Marked as paid");
        fetchPayrolls();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Mark paid failed");
    }
  };

  const handleBulkApprove = async () => {
    const ids = filteredSalaries
      .filter((s) => s.status === "pending")
      .map((s) => s.id);
    if (!ids.length) {
      toast.info("No pending rows in this month");
      return;
    }
    if (!window.confirm(`Approve ${ids.length} pending payroll(s)?`)) return;
    try {
      const res = await axios.post(
        `${API_URL}/api/payroll/bulk-approve`,
        { ids },
        { headers: authHeaders() }
      );
      toast.success(
        `Approved ${res.data?.data?.ok?.length || 0}; failed ${
          res.data?.data?.failed?.length || 0
        }`
      );
      fetchPayrolls();
    } catch (err) {
      toast.error(err.response?.data?.message || "Bulk approve failed");
    }
  };

  useEffect(() => {
    if (!selectedMonth) return;
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/payroll/month-lock`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          params: { payrollMonth: selectedMonth },
        });
        setMonthLocked(!!res.data?.data?.locked);
      } catch {
        setMonthLocked(false);
      }
    })();
  }, [selectedMonth]);

  const handleLockMonth = async () => {
    try {
      await axios.post(
        `${API_URL}/api/payroll/lock-month`,
        { payrollMonth: selectedMonth },
        { headers: authHeaders() }
      );
      setMonthLocked(true);
      toast.success("Month locked");
    } catch (err) {
      toast.error(err.response?.data?.message || "Lock failed");
    }
  };

  const handleUnlockMonth = async () => {
    try {
      await axios.post(
        `${API_URL}/api/payroll/unlock-month`,
        { payrollMonth: selectedMonth },
        { headers: authHeaders() }
      );
      setMonthLocked(false);
      toast.success("Month unlocked");
    } catch (err) {
      toast.error(err.response?.data?.message || "Unlock failed");
    }
  };

  const handleBankExport = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/payroll/bank-export`, {
        headers: authHeaders(),
        params: { payrollMonth: selectedMonth },
      });
      const rows = Array.isArray(res.data?.data) ? res.data.data : [];
      if (!rows.length) {
        toast.info("No approved/paid payroll for this month to export");
        return;
      }
      exportBankPayrollExcel(rows, selectedMonthLabel);
      toast.success("Bank transfer Excel downloaded");
    } catch (err) {
      toast.error(err.response?.data?.message || "Bank export failed");
    }
  };

  const handleSendReminders = async () => {
    try {
      const res = await axios.post(
        `${API_URL}/api/payroll/reminders`,
        { payrollMonth: selectedMonth },
        { headers: authHeaders() }
      );
      toast.success(res.data?.message || "Reminders sent");
    } catch (err) {
      toast.error(err.response?.data?.message || "Reminders failed");
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      paid: { variant: "default", label: "Paid" },
      approved: { variant: "default", label: "Approved" },
      pending: { variant: "secondary", label: "Pending approval" },
      rejected: { variant: "destructive", label: "Rejected" },
      overdue: { variant: "destructive", label: "Overdue" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const now = new Date();
  const monthSalaries = filteredSalaries;
  /** Money that counts toward the month: approved or paid (not pending/rejected) */
  const countableSalaries = monthSalaries.filter((s) =>
    ["approved", "paid"].includes(s.status)
  );
  const totalPayroll = countableSalaries.reduce(
    (sum, s) => sum + Number(s.netSalary || 0),
    0
  );
  const avgSalary =
    totalPayroll / (countableSalaries.length || 1) || 0;
  const pendingSalaries = monthSalaries.filter((s) => s.status === "pending");
  const pendingTotal = pendingSalaries.reduce(
    (sum, s) => sum + Number(s.netSalary || 0),
    0
  );
  const pendingPayments = pendingSalaries.length;

  const salaryTrends = (() => {
    const map = new Map();
    for (const s of salaries) {
      if (!["approved", "paid"].includes(s.status)) continue;
      const pd = s.payDate ? new Date(s.payDate) : null;
      if (!pd || Number.isNaN(pd.getTime())) continue;
      const key = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, "0")}`;
      const label =
        pd.toLocaleString("default", { month: "short" }) +
        " " +
        pd.getFullYear();
      const existing = map.get(key) || {
        total: 0,
        count: 0,
        label,
      };
      existing.total += Number(s.netSalary || 0);
      existing.count += 1;
      map.set(key, existing);
    }
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label =
        d.toLocaleString("default", { month: "short" }) +
        " " +
        d.getFullYear();
      const existing = map.get(key) || { total: 0, count: 0, label };
      months.push(existing);
    }
    return months.map((item) => ({ month: item.label, total: item.total }));
  })();

  const openAddDialog = (open) => {
    setShowAddDialog(open);
    if (open) {
      // Default pay date to today; user can still pick another date
      setNewSalary({ ...emptyForm(), payDate: todayYmd() });
    }
  };

  const openEdit = (salary) => {
    setEditingSalary({
      ...salary,
      employeeId: salary.employee ? String(salary.employee) : "",
      basicSalary: String(salary.basicSalary ?? ""),
      houseAllowance: String(salary.houseAllowance ?? ""),
      telephone: String(salary.telephone ?? ""),
      transportAllowance: String(salary.transportAllowance ?? ""),
      pensionGada: String(salary.pensionGada ?? ""),
      pensionEmployee: String(salary.pensionEmployee ?? ""),
      incomeTax: String(salary.incomeTax ?? ""),
      membershipFee: String(salary.membershipFee ?? ""),
      salaryAdvance: String(salary.salaryAdvance ?? ""),
      other: String(salary.other ?? ""),
      notes: salary.notes || "",
      advanceIds: normalizeAdvanceIds(salary.advanceIds),
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isOpsView ? t('pages.salary') : t('pages.mySalary')}
          </h1>
          <p className="text-muted-foreground">
            {isOpsView ? t('pages.salaryDesc') : t('pages.mySalaryDesc')}
            {isOpsView && (
              <>
                {" · "}
                <Link to="/salary-advances" className="text-primary underline">
                  Salary advances
                </Link>
              </>
            )}
          </p>
        </div>
        {canCreateUi && (
          <Dialog open={showAddDialog} onOpenChange={openAddDialog}>
            <DialogTrigger asChild>
              <Button className="btn-gradient" style={{ ...marginStyle, ...button }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Payroll Record
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl" style={{ maxHeight: "90vh", overflowY: "auto" }}>
              <DialogHeader>
                <DialogTitle>GaDA Payroll Sheet Entry</DialogTitle>
                <DialogDescription>
                  {user?.role === "manager"
                    ? "Create a payroll row for an employee in your sub-sector (pending Org HR approval)."
                    : "Create an organization-wide payroll row (pending your approval workflow)."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Employee *</Label>
                  <Select
                    value={newSalary.employeeId}
                    onValueChange={(val) =>
                      setNewSalary((prev) => ({
                        ...prev,
                        employeeId: val,
                        advanceIds: [],
                        salaryAdvance: "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={String(emp.id)}>
                          {emp.name} — {emp.employeeId || emp.unitPath || ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <SheetFields
                  form={newSalary}
                  setForm={setNewSalary}
                  computed={preview}
                  openAdvances={openAdvances}
                  advancesLoading={advancesLoading}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddSalary} className="btn-gradient">
                  Submit for approval
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card style={marginStyle} className="dashboard-card">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="payroll-month">Payroll month</Label>
              <Input
                id="payroll-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-[200px]"
              />
            </div>
            <p className="text-sm text-muted-foreground pb-2">
              Showing records for <span className="font-medium text-foreground">{selectedMonthLabel}</span> only
            </p>
            <Button
              type="button"
              variant="outline"
              className="mb-0.5"
              disabled={filteredSalaries.length === 0}
              onClick={() => {
                try {
                  exportGadaPayrollSheet(filteredSalaries, selectedMonthLabel);
                  toast.success("GaDA payroll sheet exported");
                } catch (err) {
                  console.error(err);
                  toast.error("Export failed");
                }
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
            {canApprovePayroll && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="mb-0.5"
                  onClick={handleBulkApprove}
                  disabled={monthLocked}
                >
                  Bulk approve
                </Button>
                <Button type="button" variant="outline" className="mb-0.5" onClick={handleBankExport}>
                  Bank Excel
                </Button>
                <Button type="button" variant="outline" className="mb-0.5" onClick={handleSendReminders}>
                  Remind managers
                </Button>
                {monthLocked ? (
                  <Button type="button" variant="secondary" className="mb-0.5" onClick={handleUnlockMonth}>
                    Unlock month
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" className="mb-0.5" onClick={handleLockMonth}>
                    Lock month
                  </Button>
                )}
              </>
            )}
            {monthLocked && (
              <Badge variant="destructive" className="mb-1">Month locked</Badge>
            )}
            {isOpsView && (
              <>
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[200px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div style={marginStyle} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Net payroll ({selectedMonthLabel})
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(totalPayroll)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Approved / paid only
            </p>
          </CardContent>
        </Card>
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending total
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">
              {money(pendingTotal)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingPayments} record{pendingPayments === 1 ? "" : "s"} awaiting Org HR
            </p>
          </CardContent>
        </Card>
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average net</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(Math.round(avgSalary))}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From approved / paid
            </p>
          </CardContent>
        </Card>
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending count</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPayments}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Rows not yet approved
            </p>
          </CardContent>
        </Card>
      </div>

      {isOpsView && (
        <Card style={marginStyle} className="dashboard-card">
          <CardHeader>
            <CardTitle>Payroll trends</CardTitle>
            <CardDescription>Monthly net totals</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={salaryTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="data-table overflow-x-auto">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Gamo Development Association — Salary Payment Payroll Sheet
          </CardTitle>
          <CardDescription>
            {selectedMonthLabel}
            {salaryPaging.rangeLabel ? ` · ${salaryPaging.rangeLabel}` : ""}
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Basic</TableHead>
              <TableHead>House</TableHead>
              <TableHead>Tel</TableHead>
              <TableHead>Transport</TableHead>
              <TableHead>GaDA 11%</TableHead>
              <TableHead>Pension 11%</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Tax</TableHead>
              <TableHead>Membership</TableHead>
              <TableHead>Advance</TableHead>
              <TableHead>Other</TableHead>
              <TableHead>Total ded.</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Status</TableHead>
              {isOpsView && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {salaryPaging.pagedItems.map((salary, idx) => (
              <TableRow key={salary.id}>
                <TableCell>
                  {salaryPaging.pageStart + idx + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <Avatar className="w-7 h-7">
                      <AvatarFallback>
                        {String(salary.employeeName || "")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{salary.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {salary.payDate}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{money(salary.basicSalary)}</TableCell>
                <TableCell>{money(salary.houseAllowance)}</TableCell>
                <TableCell>{money(salary.telephone)}</TableCell>
                <TableCell>{money(salary.transportAllowance)}</TableCell>
                <TableCell>{money(salary.pensionGada)}</TableCell>
                <TableCell>{money(salary.pensionEmployee)}</TableCell>
                <TableCell className="font-medium">
                  {money(salary.grossSalary)}
                </TableCell>
                <TableCell>{money(salary.incomeTax)}</TableCell>
                <TableCell>{money(salary.membershipFee)}</TableCell>
                <TableCell>{money(salary.salaryAdvance)}</TableCell>
                <TableCell>{money(salary.other)}</TableCell>
                <TableCell>{money(salary.totalDeduction)}</TableCell>
                <TableCell className="font-semibold text-primary">
                  {money(salary.netSalary)}
                </TableCell>
                <TableCell>
                  <div>
                    {getStatusBadge(salary.status)}
                    {salary.status === "rejected" && salary.rejectionReason && (
                      <p className="text-[11px] text-destructive mt-1 max-w-[140px]">
                        {salary.rejectionReason}
                      </p>
                    )}
                    {salary.status === "paid" && salary.paymentReference && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Ref: {salary.paymentReference}
                      </p>
                    )}
                  </div>
                </TableCell>
                {isOpsView && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {canApproveUi && salary.status === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Approve"
                            onClick={() => handleApprove(salary.id)}
                          >
                            <Check className="w-4 h-4 text-success" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Reject"
                            onClick={() => handleReject(salary.id)}
                          >
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {canApproveUi && salary.status === "approved" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Mark as paid"
                          onClick={() => handleMarkPaid(salary.id)}
                        >
                          <DollarSign className="w-4 h-4 text-primary" />
                        </Button>
                      )}
                      {canMutateUi && salary.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(salary)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      {canDeleteUi && salary.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDeleteSalary(salary.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      {payrollReadOnly && (
                        <span className="text-xs text-muted-foreground px-1">
                          View only
                        </span>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {salaryPaging.showControls && (
          <div className="p-4 pt-0">
            <ListPagination
              page={salaryPaging.page}
              totalPages={salaryPaging.totalPages}
              hasPrev={salaryPaging.hasPrev}
              hasNext={salaryPaging.hasNext}
              rangeLabel={salaryPaging.rangeLabel}
              onPrev={() => salaryPaging.setPage((p) => Math.max(1, p - 1))}
              onNext={() =>
                salaryPaging.setPage((p) =>
                  Math.min(salaryPaging.totalPages, p + 1)
                )
              }
            />
          </div>
        )}
      </Card>

      {filteredSalaries.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          No payroll records for {selectedMonthLabel}
        </div>
      )}

      <Dialog
        open={!!editingSalary}
        onOpenChange={(open) => !open && setEditingSalary(null)}
      >
        <DialogContent
          className="max-w-2xl"
          style={{ maxHeight: "90vh", overflowY: "auto" }}
        >
          <DialogHeader>
            <DialogTitle>Edit pending payroll</DialogTitle>
            <DialogDescription>
              {editingSalary?.employeeName}
            </DialogDescription>
          </DialogHeader>
          {editingSalary && editPreview && (
            <>
              <SheetFields
                form={editingSalary}
                setForm={setEditingSalary}
                computed={editPreview}
                openAdvances={editOpenAdvances}
                advancesLoading={editAdvancesLoading}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingSalary(null)}>
                  Cancel
                </Button>
                <Button className="btn-gradient" onClick={handleUpdateSalary}>
                  Save changes
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Salary;
