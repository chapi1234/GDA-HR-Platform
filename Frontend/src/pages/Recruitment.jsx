import { useState, useEffect } from "react";
import axios from 'axios';
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
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
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
import { useClientPagination } from "../hooks/useClientPagination";
import ListPagination from "../components/ListPagination";
import { Textarea } from "../components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  Search,
  Plus,
  Filter,
  Eye,
  UserCheck,
  UserX,
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  Building2,
  Calendar,
  Star,
  Edit3,
  Phone,
  Mail,
  FileText,
  Download,
} from "lucide-react";
import { toast } from "react-toastify";

const Recruitment = () => {
  const { t } = useLanguage();

  const wrapperStyle = {
    paddingBottom: "20px",
    marginTop: "20px"
  };

  const statCardsContainerStyle = {    
    alignItems: "stretch",
  };

  const marginStyle = {
    marginBottom: "10px"
  };

  const button = {
    width: "200px"
  }

  const { canRecruit } = useAuth();
  const isHR = canRecruit;
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showJobDialog, setShowJobDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("jobs");
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobDetailDialog, setShowJobDetailDialog] = useState(false);
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [editJobData, setEditJobData] = useState({});

  // job postings will be loaded from backend
  const [jobPostings, setJobPostings] = useState([]);

  // API base (with safe fallback)
  const API_URL = import.meta.env.VITE_API_URL;
  const API_BASE = API_URL;

  // org units = sectors / sub-sectors / units (not legacy departments)
  const [orgUnits, setOrgUnits] = useState([]);
  const jobTypes = ["Full-time", "Part-time", "Contract", "Internship"];

  // Load jobs from backend
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/jobs`);
        if (!mounted) return;
          if (res.data && Array.isArray(res.data.data)) {
          const jobs = res.data.data.map((j) => {
            // department can be populated object, string name, or id
            let deptName = "";
            if (j.department) {
              if (typeof j.department === "object") {
                deptName = j.department.name || j.department.label || "";
              } else if (typeof j.department === "string") {
                // try to resolve from loaded orgUnits (support id/_id/name)
                const found = orgUnits.find((d) => (d._id === j.department || d.id === j.department || d.name === j.department || d.path === j.department));
                deptName = found ? (found.path || found.name) : j.department;
              }
            }

            const salary = j.salaryRange
              ? `${j.salaryRange.min || ""} - ${j.salaryRange.max || ""}`
              : j.salary || "";

            return {
              id: j._id || j.id,
              title: j.title,
              department: deptName,
              location: j.location || "",
              type: j.jobType || "",
              salary,
              status: j.status || "active",
              postedDate: j.postedDate || j.createdAt || new Date().toISOString(),
              applications: Array.isArray(j.applications) ? j.applications.length : (j.applicationsCount || 0),
              description: j.description || "",
              // requirements: prefer array, fall back to single string in array
              requirements: Array.isArray(j.requirements)
                ? j.requirements
                : j.requirements
                ? [j.requirements]
                : [],
            };
          });
          setJobPostings(jobs);
        }
      } catch (err) {
        console.error("Failed to load jobs", err);
      }
    })();
    return () => { mounted = false; };
  }, [API_BASE, orgUnits]);

  // applicants state will be loaded from backend
  const [allApplicants, setAllApplicants] = useState([]);
  // applicants for the currently selected job in the Job Detail dialog
  const [jobApplicants, setJobApplicants] = useState([]);

  const [newJob, setNewJob] = useState({
    title: "",
    department: "",
    location: "",
    type: "",
    salary: "",
    description: "",
    // requirements stored as an array of strings
    requirements: [],
    requirementsRaw: "",
  });

  const statusOptions = ["all", "active", "closed", "draft"];
  const applicantStatusOptions = [
    "all",
    "applied",
    "under_review",
    "shortlisted",
    "rejected",
    "hired",
  ];
  

  // Load sectors / units for job placement
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/sectors/public-list`);
        if (!mounted) return;
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        const normalized = list.map((s) => {
          const id = s._id || s.id;
          const path =
            Array.isArray(s.pathNames) && s.pathNames.length
              ? s.pathNames.join(' › ')
              : s.name;
          return {
            _id: id,
            id,
            name: s.name,
            path,
            level: s.level,
          };
        });
        setOrgUnits(normalized);
      } catch (err) {
        console.error('Failed to load sectors', err);
        if (mounted) setOrgUnits([]);
      }
    })();
    return () => { mounted = false; };
  }, [API_BASE]);

  // Load all applicants (flatten candidate.applications -> application rows)
  const fetchAllApplicants = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await axios.get(`${API_BASE}/api/candidates`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const payload = res.data && res.data.data ? res.data.data : res.data;
      if (Array.isArray(payload)) {
        const flat = [];
        payload.forEach((cand) => {
          const apps = Array.isArray(cand.applications) ? cand.applications : [];
          apps.forEach((app) => {
            flat.push({
              id: app._id || `${cand._id}-${app.appliedAt}`,
              candidateId: cand._id,
              jobApplicationId: app._id, // may be undefined if synthetic
              jobDetailId: app._jobDetailId || null,
              name: cand.name,
              email: cand.email,
              phone: cand.phone,
              position: (jobPostings.find(j => String(j.id) === String(app.job)) || {}).title || "",
              jobId: app.job,
              experience: app.experience || "",
              skills: Array.isArray(app.skills) ? app.skills : (app.skills ? String(app.skills).split(',').map(s => s.trim()) : []),
              status: app.status || 'applied',
              appliedDate: app.appliedAt || cand.createdAt,
              resume: (app.resume && (app.resume.url || app.resume.filename)) || (cand.resume && (cand.resume.url || cand.resume.filename)) || '',
            });
          });
        });
        setAllApplicants(flat);
      }
    } catch (err) {
      console.error('Failed to load applicants', err);
      setAllApplicants([]);
    }
  };

  useEffect(() => {
    fetchAllApplicants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE, jobPostings]);

  const filteredJobs = jobPostings.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || job.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredApplicants = allApplicants.filter((applicant) => {
    const matchesSearch =
      (applicant.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (applicant.position || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (applicant.email || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || applicant.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const jobsPaging = useClientPagination(filteredJobs, 10, [
    searchTerm,
    filterStatus,
    jobPostings.length,
    activeTab,
  ]);
  const applicantsPaging = useClientPagination(filteredApplicants, 10, [
    searchTerm,
    filterStatus,
    allApplicants.length,
    activeTab,
  ]);

  const handleAddJob = () => {
    if (!newJob.title || !newJob.department || !newJob.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    (async () => {
      try {
        const token = localStorage.getItem('authToken');
        const payload = {
          title: newJob.title,
          sectorId: newJob.department,
          department: newJob.department,
          description: newJob.description,
          requirements:
            newJob.requirements && newJob.requirements.length
              ? newJob.requirements
              : newJob.requirementsRaw
              ? newJob.requirementsRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
              : [],
          location: newJob.location,
          salary: newJob.salary,
          jobType: newJob.type,
          status: 'active',
        };
        const res = await axios.post(`${API_BASE}/api/jobs`, payload, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.data && res.data.data) {
          const j = res.data.data;
          // find department name from loaded orgUnits if department is an id
          const deptName =
            orgUnits.find((d) => (d._id === newJob.department || d.id === newJob.department || d.name === newJob.department))?.path ||
            orgUnits.find((d) => (d._id === newJob.department || d.id === newJob.department || d.name === newJob.department))?.name ||
            j.unitPath ||
            j.department ||
            newJob.department;
          const uiJob = {
            id: j._id || j.id,
            title: j.title,
            department: deptName,
            location: j.location || newJob.location,
            type: j.jobType || newJob.type,
            salary:
              newJob.salary ||
              (j.salaryRange ? `${j.salaryRange.min || ''} - ${j.salaryRange.max || ''}` : ""),
            status: j.status || 'active',
            postedDate: j.postedDate || new Date().toISOString(),
            applications: Array.isArray(j.applications) ? j.applications.length : 0,
            description: j.description,
            requirements: Array.isArray(j.requirements) ? j.requirements : (j.requirements ? [j.requirements] : newJob.requirements || []),
          };
          setJobPostings(prev => [uiJob, ...prev]);
          setNewJob({ title: '', department: '', location: '', type: '', salary: '', description: '', requirements: [], requirementsRaw: '' });
          setShowJobDialog(false);
          toast.success('Job posting created successfully!');
        } else {
          toast.error('Failed to create job');
        }
      } catch (err) {
        console.error('Create job error', err);
        toast.error(err?.response?.data?.message || 'Failed to create job');
      }
    })();
  };

  const handleApplicantAction = async (id, status) => {
    // optimistic UI update
    const prevAll = allApplicants;
    const prevJob = jobApplicants;
    setAllApplicants((prev) =>
      prev.map((applicant) => (applicant.id === id ? { ...applicant, status } : applicant))
    );
    setJobApplicants((prev) =>
      prev.map((applicant) => (applicant.id === id ? { ...applicant, status } : applicant))
    );

    try {
      const token = localStorage.getItem('authToken');
      const res = await axios.patch(
        `${API_BASE}/api/candidates/applications/${id}/status`,
        { status },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (res.data && res.data.status) {
        toast.success(`Applicant ${status} successfully!`);
        // refresh both views so changes are reflected everywhere
        try {
          await fetchAllApplicants();
          if (showJobDetailDialog && selectedJob) await fetchJobApplicants(selectedJob.id);
        } catch (e) {
          // ignore refresh errors, we've already shown success
          console.error('Failed to refresh applicants after status update', e);
        }
      } else {
        throw new Error(res.data?.message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Failed to update applicant status', err);
      // revert optimistic update
      setAllApplicants(prevAll);
      setJobApplicants(prevJob);
      toast.error(err?.response?.data?.message || err.message || 'Failed to update applicant status');
    }
  };

  const handleViewJobDetails = (job) => {
    // when opening the details for edit, try to map department name -> id
    const deptId = orgUnits.find(
      (d) => d.name === job.department || d._id === job.department || d.id === job.department
    )?._id || orgUnits.find((d) => d.name === job.department)?.id || job.department;

    // set basic selected job UI state immediately
    setSelectedJob(job);
    setEditJobData({ ...job, department: deptId, requirementsRaw: (job.requirements || []).join("\n") });
    setIsEditingJob(false);
    setShowJobDetailDialog(true);

    // load applicants for this job from backend
    fetchJobApplicants(job.id);
  };

  const fetchJobApplicants = async (jobId) => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await axios.get(`${API_BASE}/api/jobs/${jobId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const payload = res.data && res.data.data ? res.data.data : res.data;
      const details = payload?.applicationsDetails || [];
      const candidatesPopulated = Array.isArray(payload?.applications) ? payload.applications : [];

      const mapped = [];
      if (Array.isArray(details) && details.length) {
        details.forEach((d) => {
          // d.candidate may be populated or an id
          const candDoc = d.candidate && typeof d.candidate === 'object' ? d.candidate : (candidatesPopulated.find(c => String(c._id) === String(d.candidate)) || null);
          mapped.push({
            id: d._id || `${d.candidate}-${d.appliedAt}`,
            candidateId: candDoc?._id || d.candidate || null,
            jobApplicationId: null,
            jobDetailId: d._id,
            name: candDoc?.name || d.name || '',
            email: candDoc?.email || d.email || '',
            phone: candDoc?.phone || d.phone || '',
            position: payload?.title || job.title || '',
            jobId: payload?._id || jobId,
            experience: d.experience || '',
            skills: Array.isArray(d.skills) ? d.skills : (d.skills ? String(d.skills).split(',').map(s => s.trim()) : []),
            status: d.status || 'applied',
            appliedDate: d.appliedAt || d.appliedAt || '',
            resume: (d.resume && (d.resume.url || d.resume.filename)) || (candDoc && (candDoc.resume?.url || candDoc.resume?.filename)) || '',
          });
        });
      } else if (Array.isArray(candidatesPopulated) && candidatesPopulated.length) {
        // fallback: job.applications was populated with candidate docs
        candidatesPopulated.forEach((cand) => {
          // try to find candidate's application in their candidate.applications if available
          const app = Array.isArray(cand.applications) && cand.applications.length ? cand.applications.find(a => String(a.job) === String(jobId)) : null;
          mapped.push({
            id: app?._id || cand._id,
            candidateId: cand._id,
            jobApplicationId: app?._id || null,
            jobDetailId: null,
            name: cand.name,
            email: cand.email,
            phone: cand.phone,
            position: payload?.title || job.title || '',
            jobId: jobId,
            experience: app?.experience || '',
            skills: app?.skills || [],
            status: app?.status || 'applied',
            appliedDate: app?.appliedAt || cand.createdAt,
            resume: (app && (app.resume?.url || app.resume?.filename)) || (cand.resume && (cand.resume.url || cand.resume.filename)) || '',
          });
        });
      }

      setJobApplicants(mapped);
    } catch (err) {
      console.error('Failed to load job applicants', err);
      setJobApplicants([]);
    }
  };

  const handleEditJob = () => {
    setIsEditingJob(true);
  };

  const handleSaveJobEdit = async () => {
    if (!selectedJob) return;
    try {
      const token = localStorage.getItem("authToken");
      // Prepare payload: prefer department id if available
      const deptValue = editJobData.department;
      // If department is a name, try to find id
      const deptId =
        orgUnits.find((d) => d._id === deptValue || d.id === deptValue || d.name === deptValue)?._id ||
        deptValue;

      const payload = {
        title: editJobData.title,
        sectorId: deptId,
        department: deptId,
        location: editJobData.location,
        jobType: editJobData.type,
        salary: editJobData.salary,
        description: editJobData.description,
        requirements:
          editJobData.requirements && editJobData.requirements.length
            ? editJobData.requirements
            : editJobData.requirementsRaw
            ? editJobData.requirementsRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
            : [],
        status: editJobData.status || selectedJob.status,
      };

      const res = await axios.patch(`${API_BASE}/api/jobs/${selectedJob.id}`, payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.data && res.data.data) {
        const j = res.data.data;
        // resolve department name for UI
        const deptName =
          orgUnits.find((d) => d._id === (j.department || deptId) || d.id === (j.department || deptId) || d.name === (j.department || deptId))?.name ||
          (typeof j.department === "object" ? j.department.name : j.department) ||
          editJobData.department;

        const updatedJob = {
          id: j._id || j.id,
          title: j.title || editJobData.title,
          department: deptName,
          location: j.location || editJobData.location,
          type: j.jobType || editJobData.type,
          salary: j.salaryRange
            ? `${j.salaryRange.min || ""} - ${j.salaryRange.max || ""}`
            : j.salary || editJobData.salary,
          status: j.status || editJobData.status || "active",
          postedDate: j.postedDate || selectedJob.postedDate,
          applications: Array.isArray(j.applications) ? j.applications.length : (j.applicationsCount || selectedJob.applications || 0),
          description: j.description || editJobData.description,
          requirements: Array.isArray(j.requirements)
            ? j.requirements
            : editJobData.requirements && editJobData.requirements.length
            ? editJobData.requirements
            : editJobData.requirementsRaw
            ? editJobData.requirementsRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
            : [],
        };

        setJobPostings((prev) => prev.map((job) => (job.id === updatedJob.id ? updatedJob : job)));
        setSelectedJob(updatedJob);
        setIsEditingJob(false);
        toast.success("Job updated successfully!");
        return;
      }

      toast.error("Failed to update job");
    } catch (err) {
      console.error("Update job error", err);
      toast.error(err?.response?.data?.message || "Failed to update job");
    }
  };

  const handleCancelEdit = () => {
    setEditJobData(selectedJob);
    setIsEditingJob(false);
  };

  const getJobApplicants = (jobId) => {
    // prefer jobApplicants loaded from server; fall back to filtering allApplicants
    if (jobApplicants && jobApplicants.length) return jobApplicants.filter((a) => String(a.job) === String(jobId) || String(a.jobId) === String(jobId));
    return allApplicants.filter((applicant) => String(applicant.jobId) === String(jobId) || String(applicant.job) === String(jobId));
  };

  const getJobStatusBadge = (status) => {
    const variants = {
      active: { variant: "default", label: "Active" },
      closed: { variant: "secondary", label: "Closed" },
      draft: { variant: "outline", label: "Draft" },
    };
    const config = variants[status] || variants.active;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getApplicantStatusBadge = (status) => {
    const variants = {
      applied: { variant: "secondary", label: "Applied" },
      under_review: { variant: "outline", label: "Under Review" },
      shortlisted: { variant: "default", label: "Shortlisted" },
      rejected: { variant: "destructive", label: "Rejected" },
      hired: { variant: "default", label: "Hired" },
    };
    const config = variants[status] || variants.applied;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const totalJobs = jobPostings.length;
  const activeJobs = jobPostings.filter((j) => j.status === "active").length;
  const totalApplicants = allApplicants.length;
  const shortlistedApplicants = allApplicants.filter(
    (a) => a.status === "shortlisted"
  ).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('pages.recruitment')}</h1>
          <p className="text-muted-foreground">{t('pages.recruitmentDesc')}</p>
        </div>
        {isHR && (
          <Dialog open={showJobDialog} onOpenChange={setShowJobDialog}>
            <DialogTrigger asChild style={{ ...marginStyle, ...button }}>
              <Button className="btn-gradient">
                <Plus className="w-4 h-4 mr-2" />
                {t('recruitment.addJob')}
              </Button>
            </DialogTrigger>
            <DialogContent
              // className="max-w-2xl"
              style={{ maxHeight: "90vh", overflowY: "auto" }}
            >
              <DialogHeader>
                <DialogTitle>Create Job Posting</DialogTitle>
                <DialogDescription>
                  Fill in the details for the new job posting
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">Job Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g. Senior Frontend Developer"
                      value={newJob.title}
                      onChange={(e) =>
                        setNewJob({ ...newJob, title: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="department">Sector / Unit</Label>
                    <Select
                      value={newJob.department}
                      onValueChange={(value) =>
                        setNewJob({ ...newJob, department: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select sector / unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {orgUnits.map((unit) => (
                          <SelectItem key={unit._id || unit.id || unit.path} value={unit._id || unit.id}>
                            {unit.path || unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="e.g. New York, NY"
                      value={newJob.location}
                      onChange={(e) =>
                        setNewJob({ ...newJob, location: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Job Type</Label>
                    <Select
                      value={newJob.type}
                      onValueChange={(value) =>
                        setNewJob({ ...newJob, type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select job type" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="salary">Salary Range</Label>
                  <Input
                    id="salary"
                    placeholder="e.g. $70,000 - $90,000"
                    value={newJob.salary}
                    onChange={(e) =>
                      setNewJob({ ...newJob, salary: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="description">Job Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Provide a detailed job description..."
                    value={newJob.description}
                    onChange={(e) =>
                      setNewJob({ ...newJob, description: e.target.value })
                    }
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="requirements">Requirements (one per line)</Label>
                  <Textarea
                    id="requirements"
                    placeholder={"e.g. 5+ years experience in React\nStrong TypeScript skills"}
                    value={newJob.requirementsRaw}
                    onChange={(e) =>
                      setNewJob((prev) => ({ ...prev, requirementsRaw: e.target.value }))
                    }
                    onBlur={() =>
                      setNewJob((prev) => ({
                        ...prev,
                        requirements: prev.requirementsRaw
                          ? prev.requirementsRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
                          : [],
                      }))
                    }
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowJobDialog(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddJob} className="btn-gradient">
                  Post Job
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Cards */}
      <div style={wrapperStyle} className="flex flex-wrap gap-4 mb-5">
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalJobs}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
        </div>
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeJobs}</div>
              <p className="text-xs text-muted-foreground">
                Currently recruiting
              </p>
            </CardContent>
          </Card>
        </div>
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Applicants
              </CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalApplicants}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
        </div>
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Shortlisted</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{shortlistedApplicants}</div>
              <p className="text-xs text-muted-foreground">Ready for interview</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap w-full gap-2">
          <TabsTrigger value="jobs">Job Postings</TabsTrigger>
          <TabsTrigger value="applicants">Applicants</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-6">
          {/* Job Filters */}
          <Card style={marginStyle} className="dashboard-card">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4 mb-5">
                <div className="relative flex-1 min-w-full sm:min-w-[250px] md:min-w-[300px] lg:min-w-[240px]">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search jobs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="flex-1 min-w-full sm:min-w-[250px] md:min-w-[220px] lg:min-w-[180px]">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full md:w-[150px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status === "all"
                            ? "All Status"
                            : status.charAt(0).toUpperCase() + status.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Job Listings */}
          <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobsPaging.pagedItems.map((job) => (
              <Card
                style={marginStyle}
                key={job.id}
                className="dashboard-card hover:shadow-card-hover transition-all duration-200"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{job.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Building2 className="w-4 h-4" />
                        {job.department}
                      </CardDescription>
                    </div>
                    {getJobStatusBadge(job.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{job.type}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="w-4 h-4" />
                      <span>{job.salary}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <UserCheck className="w-4 h-4" />
                      <span>{job.applications} applicants</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {job.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Posted {new Date(job.postedDate).toLocaleDateString()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewJobDetails(job)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {jobsPaging.showControls && (
            <ListPagination
              page={jobsPaging.page}
              totalPages={jobsPaging.totalPages}
              hasPrev={jobsPaging.hasPrev}
              hasNext={jobsPaging.hasNext}
              rangeLabel={jobsPaging.rangeLabel}
              onPrev={() => jobsPaging.setPage((p) => Math.max(1, p - 1))}
              onNext={() =>
                jobsPaging.setPage((p) => Math.min(jobsPaging.totalPages, p + 1))
              }
            />
          )}
          </div>

        </TabsContent>

        <TabsContent value="applicants" className="space-y-6">
          {/* Applicant Filters */}
          <Card style={marginStyle} className="dashboard-card">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4 mb-5">
                <div className="relative flex-1 min-w-full sm:min-w-[250px] md:min-w-[300px] lg:min-w-[240px]">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search applicants..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex-1 min-w-full sm:min-w-[250px] md:min-w-[220px] lg:min-w-[180px]">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {applicantStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status === "all"
                            ? "All Status"
                            : status
                                .replace("_", " ")
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Applicants Table */}
          <Card className="data-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied Date</TableHead>
                  {isHR && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {applicantsPaging.pagedItems.map((applicant) => (
                  <TableRow key={applicant.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>
                            {applicant.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{applicant.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {applicant.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{applicant.position}</TableCell>
                    <TableCell>{applicant.experience}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {applicant.skills.slice(0, 2).map((skill) => (
                          <Badge
                            key={skill}
                            variant="outline"
                            className="text-xs"
                          >
                            {skill}
                          </Badge>
                        ))}
                        {applicant.skills.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{applicant.skills.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getApplicantStatusBadge(applicant.status)}
                    </TableCell>
                    <TableCell>
                      {new Date(applicant.appliedDate).toLocaleDateString()}
                    </TableCell>
                    {isHR && (
                      <TableCell>
                        <div className="flex space-x-2">
                          {/* First icon: Eye -> mark as shortlisted */}
                          {(applicant.status !== "shortlisted" && applicant.status !== "rejected" && applicant.status !== "hired") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApplicantAction(applicant.id, "shortlisted")}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}

                          {/* Second icon: Person/Check -> mark as hired */}
                          {(applicant.status !== "hired" && applicant.status !== "rejected") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleApplicantAction(applicant.id, "hired")}
                            >
                              <UserCheck className="w-4 h-4" />
                            </Button>
                          )}

                          {/* Last icon: X -> mark as rejected */}
                          {applicant.status !== "rejected" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleApplicantAction(applicant.id, "rejected")}
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {applicantsPaging.showControls && (
              <div className="p-4 pt-0">
                <ListPagination
                  page={applicantsPaging.page}
                  totalPages={applicantsPaging.totalPages}
                  hasPrev={applicantsPaging.hasPrev}
                  hasNext={applicantsPaging.hasNext}
                  rangeLabel={applicantsPaging.rangeLabel}
                  onPrev={() =>
                    applicantsPaging.setPage((p) => Math.max(1, p - 1))
                  }
                  onNext={() =>
                    applicantsPaging.setPage((p) =>
                      Math.min(applicantsPaging.totalPages, p + 1)
                    )
                  }
                />
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {((activeTab === "jobs" && filteredJobs.length === 0) ||
        (activeTab === "applicants" && filteredApplicants.length === 0)) && (
        <div className="text-center py-12">
          <Briefcase className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            No {activeTab === "jobs" ? "jobs" : "applicants"} found
          </h3>
          <p className="text-muted-foreground">
            Try adjusting your search or filters
          </p>
        </div>
      )}

      {/* Job Detail Dialog */}
      <Dialog open={showJobDetailDialog} onOpenChange={setShowJobDetailDialog}>
        <DialogContent
          className="max-w-4xl"
          style={{ maxHeight: "98vh", overflowY: "auto" }}
        >
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl">
                  {selectedJob?.title}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <Building2 className="w-4 h-4" />
                  {selectedJob?.department}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                {getJobStatusBadge(selectedJob?.status)}
                {isHR && !isEditingJob && (
                  <Button variant="outline" size="sm" onClick={handleEditJob}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit Job
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Job Details Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Job Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditingJob ? (
                    <div className="space-y-4">
                      <div>
                        <Label>Job Title</Label>
                        <Input
                          value={editJobData.title || ""}
                          onChange={(e) =>
                            setEditJobData({
                              ...editJobData,
                              title: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Sector / Unit</Label>
                        <Select
                          value={editJobData.department || ""}
                          onValueChange={(value) =>
                            setEditJobData({
                              ...editJobData,
                              department: value,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {orgUnits.map((unit) => (
                                <SelectItem key={unit._id || unit.id || unit.path} value={unit._id || unit.id}>
                                  {unit.path || unit.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Location</Label>
                        <Input
                          value={editJobData.location || ""}
                          onChange={(e) =>
                            setEditJobData({
                              ...editJobData,
                              location: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Job Type</Label>
                        <Select
                          value={editJobData.type || ""}
                          onValueChange={(value) =>
                            setEditJobData({ ...editJobData, type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {jobTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select
                          value={editJobData.status || "active"}
                          onValueChange={(value) =>
                            setEditJobData({ ...editJobData, status: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Salary Range</Label>
                        <Input
                          value={editJobData.salary || ""}
                          onChange={(e) =>
                            setEditJobData({
                              ...editJobData,
                              salary: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Requirements (one per line)</Label>
                        <Textarea
                          value={
                            editJobData.requirementsRaw !== undefined
                              ? editJobData.requirementsRaw
                              : (editJobData.requirements || []).join("\n")
                          }
                          onChange={(e) =>
                            setEditJobData((prev) => ({ ...prev, requirementsRaw: e.target.value }))
                          }
                          onBlur={() =>
                            setEditJobData((prev) => ({
                              ...prev,
                              requirements: prev.requirementsRaw
                                ? prev.requirementsRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
                                : (prev.requirements || []),
                            }))
                          }
                          rows={3}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedJob?.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedJob?.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedJob?.salary}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>
                          Posted{" "}
                          {selectedJob &&
                            new Date(
                              selectedJob.postedDate
                            ).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedJob?.applications} applicants</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Job Description</CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditingJob ? (
                    <Textarea
                      value={editJobData.description || ""}
                      onChange={(e) =>
                        setEditJobData({
                          ...editJobData,
                          description: e.target.value,
                        })
                      }
                      rows={8}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedJob?.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Edit Job Actions */}
            {isEditingJob && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button onClick={handleSaveJobEdit} className="btn-gradient">
                  Save Changes
                </Button>
              </div>
            )}

            {/* Applicants Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Applicants (
                  {selectedJob && getJobApplicants(selectedJob.id).length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedJob && getJobApplicants(selectedJob.id).length > 0 ? (
                  <div className="space-y-4">
                    {getJobApplicants(selectedJob.id).map((applicant) => (
                      <div
                        key={applicant.id}
                        className="border border-border rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <Avatar>
                              <AvatarImage
                                src={`https://api.dicebear.com/7.x/initials/svg?seed=${applicant.name}`}
                              />
                              <AvatarFallback>
                                {applicant.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-2">
                              <div>
                                <h4 className="font-semibold">
                                  {applicant.name}
                                </h4>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {applicant.email}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {applicant.phone}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span>
                                  <strong>Experience:</strong>{" "}
                                  {applicant.experience}
                                </span>
                                <span>
                                  <strong>Applied:</strong>{" "}
                                  {new Date(
                                    applicant.appliedDate
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">
                                  <strong>Skills:</strong>
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {applicant.skills.map((skill, index) => (
                                    <Badge
                                      key={index}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {skill}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getApplicantStatusBadge(applicant.status)}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const url = applicant?.resume?.url || applicant?.resume;
                                if (url) window.open(url, "_blank");
                                else toast.error("No resume link available");
                              }}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Resume
                            </Button>
                            {isHR &&
                              applicant.status !== "hired" &&
                              applicant.status !== "rejected" && (
                                <div className="flex gap-1">
                                  {/* First icon: Eye -> mark as shortlisted */}
                                  {(applicant.status !== "shortlisted" && applicant.status !== "rejected" && applicant.status !== "hired") && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleApplicantAction(applicant.id, "shortlisted")}
                                      className="btn-gradient"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  )}

                                  {/* Second icon: Person/Check -> mark as hired */}
                                  {(applicant.status !== "hired" && applicant.status !== "rejected") && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleApplicantAction(applicant.id, "hired")}
                                      className="btn-gradient"
                                    >
                                      <UserCheck className="w-4 h-4" />
                                    </Button>
                                  )}

                                  {/* Third icon: Reject */}
                                  {applicant.status !== "rejected" && (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleApplicantAction(applicant.id, "rejected")}
                                    >
                                      <UserX className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No applicants for this position yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Recruitment;
