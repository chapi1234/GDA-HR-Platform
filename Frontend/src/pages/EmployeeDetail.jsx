import { useEffect, useState } from "react";
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
} from "lucide-react";
import { getRoleLabel } from "../utils/permissions";
import { toast } from "react-toastify";

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
  const { id } = useParams();
  const navigate = useNavigate();
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!id || !token) return;
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
  }, [id, token, navigate]);

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
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
      </div>

      {/* Hero */}
      <Card className="dashboard-card">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      <Card className="dashboard-card">
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
      <Card className="dashboard-card">
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
