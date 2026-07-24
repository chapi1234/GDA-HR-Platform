import { useState, useRef, useEffect } from "react";
import axios from 'axios';
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Separator } from "../components/ui/separator";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building2,
  Upload,
  Eye,
  Download,
  Lock,
  Save,
  Camera,
} from "lucide-react";
import { toast } from "react-toastify";
import WorkHistoryFields from "../components/org/WorkHistoryFields";

const Profile = () => {

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

  const buttonStyle = {
    width: "200px"
  }; 

  const { user, updateProfile } = useAuth();
  const API_BASE = import.meta.env.VITE_API_URL;
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const [deptName, setDeptName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const getDepartmentName = (dept) => {
    if (!dept) return "";
    // if it's a string that looks like an ObjectId, don't return the raw id
    if (typeof dept === "string") {
      if (/^[0-9a-fA-F]{24}$/.test(dept)) return "";
      return dept; // plain name
    }
    if (typeof dept === "object" && dept.name) return dept.name;
    return "";
  };
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    address: user?.address || "",
    dateOfBirth: user?.dateOfBirth || "",
    department: getDepartmentName(user?.department),
    position: user?.position || "",
    joinDate: user?.joinDate || "",
    bio: user?.bio || "",
    skills: user?.skills || "",
    emergencyContact: user?.emergencyContact || "",
    emergencyPhone: user?.emergencyPhone || "",
    nationalId: user?.nationalId || "",
    bankName: user?.bankName || "Commercial Bank of Ethiopia",
    bankAccountName: user?.bankAccountName || user?.name || "",
    bankAccountNumber: user?.bankAccountNumber || "",
    workHistory: Array.isArray(user?.workHistory)
      ? user.workHistory.map((w) => ({
          company: w.company || "",
          position: w.position || "",
          startDate: w.startDate || "",
          endDate: w.endDate || "",
          description: w.description || "",
        }))
      : [],
  });

  useEffect(() => {
    if (!user) return;
    setProfileData((prev) => ({
      ...prev,
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      address: user.address || "",
      dateOfBirth: user.dateOfBirth || "",
      department: getDepartmentName(user.department) || user.unitPath || prev.department,
      position: user.position || "",
      joinDate: user.joinDate || "",
      bio: user.bio || "",
      skills: user.skills || "",
      emergencyContact: user.emergencyContact || "",
      emergencyPhone: user.emergencyPhone || "",
      nationalId: user.nationalId || "",
      bankName: user.bankName || "Commercial Bank of Ethiopia",
      bankAccountName: user.bankAccountName || user.name || "",
      bankAccountNumber: user.bankAccountNumber || "",
      workHistory: Array.isArray(user.workHistory)
        ? user.workHistory.map((w) => ({
            company: w.company || "",
            position: w.position || "",
            startDate: w.startDate || "",
            endDate: w.endDate || "",
            description: w.description || "",
          }))
        : prev.workHistory || [],
    }));
  }, [user]);

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Get resume from localStorage if it exists
  const [resumeFile, setResumeFile] = useState(() => {
    const savedResume = localStorage.getItem("userResume");
    return savedResume ? JSON.parse(savedResume) : null;
  });

  const [profileImage, setProfileImage] = useState(null);
  const resumeInputRef = useRef(null);

  const handleProfileUpdate = async () => {
    try {
      await updateProfile({
        ...profileData,
        bankName: profileData.bankName || "Commercial Bank of Ethiopia",
        bankAccountName: profileData.bankAccountName || profileData.name || "",
        bankAccountNumber: String(profileData.bankAccountNumber || "").trim(),
        workHistory: (profileData.workHistory || []).filter((w) =>
          String(w.company || "").trim()
        ),
      });
      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error("Failed to update profile");
    }
  };

  const { changePassword } = useAuth();

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      await changePassword(
        passwordData.currentPassword,
        passwordData.newPassword,
        passwordData.confirmPassword
      );
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      console.error("Password change failed:", err);
    }
  };

  const handleResumeUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          // Create a file info object to store
          const fileInfo = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            uploadDate: new Date().toISOString(),
            data: e.target.result, // Store file as base64
          };

          // Store file info in localStorage
          localStorage.setItem("userResume", JSON.stringify(fileInfo));

          setResumeFile(fileInfo);
          toast.success("Resume uploaded successfully!");
        };
        reader.readAsDataURL(file);
      } else {
        toast.error("Please upload a PDF file");
      }
    }
  };

  const handleViewResume = () => {
    if (!resumeFile) {
      toast.error("No resume uploaded");
      return;
    }

    // Open the PDF in a new tab
    const pdfWindow = window.open();
    pdfWindow.document.write(`
      <iframe width="100%" height="100%" src="${resumeFile.data}" frameborder="0"></iframe>
    `);
  };

  const handleDownloadResume = () => {
    if (!resumeFile) {
      toast.error("No resume uploaded");
      return;
    }

    // Create a download link
    const downloadLink = document.createElement("a");
    downloadLink.href = resumeFile.data;
    downloadLink.download = resumeFile.name;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    toast.success("Resume downloaded successfully!");
  };

  const { uploadProfileImage, user: currentUser } = useAuth();

  // Resolve department id -> name when `user.department` is an id
  useEffect(() => {
    let mounted = true;
    const dep = user?.department;
    if (!dep) return;
    // If already an object with name, use it
    if (typeof dep === 'object' && dep.name) {
      setDeptName(dep.name);
      return;
    }
    // If it's a string that's not an ObjectId, assume it's already a name
    if (typeof dep === 'string' && !/^[0-9a-fA-F]{24}$/.test(dep)) {
      setDeptName(dep);
      return;
    }
    if (typeof dep === 'string') {
      (async () => {
        try {
          const res = await axios.get(`${API_BASE}/api/departments/${dep}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!mounted) return;
          const name = res.data?.data?.name || '';
          setDeptName(name);
        } catch (err) {
          console.error('Failed to fetch department name', err);
        }
      })();
    }
    return () => { mounted = false; };
  }, [user]);

  // Keep profileData.department in sync with resolved deptName
  useEffect(() => {
    if (deptName) setProfileData(prev => ({ ...prev, department: deptName }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptName]);

  const handleProfileImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Show a local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setProfileImage(e.target.result);
    reader.readAsDataURL(file);

    // Upload to backend
    try {
      toast.info('Uploading profile image...');
      const uploaded = await uploadProfileImage(file, currentUser?.id || currentUser?._id);
      // If backend returned mapped user data with avatar, use that (persisted URL)
      if (uploaded && uploaded.avatar) {
        setProfileImage(uploaded.avatar);
        toast.success('Profile picture uploaded');
      } else {
        toast.success('Profile picture updated (preview only)');
      }
    } catch (err) {
      console.error('Failed to upload profile image', err);
      toast.error('Failed to upload profile image');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div style={marginStyle} className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
            <p className="text-muted-foreground">
              Manage your personal information and settings
            </p>
          </div>
          <Button
            style={buttonStyle}
            onClick={() => setIsEditing(!isEditing)}
            variant={isEditing ? "outline" : "default"}
            className={!isEditing ? "btn-gradient" : ""}
          >
            {isEditing ? "Cancel" : "Edit Profile"}
          </Button>
        </div>

        {/* Profile Overview */}
        <Card className="dashboard-card">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-6">
              <div className="relative flex justify-center items-center">
                <Avatar>
                  <AvatarImage
                    src={profileImage || user?.avatar}
                    alt={user?.name}
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {user?.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfileImageUpload}
                      className="hidden"
                      id="profile-image-upload"
                    />
                    <Label
                      htmlFor="profile-image-upload"
                      className="cursor-pointer"
                    >
                      <Button
                        size="sm"
                        className="absolute -bottom-2 -right-2 rounded-full w-8 h-8 p-0"
                        asChild
                      >
                        <div>
                          <Camera className="w-4 h-4" />
                        </div>
                      </Button>
                    </Label>
                  </>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{user?.name}</h2>
                <p className="text-muted-foreground">
                  {user?.position} • {user?.unitPath || deptName || getDepartmentName(user?.department) || "—"}
                </p>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge variant="secondary">
                    Employee ID: {user?.employeeId}
                  </Badge>
                  <Badge
                    variant={
                      user?.status === "active" ? "default" : "secondary"
                    }
                  >
                    {user?.status || "Active"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Tabs */}
        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="flex flex-wrap w-full gap-2">
            <TabsTrigger value="personal" className="cursor-pointer">
              Personal Info
            </TabsTrigger>
            <TabsTrigger value="work" className="cursor-pointer">
              Work History
            </TabsTrigger>
            <TabsTrigger value="security" className="cursor-pointer">
              Security
            </TabsTrigger>
            <TabsTrigger value="documents" className="cursor-pointer">
              Documents
            </TabsTrigger>
          </TabsList>

          {/* Personal Information */}
          <TabsContent value="personal" className="space-y-6">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your personal details and contact information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={profileData.name}
                      onChange={(e) =>
                        setProfileData({ ...profileData, name: e.target.value })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          email: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          phone: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={profileData.dateOfBirth}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          dateOfBirth: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={profileData.address}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        address: e.target.value,
                      })
                    }
                    disabled={!isEditing}
                    rows={2}
                    className={`min-h-[2.5rem] h-16 py-2 ${
                      isEditing ? "resize-y" : "resize-none bg-muted"
                    }`}
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <CardTitle className="text-base">Bank payment details</CardTitle>
                    <CardDescription className="mt-1">
                      Used for salary bank transfer exports (defaults to Commercial Bank of Ethiopia)
                    </CardDescription>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankAccountNumber">Bank account</Label>
                    <Textarea
                      id="bankAccountNumber"
                      placeholder="Enter your CBE account number"
                      value={profileData.bankAccountNumber}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          bankAccountNumber: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      rows={1}
                      className={`min-h-0 h-10 py-2 ${
                        isEditing ? "resize-none" : "resize-none bg-muted"
                      }`}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bankName">Bank</Label>
                      <Input
                        id="bankName"
                        value={profileData.bankName}
                        onChange={(e) =>
                          setProfileData({
                            ...profileData,
                            bankName: e.target.value,
                          })
                        }
                        disabled={!isEditing}
                        placeholder="Commercial Bank of Ethiopia"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankAccountName">Account name</Label>
                      <Input
                        id="bankAccountName"
                        value={profileData.bankAccountName}
                        onChange={(e) =>
                          setProfileData({
                            ...profileData,
                            bankAccountName: e.target.value,
                          })
                        }
                        disabled={!isEditing}
                        placeholder="Name on the account"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="department">Unit / Sector</Label>
                    <Input
                      id="department"
                      value={user?.unitPath || profileData.department || ""}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Sector / sub-sector / unit assignment (managed by HR)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      value={profileData.position}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="joinDate">Join Date</Label>
                    <Input
                      id="joinDate"
                      type="date"
                      value={profileData.joinDate}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationalId">National ID</Label>
                    <Input
                      id="nationalId"
                      placeholder="Enter your National ID"
                      value={profileData.nationalId}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          nationalId: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell us about yourself..."
                    value={profileData.bio}
                    onChange={(e) =>
                      setProfileData({ ...profileData, bio: e.target.value })
                    }
                    disabled={!isEditing}
                    rows={3}
                    className={
                      isEditing ? "resize-none" : "resize-none bg-muted"
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skills">Skills</Label>
                  <Textarea
                    id="skills"
                    placeholder="List your skills (comma separated)"
                    value={profileData.skills}
                    onChange={(e) =>
                      setProfileData({ ...profileData, skills: e.target.value })
                    }
                    disabled={!isEditing}
                    rows={2}
                    className={
                      isEditing ? "resize-none" : "resize-none bg-muted"
                    }
                  />
                </div>

                <Separator />

                <div style={marginStyle} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContact">Emergency Contact</Label>
                    <Input
                      id="emergencyContact"
                      placeholder="Emergency contact name"
                      value={profileData.emergencyContact}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          emergencyContact: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyPhone">Emergency Phone</Label>
                    <Input
                      id="emergencyPhone"
                      placeholder="Emergency contact phone"
                      value={profileData.emergencyPhone}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          emergencyPhone: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                {isEditing && (
                  <div className="flex justify-end space-x-4">
                    <Button
                    style={buttonStyle}
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                    > 
                      Cancel
                    </Button>
                    <Button
                      style={buttonStyle}
                      onClick={handleProfileUpdate}
                      className="btn-gradient"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Previous work history */}
          <TabsContent value="work" className="space-y-6">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Previous Work History</CardTitle>
                <CardDescription>
                  Employers you worked at before joining GammoDA
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <WorkHistoryFields
                  idPrefix="profile-work"
                  value={profileData.workHistory || []}
                  onChange={(workHistory) =>
                    setProfileData({ ...profileData, workHistory })
                  }
                  readOnly={!isEditing}
                />
                {isEditing && (
                  <div className="flex justify-end space-x-4">
                    <Button
                      style={buttonStyle}
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      style={buttonStyle}
                      onClick={handleProfileUpdate}
                      className="btn-gradient"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security" className="space-y-6">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        newPassword: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        confirmPassword: e.target.value,
                      })
                    }
                  />
                </div>
                <Button onClick={handlePasswordChange} className="btn-gradient">
                  <Lock className="w-4 h-4 mr-2" />
                  Change Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents" className="space-y-6">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Resume & Documents</CardTitle>
                <CardDescription>
                  Manage your resume and other important documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Upload Resume</h3>
                  <p className="text-muted-foreground mb-4">
                    Upload your latest resume (PDF format)
                  </p>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleResumeUpload}
                    className="hidden"
                    id="resume-upload"
                    ref={resumeInputRef}
                  />
                  <Button
                    className="btn-gradient"
                    onClick={() => resumeInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                  {resumeFile && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Selected: {resumeFile.name}
                    </p>
                  )}
                </div>

                {/* Current Documents */}
                <div className="space-y-4">
                  <h4 className="font-semibold">Current Documents</h4>
                  <div className="space-y-3">
                    {resumeFile ? (
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <span className="text-red-600 font-semibold text-xs">
                              PDF
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{resumeFile.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Uploaded on{" "}
                              {new Date(
                                resumeFile.uploadDate
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleViewResume}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDownloadResume}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">
                        No resume uploaded yet
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;
