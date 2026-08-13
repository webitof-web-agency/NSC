import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import { loginUser } from "../../../store/auth/authSlice";
import type { RootState, AppDispatch } from "../../../store";
import Constants from "@constants/api";
import logoImage from "@assets/images/logo.png";
import { resolveAssetUrl } from "@utils/assetUrl";

type ForgotStep = "login" | "email" | "otp" | "reset";

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  const [forgotStep, setForgotStep] = useState<ForgotStep>("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  const { isLoading, error, isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );
  const dispatch: AppDispatch = useDispatch();
  const navigate = useNavigate();
  const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/admin/dashboard");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (forgotStep !== "email" || forgotError !== "This feature is only for Admin") {
      return;
    }

    const timer = window.setTimeout(() => {
      clearForgotFlow("login");
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [forgotError, forgotStep]);

  useEffect(() => {
    if (otpCountdown <= 0) return;

    const timer = window.setInterval(() => {
      setOtpCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [otpCountdown]);

  const clearForgotFlow = (step: ForgotStep = "login", options?: { preserveEmail?: boolean; preserveError?: boolean; preserveSuccess?: boolean }) => {
    setForgotStep(step);
    if (!options?.preserveError) setForgotError("");
    if (!options?.preserveSuccess) setForgotSuccess("");
    setOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setOtpCountdown(0);
    if (step === "login" && !options?.preserveEmail) {
      setForgotEmail("");
    }
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    const resultAction = await dispatch(loginUser({ email, password }));
    if (loginUser.fulfilled.match(resultAction)) {
      navigate("/");
    }
  };

  const requestOtp = async () => {
    setForgotError("");
    setForgotSuccess("");
    try {
      setIsForgotLoading(true);
      const response = await axios.post(Constants.ADMIN_FORGOT_PASSWORD_REQUEST_OTP_URL, {
        email: forgotEmail.trim(),
      });
      setForgotSuccess(response.data?.message || "OTP sent successfully");
      setForgotStep("otp");
      setOtpCountdown(Number(response.data?.expiresInSeconds) || 120);
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to send OTP";
      setForgotError(message);
      if (message === "This feature is only for Admin") {
        setForgotSuccess("");
      }
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await requestOtp();
  };

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");
    try {
      setIsForgotLoading(true);
      const response = await axios.post(Constants.ADMIN_FORGOT_PASSWORD_VERIFY_OTP_URL, {
        email: forgotEmail.trim(),
        otp: otp.trim(),
      });
      setForgotSuccess(response.data?.message || "OTP verified successfully");
      setForgotStep("reset");
    } catch (err: any) {
      setForgotError(err?.response?.data?.message || "Failed to verify OTP");
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");

    if (newPassword !== confirmNewPassword) {
      setForgotError("Passwords do not match");
      return;
    }

    try {
      setIsForgotLoading(true);
      const response = await axios.post(Constants.ADMIN_FORGOT_PASSWORD_RESET_URL, {
        email: forgotEmail.trim(),
        otp: otp.trim(),
        password: newPassword,
        confirmPassword: confirmNewPassword,
      });
      setForgotSuccess(response.data?.message || "Password updated successfully");
      setEmail(forgotEmail.trim());
      setPassword("");
      clearForgotFlow("login");
    } catch (err: any) {
      setForgotError(err?.response?.data?.message || "Failed to update password");
    } finally {
      setIsForgotLoading(false);
    }
  };

  const heading = useMemo(() => {
    switch (forgotStep) {
      case "email":
        return {
          title: "Forgot Password",
          subtitle: "Enter your admin email to receive OTP",
        };
      case "otp":
        return {
          title: "Verify OTP",
          subtitle: "Enter the OTP sent to your email. It is valid for 2 minutes.",
        };
      case "reset":
        return {
          title: "Set New Password",
          subtitle: "Enter and confirm your new admin password",
        };
      default:
        return {
          title: "Welcome Back",
          subtitle: "Sign in to access the dashboard",
        };
    }
  }, [forgotStep]);

  const otpCountdownLabel = useMemo(() => {
    const minutes = Math.floor(otpCountdown / 60);
    const seconds = otpCountdown % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }, [otpCountdown]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="w-full max-w-md p-6 md:p-8 bg-white rounded-xl shadow-md space-y-6">
        <div className="flex items-center justify-center gap-2">
          <img
            src={resolveAssetUrl(systemSettings?.company?.siteLogo) || logoImage}
            alt="Logo"
            className="w-32"
          />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">{heading.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{heading.subtitle}</p>
        </div>

        {forgotStep === "login" && error && (
          <div className="p-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded-lg">
            {error}
          </div>
        )}

        {forgotError && (
          <div className="p-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded-lg">
            {forgotError}
          </div>
        )}

        {forgotSuccess && (
          <div className="p-3 text-sm text-green-700 bg-green-100 border border-green-300 rounded-lg">
            {forgotSuccess}
          </div>
        )}

        {forgotStep === "login" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="Type your email address..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Type your password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  id="remember_me"
                  name="remember_me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 accent-purple-600 rounded focus:ring-purple-600"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => clearForgotFlow("email")}
                className="text-sm font-medium text-primary hover:text-primary"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 text-white font-semibold bg-primary rounded-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-600 disabled:bg-purple-400 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </form>
        )}

        {forgotStep === "email" && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700">
                Enter Your Mail
              </label>
              <input
                id="forgot-email"
                type="email"
                placeholder="Type your admin email..."
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => clearForgotFlow("login")}
                className="w-full py-2.5 font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isForgotLoading}
                className="w-full py-2.5 text-white font-semibold bg-primary rounded-md hover:bg-gray-900 disabled:bg-purple-400"
              >
                {isForgotLoading ? "Sending..." : "Continue"}
              </button>
            </div>
          </form>
        )}

        {forgotStep === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                Enter your OTP
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
                className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {otpCountdown > 0 ? `OTP expires in ${otpCountdownLabel}` : "OTP expired"}
              </span>
              <button
                type="button"
                onClick={requestOtp}
                disabled={isForgotLoading || otpCountdown > 0}
                className="font-medium text-primary disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {isForgotLoading ? "Sending..." : otpCountdown > 0 ? "Resend OTP" : "Resend OTP"}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => clearForgotFlow("email")}
                className="w-full py-2.5 font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isForgotLoading}
                className="w-full py-2.5 text-white font-semibold bg-primary rounded-md hover:bg-gray-900 disabled:bg-purple-400"
              >
                {isForgotLoading ? "Verifying..." : "Continue"}
              </button>
            </div>
          </form>
        )}

        {forgotStep === "reset" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <div className="relative mt-1">
                <input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <div className="relative mt-1">
                <input
                  id="confirm-new-password"
                  type={showConfirmNewPassword ? "text" : "password"}
                  placeholder="Confirm new password..."
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => clearForgotFlow("otp")}
                className="w-full py-2.5 font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isForgotLoading}
                className="w-full py-2.5 text-white font-semibold bg-primary rounded-md hover:bg-gray-900 disabled:bg-purple-400"
              >
                {isForgotLoading ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
