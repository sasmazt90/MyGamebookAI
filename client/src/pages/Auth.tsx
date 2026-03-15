import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function GamebookLogo() {
  return (
    <a href="/" className="flex items-center gap-2 no-underline">
      <div className="w-10 h-10 rounded-lg bg-[#F59E0B] flex items-center justify-center flex-shrink-0">
        <BookOpen className="text-white w-5 h-5" />
      </div>
      <span className="text-2xl font-bold text-white">
        GAMEBOOK <span className="text-[#A855F7]">AI</span>
      </span>
    </a>
  );
}

type Tab = "login" | "register";

export default function Auth() {
  const [location, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>(location === "/register" ? "register" : "login");

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("Welcome back!");
      navigate("/");
    },
    onError: (err) => {
      toast.error(err.message || "Login failed. Please check your credentials.");
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("Account created! Welcome to Gamebook AI.");
      navigate("/onboarding");
    },
    onError: (err) => {
      toast.error(err.message || "Registration failed. Please try again.");
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    loginMutation.mutate({ email: loginEmail.trim(), password: loginPassword });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) return;
    if (regPassword !== regConfirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (regPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    registerMutation.mutate({
      name: regName.trim(),
      email: regEmail.trim(),
      password: regPassword,
    });
  };

  return (
    <div className="min-h-screen bg-[#0D0B1A] flex flex-col items-center justify-center p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-purple-900/10 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <GamebookLogo />
        </div>

        {/* Card */}
        <div className="bg-[#1A1033] border border-purple-900/40 rounded-2xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-purple-900/40">
            <button
              onClick={() => setTab("login")}
              className={cn(
                "flex-1 py-4 text-sm font-semibold transition-colors",
                tab === "login"
                  ? "text-white bg-[#7C3AED]/20 border-b-2 border-[#7C3AED]"
                  : "text-gray-400 hover:text-gray-200"
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => setTab("register")}
              className={cn(
                "flex-1 py-4 text-sm font-semibold transition-colors",
                tab === "register"
                  ? "text-white bg-[#7C3AED]/20 border-b-2 border-[#7C3AED]"
                  : "text-gray-400 hover:text-gray-200"
              )}
            >
              Create Account
            </button>
          </div>

          <div className="p-8">
            {tab === "login" ? (
              /* ── Login Form ── */
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="text-center mb-6">
                  <h1 className="text-xl font-bold text-white">Welcome back</h1>
                  <p className="text-gray-400 text-sm mt-1">Sign in to your Gamebook AI account</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm">Email</Label>
                  <Input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="bg-[#0D0B1A] border-purple-900/50 text-white placeholder:text-gray-600 focus:border-[#7C3AED]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm">Password</Label>
                  <div className="relative">
                    <Input
                      type={showLoginPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      className="bg-[#0D0B1A] border-purple-900/50 text-white placeholder:text-gray-600 focus:border-[#7C3AED] pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold py-3 text-base"
                >
                  {loginMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in...</>
                  ) : (
                    "Sign In"
                  )}
                </Button>

                <p className="text-center text-sm text-gray-400">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("register")}
                    className="text-[#A855F7] hover:text-purple-300 underline"
                  >
                    Create one
                  </button>
                </p>
              </form>
            ) : (
              /* ── Register Form ── */
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="text-center mb-6">
                  <h1 className="text-xl font-bold text-white">Create your account</h1>
                  <p className="text-gray-400 text-sm mt-1">Join thousands of gamebook authors</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm">Display Name</Label>
                  <Input
                    type="text"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="Your full name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={50}
                    className="bg-[#0D0B1A] border-purple-900/50 text-white placeholder:text-gray-600 focus:border-[#7C3AED]"
                  />
                  <p className="text-xs text-gray-500">This is your account name (2–50 characters)</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm">Email</Label>
                  <Input
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="bg-[#0D0B1A] border-purple-900/50 text-white placeholder:text-gray-600 focus:border-[#7C3AED]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm">Password</Label>
                  <div className="relative">
                    <Input
                      type={showRegPassword ? "text" : "password"}
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className="bg-[#0D0B1A] border-purple-900/50 text-white placeholder:text-gray-600 focus:border-[#7C3AED] pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      type={showRegConfirm ? "text" : "password"}
                      value={regConfirm}
                      onChange={e => setRegConfirm(e.target.value)}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      required
                      className={cn(
                        "bg-[#0D0B1A] border-purple-900/50 text-white placeholder:text-gray-600 focus:border-[#7C3AED] pr-10",
                        regConfirm && regConfirm !== regPassword && "border-red-500/70"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                    >
                      {showRegConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {regConfirm && regConfirm !== regPassword && (
                    <p className="text-xs text-red-400">Passwords do not match</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-black font-semibold py-3 text-base"
                >
                  {registerMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating account...</>
                  ) : (
                    "Create Account"
                  )}
                </Button>

                <p className="text-center text-sm text-gray-400">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("login")}
                    className="text-[#A855F7] hover:text-purple-300 underline"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-600 mt-6">
          By continuing, you agree to our{" "}
          <a href="/privacy-policy" className="text-gray-500 hover:text-gray-300 underline">Privacy Policy</a>
          {" "}and{" "}
          <a href="/legal-notice" className="text-gray-500 hover:text-gray-300 underline">Terms of Service</a>.
        </p>
      </div>
    </div>
  );
}
