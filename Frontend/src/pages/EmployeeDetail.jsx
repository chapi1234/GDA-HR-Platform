import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useLanguage } from "../contexts/LanguageContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  DollarSign,
  User,
  IdCard,
  GraduationCap,
  Landmark,
  ShieldAlert,
  Briefcase,
  CreditCard,
  Printer,
  Download,
  FileText,
  Image as ImageIcon,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { getRoleLabel } from "../utils/permissions";
import { toast } from "react-toastify";
import EmployeeIdCard, { ID_CARD_MM } from "../components/id/EmployeeIdCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  downloadIdCardPdf,
  downloadIdCardPng,
} from "../utils/idCardExport";

const API_URL = import.meta.env.VITE_API_URL;

function formatEtb(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return `ETB ${n.toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function formatMonth(value) {
  if (!value) return "—";
  const raw = String(value).slice(0, 7);
  const d = new Date(`${raw}-01`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
        {label}
      </p>
      <p className="text-sm text-foreground break-words">{value || "—"}</p>
    </div>
  );
}

const EmployeeDetail = () => {
  // ALL hooks must be at top level, before any conditional returns
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Declared unconditionally - NEVER after an early return
  const idCardRef = useRef(null);

  const idCardEmployee = useMemo(
    () =>
      employee
        ? {
            name: employee.name || "",
            dateOfBirth: employee.dateOfBirth || null,
            gender: employee.gender || "",
            position: employee.position || "",
            nationality: employee.nationality || "Ethiopian",
            address: employee.address || "",
            phone: employee.phone || "",
            employeeId: employee.employeeId || "",
            profileImage: employee.profileImage || employee.avatar || "",
            avatar: employee.avatar || employee.profileImage || "",
          }
        : {},
    [employee]
  );

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    let mounted = true;
    const load = async () => {
      if (!id || !token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/employees/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!mounted) return;
        if (res.data?.status && res.data?.data) {
          setEmployee(res.data.data);
        } else {
          toast.error(res.data?.message || "Employee not found");
          navigate("/employees");
        }
      } catch (err) {
        if (!mounted) return;
        toast.error(err.response?.data?.message || "Failed to load employee");
        navigate("/employees");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [id, navigate]);

  // Conditional returns AFTER all hooks
  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!employee) return null;

  const initials = (employee.name || "")
    .split(" ")
    .map((n) => n[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleDownloadPdf = async (format = "card") => {
    if (!idCardRef.current) {
      toast.error("ID card element is not ready");
      return;
    }
    try {
      setExporting(true);
      toast.info(
        format === "a4"
          ? "Generating printable A4 sheet with cut guides..."
          : "Generating high-resolution ID card PDF..."
      );
      await downloadIdCardPdf({
        element: idCardRef.current,
        employee,
        format,
      });
      toast.success("ID Card PDF downloaded successfully!");
    } catch (err) {
      console.error("PDF export failed", err);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPng = async () => {
    if (!idCardRef.current) {
      toast.error("ID card element is not ready");
      return;
    }
    try {
      setExporting(true);
      toast.info("Generating high-resolution PNG image...");
      await downloadIdCardPng({
        element: idCardRef.current,
        employee,
      });
      toast.success("ID Card PNG downloaded successfully!");
    } catch (err) {
      console.error("PNG export failed", err);
      toast.error("Failed to generate PNG image.");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    if (!idCardRef.current) {
      toast.error("ID card not ready yet.");
      return;
    }
    const cardHtml = idCardRef.current.outerHTML;
    const w = `${ID_CARD_MM.width}mm`;
    const h = `${ID_CARD_MM.height}mm`;
    const win = window.open("", "_blank", "width=600,height=450");
    if (!win) {
      toast.error("Pop-up blocked — please allow pop-ups and try again.");
      return;
    }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Employee ID – ${employee.name || ""}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${w}; height: ${h};
      background: #fff;
      overflow: hidden;
    }
    .employee-id-card {
      transform: scale(calc(${w} / 1015px)) !important;
      transform-origin: top left !important;
      box-shadow: none !important;
    }
    @page { size: ${w} ${h}; margin: 0; }
  </style>
</head>
<body>${cardHtml}</body>
</html>`);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
    };
    setTimeout(() => {
      try { win.focus(); win.print(); } catch (_) {}
    }, 800);
  };

  const educationList = Array.isArray(employee.education)
    ? employee.education
    : employee.education
      ? [{ degree: String(employee.education) }]
      : [];

  const workHistory = Array.isArray(employee.workHistory) ? employee.workHistory : [];

  const statusVariant =
    employee.status === "active"
      ? "default"
      : employee.status === "terminated"
        ? "destructive"
        : "secondary";

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6 employee-detail-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link to="/employees">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Employees
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">{t('pages.employeeDetails')}</h1>
          <p className="text-muted-foreground">{t('pages.employeeDetailsDesc')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={exporting}>
            <Printer className="w-4 h-4 mr-2" />
            Print ID Card
          </Button>

          {/* Download Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={exporting} className="gap-1.5">
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                Download ID
                <ChevronDown className="w-4 h-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Choose Download Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDownloadPdf("card")}
                className="flex items-start gap-2.5 py-2.5 cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Card PDF (CR80 Standard)</p>
                  <p className="text-xs text-muted-foreground">
                    Exact 85.6mm × 56mm size for plastic badge printers
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => handleDownloadPdf("a4")}
                className="flex items-start gap-2.5 py-2.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Printable A4 Sheet PDF</p>
                  <p className="text-xs text-muted-foreground">
                    Centered on A4 with cut marks & instructions
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleDownloadPng}
                className="flex items-start gap-2.5 py-2.5 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">High-Res Image (PNG)</p>
                  <p className="text-xs text-muted-foreground">
                    Crystal-clear 300+ DPI digital badge image
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Hero */}
      <Card className="dashboard-card print:hidden">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <Avatar className="w-32 h-32 mx-auto md:mx-0">
              <AvatarImage src={employee.avatar || employee.profileImage} alt={employee.name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center md:text-left space-y-2">
              <h2 className="text-2xl font-bold">{employee.name}</h2>
              <p className="text-muted-foreground">
                {[employee.position, employee.unitPath || employee.department].filter(Boolean).join(" • ") || "—"}
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <Badge variant="secondary">ID: {employee.employeeId || "—"}</Badge>
                <Badge variant="outline">{getRoleLabel(employee.role)}</Badge>
                <Badge variant={statusVariant} className="capitalize">
                  {employee.status || "active"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Official Employee ID Card */}
      <Card className="dashboard-card print:border-0 print:bg-transparent print:p-0">
        <CardHeader className="print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="w-5 h-5 text-primary" />
                Official Employee ID Card
              </CardTitle>
              <CardDescription>
                Standard CR80 plastic card template ({ID_CARD_MM.width}mm × {ID_CARD_MM.height}mm)
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={exporting}>
                <Printer className="w-4 h-4 mr-1.5" />
                Print ID
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" disabled={exporting} className="gap-1">
                    {exporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Download
                    <ChevronDown className="w-3 h-3 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => handleDownloadPdf("card")} className="cursor-pointer">
                    <CreditCard className="w-4 h-4 mr-2 text-primary" />
                    <span>Card PDF (CR80)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownloadPdf("a4")} className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2 text-primary" />
                    <span>Printable A4 PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDownloadPng} className="cursor-pointer">
                    <ImageIcon className="w-4 h-4 mr-2 text-primary" />
                    <span>High-Res PNG</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-4 sm:p-8 bg-muted/30 rounded-b-xl overflow-auto print:border-0 print:bg-transparent print:p-0">
          <div
            className="id-card-preview-wrap"
            style={{
              width: `calc(${ID_CARD_MM.width}mm * 2.6)`,
              height: `calc(${ID_CARD_MM.height}mm * 2.6)`,
              overflow: "hidden",
            }}
          >
            <div
              className="id-card-preview-scale"
              style={{
                transform: "scale(calc((85.6mm * 2.6) / 1015px))",
                transformOrigin: "top left",
                width: "1015px",
                height: "665px",
              }}
            >
              <EmployeeIdCard ref={idCardRef} employee={idCardEmployee} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center print:hidden">
            Card size: {ID_CARD_MM.width}mm × {ID_CARD_MM.height}mm • Click Print ID Card to output directly to CR80 card printers or save as PDF.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
        {/* Personal */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5" />
              Personal Information
            </CardTitle>
            <CardDescription>Contact and identity details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem icon={Mail} label="Email" value={employee.email} />
              <DetailItem icon={Phone} label="Phone" value={employee.phone} />
              <DetailItem icon={IdCard} label="National ID" value={employee.nationalId} />
              <DetailItem label="Gender" value={employee.gender === "F" ? "Female" : employee.gender === "M" ? "Male" : employee.gender} />
              <DetailItem icon={Calendar} label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
              <DetailItem icon={MapPin} label="Address" value={employee.address} />
            </div>
            {(employee.bio || employee.skills) && (
              <>
                <Separator />
                {employee.bio ? <DetailItem label="Bio" value={employee.bio} /> : null}
                {employee.skills ? <DetailItem label="Skills" value={employee.skills} /> : null}
              </>
            )}
          </CardContent>
        </Card>

        {/* Employment */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="w-5 h-5" />
              Employment
            </CardTitle>
            <CardDescription>Role, unit, and compensation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem icon={Building2} label="Unit / Sector" value={employee.unitPath || employee.department} />
              <DetailItem label="Position" value={employee.position} />
              <DetailItem label="Role" value={getRoleLabel(employee.role)} />
              <DetailItem label="Grade Level" value={employee.gradeLevel} />
              <DetailItem icon={Calendar} label="Join Date" value={formatDate(employee.joinDate)} />
              <DetailItem icon={Calendar} label="End Date" value={formatDate(employee.endDate)} />
              <DetailItem icon={DollarSign} label="Salary" value={formatEtb(employee.salary)} />
              <DetailItem label="Pay Type" value={employee.payType} />
              <DetailItem label="Status" value={employee.status} />
              <DetailItem label="Scope Level" value={(employee.scopeLevel || "").replaceAll("_", " ")} />
            </div>
          </CardContent>
        </Card>

        {/* Emergency */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="w-5 h-5" />
              Emergency Contact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem label="Contact Name" value={employee.emergencyContact} />
              <DetailItem icon={Phone} label="Contact Phone" value={employee.emergencyPhone} />
            </div>
          </CardContent>
        </Card>

        {/* Bank */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Landmark className="w-5 h-5" />
              Bank Details
            </CardTitle>
            <CardDescription>Used for payroll bank export</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem label="Bank Name" value={employee.bankName || "Commercial Bank of Ethiopia"} />
              <DetailItem label="Account Name" value={employee.bankAccountName} />
              <DetailItem label="Account Number" value={employee.bankAccountNumber} />
              <DetailItem label="Branch" value={employee.bankBranch} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Work history */}
      <Card className="dashboard-card print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="w-5 h-5" />
            Previous Work History
          </CardTitle>
          <CardDescription>Employers before joining GammoDA</CardDescription>
        </CardHeader>
        <CardContent>
          {workHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No previous work history on file.</p>
          ) : (
            <div className="space-y-4">
              {workHistory.map((job, idx) => (
                <div key={idx} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                    <div>
                      <p className="font-semibold text-foreground">{job.company || "—"}</p>
                      <p className="text-sm text-muted-foreground">{job.position || "—"}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatMonth(job.startDate)} – {job.endDate ? formatMonth(job.endDate) : "Present / N/A"}
                    </p>
                  </div>
                  {job.description ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{job.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Education */}
      <Card className="dashboard-card print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="w-5 h-5" />
            Education
          </CardTitle>
        </CardHeader>
        <CardContent>
          {educationList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No education records on file.</p>
          ) : (
            <div className="space-y-4">
              {educationList.map((edu, idx) => (
                <div key={idx} className="rounded-lg border border-border p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DetailItem label="Institution" value={edu.institution} />
                  <DetailItem label="Degree" value={edu.degree} />
                  <DetailItem label="Field of Study" value={edu.fieldOfStudy} />
                  <DetailItem label="Graduation Year" value={edu.graduationYear} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default EmployeeDetail;
