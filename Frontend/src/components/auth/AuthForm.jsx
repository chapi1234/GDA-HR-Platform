import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp";
import {
  Mail,
  Lock,
  User,
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import logo from "../../assets/download.jpg";
import { toast } from "react-toastify";
const API_URL = import.meta.env.VITE_API_URL;

export const AuthForm = () => {
  const { login, signup, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("login"); // 'login', 'signup', 'forgot-email', 'forgot-code', 'forgot-password'
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState({
    login: false,
    signup: false,
    signupConfirm: false,
    forgot: false,
    forgotConfirm: false,
  });

  const togglePassword = (field) => {
    setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "employee",
    department: "",
    sectorId: "",
    subSectorId: "",
    subSubSectorId: "",
    avatar: "",
  });

  const [forgotForm, setForgotForm] = useState({
    email: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [sectors, setSectors] = useState([]); // flat sector nodes
  const [loadingSectors, setLoadingSectors] = useState(false);
  const API_BASE = API_URL;

  const fetchSectors = async () => {
    setLoadingSectors(true);
    try {
      const sectorRes = await axios.get(`${API_BASE}/api/sectors/public-list`);
      setSectors(Array.isArray(sectorRes.data?.data) ? sectorRes.data.data : []);
    } catch (err) {
      console.error(err);
      setSectors([]);
    } finally {
      setLoadingSectors(false);
    }
  };

  useEffect(() => {
    fetchSectors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootSectors = sectors.filter((s) => s.level === "sector");
  const subSectors = sectors.filter(
    (s) => s.level === "sub_sector" && String(s.parent) === String(signupForm.sectorId)
  );
  const subSubSectors = sectors.filter(
    (s) => s.level === "sub_sub_sector" && String(s.parent) === String(signupForm.subSectorId)
  );

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      navigate("/dashboard");
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (signupForm.password !== signupForm.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const leafUnitId =
        signupForm.subSubSectorId ||
        signupForm.subSectorId ||
        signupForm.sectorId ||
        undefined;
      const payload = {
        name: signupForm.name,
        email: signupForm.email,
        role: "employee",
        leafUnitId,
        sectorId: signupForm.sectorId || undefined,
        subSectorId: signupForm.subSectorId || undefined,
        subSubSectorId: signupForm.subSubSectorId || undefined,
        departmentId: leafUnitId ? undefined : signupForm.department || undefined,
        avatar: signupForm.avatar || "",
        password: signupForm.password,
        confirmPassword: signupForm.confirmPassword,
      };
      await signup(payload);
      // await signup(signupForm);
      navigate("/dashboard");
    } catch (error) {
      console.error("Signup error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/auth/forget-password`, {
        email: forgotForm.email,
      });
      toast.success(res.data.message);
      setMode("forgot-code");
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const [resetToken, setResetToken] = useState("");

  const handleCodeVerification = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/auth/verify-otp`, {
        email: forgotForm.email.trim(),
        otp: otpCode.trim(),   // ✅ make sure OTP is a string without spaces
      });
      setResetToken(res.data.resetToken);
      toast.success(res.data.message);
      setMode("forgot-password");
    } catch (err) {
      toast.success(err.response?.data?.message || "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (forgotForm.newPassword !== forgotForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/auth/reset-password`, {
        resetToken,
        newPassword: forgotForm.newPassword,
        confirmNewPassword: forgotForm.confirmPassword,
      });
      toast.success(res.data.message);
      setMode("login");
      setForgotForm({ email: "", newPassword: "", confirmPassword: "" });
      setOtpCode("");
      setResetToken("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="auth-shell min-h-screen flex items-center justify-center p-4">
      <div className="mx-auto transition-all duration-300" style={{ width: "var(--auth-form-width)" }}>
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-card rounded-full shadow-md border border-border mb-4 overflow-hidden">
            <img
              src={logo}
              alt="GammoDA Logo"
              className="w-16 h-16 object-cover"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Gamo Development Association
          </h1>
          <p className="text-muted-foreground">Human Resource Management System</p>
        </div>
        {isAuthenticated && (
          <div className="mb-4 rounded-lg border border-border bg-card p-3 text-center text-sm">
            <p className="text-muted-foreground mb-2">
              Signed in as <strong className="text-foreground">{user?.name || user?.email}</strong>
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
              Continue to dashboard
            </Button>
          </div>
        )}
        <Card className="shadow-xl border border-border bg-card" style={{ marginTop: 15 }}>
          <CardHeader className="text-center pb-4">
            {mode === "login" && (
              <>
                <CardTitle className="text-xl">Sign In</CardTitle>
                <CardDescription>Welcome back to your account</CardDescription>
              </>
            )}
            {mode === "signup" && (
              <>
                <CardTitle className="text-xl">Create Account</CardTitle>
                <CardDescription>Join our team today</CardDescription>
              </>
            )}
            {mode === "forgot-email" && (
              <>
                <CardTitle className="text-xl">Reset Password</CardTitle>
                <CardDescription>
                  Enter your email to receive a reset code
                </CardDescription>
              </>
            )}
            {mode === "forgot-code" && (
              <>
                <CardTitle className="text-xl">Verify Code</CardTitle>
                <CardDescription>
                  Enter the 6-digit code sent to your email
                </CardDescription>
              </>
            )}
            {mode === "forgot-password" && (
              <>
                <CardTitle className="text-xl">New Password</CardTitle>
                <CardDescription>Create your new password</CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Login Form */}
            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                      value={loginForm.email}
                      onChange={(e) =>
                        setLoginForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword.login ? "text" : "password"}
                      placeholder="Enter your password"
                      className="pl-10 pr-10"
                      value={loginForm.password}
                      onChange={(e) =>
                        setLoginForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePassword("login")}
                      className="absolute right-3 top-2.5 p-0.5 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword.login ? "Hide password" : "Show password"}
                    >
                      {showPassword.login ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Link */}
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setMode("forgot-email")}
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing In..." : "Sign In"}
                </Button>

                {/* Toggle to Sign Up */}
                <div className="text-center pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="text-primary hover:underline font-medium"
                    >
                      Sign up
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* Signup Form */}
            {mode === "signup" && (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      className="pl-10"
                      value={signupForm.name}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                      value={signupForm.email}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Sector</Label>
                  <Select
                    value={signupForm.sectorId}
                    onValueChange={(value) =>
                      setSignupForm((prev) => ({
                        ...prev,
                        sectorId: value,
                        subSectorId: "",
                        subSubSectorId: "",
                        department: "",
                      }))
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue
                        placeholder={
                          loadingSectors
                            ? "Loading..."
                            : rootSectors.length
                              ? "Select sector..."
                              : "No sectors (run seed)"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {rootSectors.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {signupForm.sectorId && (
                  <div className="space-y-2">
                    <Label>Sub-sector</Label>
                    <Select
                      value={signupForm.subSectorId}
                      onValueChange={(value) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          subSectorId: value,
                          subSubSectorId: "",
                        }))
                      }
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder={subSectors.length ? "Select sub-sector..." : "No sub-sectors yet"} />
                      </SelectTrigger>
                      <SelectContent>
                        {subSectors.map((s) => (
                          <SelectItem key={s._id} value={s._id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {subSubSectors.length > 0 && (
                  <div className="space-y-2">
                    <Label>Unit (sub-sub-sector)</Label>
                    <Select
                      value={signupForm.subSubSectorId}
                      onValueChange={(value) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          subSubSectorId: value,
                        }))
                      }
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select unit..." />
                      </SelectTrigger>
                      <SelectContent>
                        {subSubSectors.map((s) => (
                          <SelectItem key={s._id} value={s._id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showPassword.signup ? "text" : "password"}
                      placeholder="Create a password"
                      className="pl-10 pr-10"
                      value={signupForm.password}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePassword("signup")}
                      className="absolute right-3 top-2.5 p-0.5 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword.signup ? "Hide password" : "Show password"}
                    >
                      {showPassword.signup ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword.signupConfirm ? "text" : "password"}
                      placeholder="Confirm your password"
                      className="pl-10 pr-10"
                      value={signupForm.confirmPassword}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePassword("signupConfirm")}
                      className="absolute right-3 top-2.5 p-0.5 text-muted-foreground hover:text-foreground"
                      aria-label={
                        showPassword.signupConfirm ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword.signupConfirm ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating Account..." : "Create Account"}
                </Button>

                {/* Toggle to Sign In */}
                <div className="text-center pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="text-primary hover:underline font-medium"
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* Forgot Password - Email Step */}
            {mode === "forgot-email" && (
              <form onSubmit={handleForgotEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                      value={forgotForm.email}
                      onChange={(e) =>
                        setForgotForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Code"}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-primary"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}

            {/* Forgot Password - Code Verification */}
            {mode === "forgot-code" && (
              <form onSubmit={handleCodeVerification} className="space-y-4">
                <div className="space-y-2">
                  <Label>Verification Code</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      value={otpCode}
                      onChange={setOtpCode}
                      maxLength={6}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {/* <p className="text-xs text-center text-muted-foreground">
                    Demo code: 123456
                  </p> */}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={otpCode.length !== 6}
                >
                  Verify Code
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode("forgot-email")}
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-primary"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Email
                  </button>
                </div>
              </form>
            )}

            {/* Forgot Password - New Password */}
            {mode === "forgot-password" && (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showPassword.forgot ? "text" : "password"}
                      placeholder="Enter new password"
                      className="pl-10 pr-10"
                      value={forgotForm.newPassword}
                      onChange={(e) =>
                        setForgotForm((prev) => ({
                          ...prev,
                          newPassword: e.target.value,
                        }))
                      }
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePassword("forgot")}
                      className="absolute right-3 top-2.5 p-0.5 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword.forgot ? "Hide password" : "Show password"}
                    >
                      {showPassword.forgot ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirm-new-password"
                      type={showPassword.forgotConfirm ? "text" : "password"}
                      placeholder="Confirm new password"
                      className="pl-10 pr-10"
                      value={forgotForm.confirmPassword}
                      onChange={(e) =>
                        setForgotForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePassword("forgotConfirm")}
                      className="absolute right-3 top-2.5 p-0.5 text-muted-foreground hover:text-foreground"
                      aria-label={
                        showPassword.forgotConfirm ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword.forgotConfirm ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
