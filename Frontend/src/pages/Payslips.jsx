import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  Download,
  Eye,
  FileText,
  CreditCard,
  Trash2,
  Printer,
} from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import { useClientPagination } from "../hooks/useClientPagination";
import ListPagination from "../components/ListPagination";

const API_URL = import.meta.env.VITE_API_URL;

function money(v) {
  return `${Number(v || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ETB`;
}

function mapPayslip(p) {
  return {
    id: p._id || p.id,
    month: p.month || "",
    period: p.period || "",
    grossSalary: Number(p.grossSalary || 0),
    netSalary: Number(p.netSalary || 0),
    deductions: Number(p.deductions || 0),
    status: p.status || "unpaid",
    payDate: p.payDate || null,
    employeeName: p.employeeName || p.employee?.name || "",
    employeeId: p.employeeId || p.employee?.employeeId || "",
    department: p.department || "",
    salaryBreakdown: Array.isArray(p.salaryBreakdown) ? p.salaryBreakdown : [],
  };
}

function printPayslip(slip) {
  const earnings = slip.salaryBreakdown.filter((i) => i.type === "earning");
  const deductions = slip.salaryBreakdown.filter((i) => i.type === "deduction");
  const rows = (list) =>
    list
      .map(
        (i) =>
          `<tr><td>${i.label}</td><td style="text-align:right">${money(
            i.amount
          )}</td></tr>`
      )
      .join("");

  const html = `<!DOCTYPE html><html><head><title>Payslip ${slip.month}</title>
    <style>
      body{font-family:Segoe UI,Arial,sans-serif;padding:32px;color:#111}
      h1{margin:0 0 4px} .muted{color:#666;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      td,th{padding:8px;border-bottom:1px solid #ddd;font-size:14px}
      .grid{display:flex;gap:24px} .col{flex:1}
      .net{font-size:20px;font-weight:700;margin-top:16px}
    </style></head><body>
    <h1>Gammo Development Association</h1>
    <p class="muted">Payslip — ${slip.month}</p>
    <p><strong>${slip.employeeName || ""}</strong> ${
      slip.employeeId ? `(${slip.employeeId})` : ""
    }<br/>
    Period: ${slip.period || slip.month}<br/>
    Pay date: ${
      slip.payDate ? new Date(slip.payDate).toLocaleDateString() : "—"
    }</p>
    <div class="grid">
      <div class="col"><h3>Earnings</h3><table>${rows(earnings)}</table></div>
      <div class="col"><h3>Deductions</h3><table>${rows(deductions)}</table></div>
    </div>
    <p>Gross: <strong>${money(slip.grossSalary)}</strong> ·
       Deductions: <strong>${money(slip.deductions)}</strong></p>
    <p class="net">Net pay: ${money(slip.netSalary)}</p>
    <script>window.onload=()=>window.print()</script>
    </body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Pop-up blocked — allow pop-ups to print payslip");
    return;
  }
  w.document.write(html);
  w.document.close();
}

const Payslips = () => {
  const { t } = useLanguage();
  const { user, canManageHrOps } = useAuth();
  const [payslips, setPayslips] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPayslips = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("authToken");
        const res = await axios.get(`${API_URL}/api/payslips`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const mapped = (res.data?.data || []).map(mapPayslip);
        setPayslips(mapped);
        if (mapped[0]) setSelectedId(mapped[0].id);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load payslips");
      } finally {
        setLoading(false);
      }
    };
    loadPayslips();
  }, []);

  const selected =
    payslips.find((p) => p.id === selectedId) || payslips[0] || null;

  const salaryBreakdown = selected?.salaryBreakdown?.length
    ? selected.salaryBreakdown
    : [];
  const earnings = salaryBreakdown.filter((i) => i.type === "earning");
  const deductions = salaryBreakdown.filter((i) => i.type === "deduction");

  const payslipPaging = useClientPagination(payslips, 10, [payslips.length]);

  const ytd = useMemo(() => {
    const year = new Date().getFullYear();
    const inYear = payslips.filter((p) => {
      const d = p.payDate ? new Date(p.payDate) : null;
      return d && d.getFullYear() === year;
    });
    return {
      gross: inYear.reduce((s, p) => s + p.grossSalary, 0),
      tax: inYear.reduce((s, p) => {
        const taxRow = (p.salaryBreakdown || []).find((b) =>
          /tax|paye/i.test(b.label || "")
        );
        return s + Number(taxRow?.amount || 0);
      }, 0),
      net: inYear.reduce((s, p) => s + p.netSalary, 0),
    };
  }, [payslips]);

  const handleDeletePayslip = async (id) => {
    if (!window.confirm("Delete this payslip?")) return;
    try {
      const token = localStorage.getItem("authToken");
      const res = await axios.delete(`${API_URL}/api/payslips/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.status) {
        setPayslips((prev) => prev.filter((p) => p.id !== id));
        toast.success("Payslip deleted");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Error deleting payslip");
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {canManageHrOps ? t('pages.payslips') : t('nav.myPayslips')}
          </h1>
          <p className="text-muted-foreground">{t('pages.payslipsDesc')}</p>
        </div>
        {selected && (
          <Button
            className="btn-gradient"
            onClick={() => printPayslip(selected)}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print / Save PDF
          </Button>
        )}
      </div>

      {loading && (
        <p className="text-muted-foreground text-sm">Loading payslips…</p>
      )}

      {!loading && !selected && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No payslips yet. They appear after payroll is approved.
          </CardContent>
        </Card>
      )}

      {selected && (
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <span>{selected.month || "Payslip"}</span>
            </CardTitle>
            <CardDescription>
              {selected.employeeName
                ? `${selected.employeeName} · `
                : ""}
              Period: {selected.period || selected.month}
              {selected.payDate
                ? ` · Paid/due ${new Date(selected.payDate).toLocaleDateString()}`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Gross</p>
                <p className="text-2xl font-bold text-green-600">
                  {money(selected.grossSalary)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deductions</p>
                <p className="text-2xl font-bold text-red-600">
                  {money(selected.deductions)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net</p>
                <p className="text-2xl font-bold text-primary">
                  {money(selected.netSalary)}
                </p>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-lg mb-4 text-green-600">
                  Earnings
                </h3>
                <div className="space-y-2">
                  {earnings.length === 0 && (
                    <p className="text-sm text-muted-foreground">No lines</p>
                  )}
                  {earnings.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 rounded-lg bg-green-50 dark:bg-green-950"
                    >
                      <span className="text-sm">{item.label}</span>
                      <span className="font-medium">{money(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-4 text-red-600">
                  Deductions
                </h3>
                <div className="space-y-2">
                  {deductions.length === 0 && (
                    <p className="text-sm text-muted-foreground">No lines</p>
                  )}
                  {deductions.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 rounded-lg bg-red-50 dark:bg-red-950"
                    >
                      <span className="text-sm">{item.label}</span>
                      <span className="font-medium">-{money(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Payslip history
            </CardTitle>
            <CardDescription>Select a slip to view details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payslipPaging.pagedItems.map((payslip) => (
                <div
                  key={payslip.id}
                  className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                    selected?.id === payslip.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-accent"
                  }`}
                  onClick={() => setSelectedId(payslip.id)}
                >
                  <div>
                    <h4 className="font-medium">{payslip.month}</h4>
                    <p className="text-sm text-muted-foreground">
                      {payslip.employeeName || payslip.period}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-medium">{money(payslip.netSalary)}</p>
                      <Badge variant="secondary" className="text-xs">
                        {payslip.status}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(payslip.id);
                        printPayslip(payslip);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        printPayslip(payslip);
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    {canManageHrOps && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePayslip(payslip.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {payslipPaging.showControls && (
                <ListPagination
                  page={payslipPaging.page}
                  totalPages={payslipPaging.totalPages}
                  hasPrev={payslipPaging.hasPrev}
                  hasNext={payslipPaging.hasNext}
                  rangeLabel={payslipPaging.rangeLabel}
                  onPrev={() => payslipPaging.setPage((p) => Math.max(1, p - 1))}
                  onNext={() =>
                    payslipPaging.setPage((p) =>
                      Math.min(payslipPaging.totalPages, p + 1)
                    )
                  }
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle>Year to date ({new Date().getFullYear()})</CardTitle>
            <CardDescription>From approved payslips this year</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">YTD Gross</p>
              <p className="text-xl font-bold">{money(ytd.gross)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">YTD Income tax</p>
              <p className="text-xl font-bold text-red-600">{money(ytd.tax)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">YTD Net</p>
              <p className="text-xl font-bold text-primary">{money(ytd.net)}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Signed in as {user?.name || user?.email || "user"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Payslips;
