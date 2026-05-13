import { FormEvent, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useAction } from "convex/react";
import { Navigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const ensureProfile = useMutation(api.users.ensureProfile);
  const resetPasswordWithCode = useAction(api.passwordReset.resetPasswordWithCode);

  const [flow, setFlow] = useState<"signIn" | "signUp" | "reset">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Offline: if the user was previously authenticated, bypass the login page entirely.
  if (!navigator.onLine && localStorage.getItem("frc_was_authenticated") === "1")
    return <Navigate to="/" replace />;

  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      if (flow === "reset") {
        await resetPasswordWithCode({ email, code: resetCode, newPassword });
        setSuccess("Password reset! You can now sign in.");
        setFlow("signIn");
        setResetCode("");
        setNewPassword("");
      } else {
        await signIn("password", { email, password, flow });
        await ensureProfile({ displayName: displayName || email.split("@")[0] });
      }
    } catch (err: any) {
      setError(err.message ?? "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚙</div>
          <h1 className="text-2xl font-bold text-slate-100">FRC Scout</h1>
          <p className="text-slate-400 text-sm mt-1">Team 2928 Scouting App</p>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          {flow !== "reset" && (
            <div className="flex rounded-lg bg-slate-800 p-1 mb-6">
              {(["signIn", "signUp"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setFlow(f); setError(""); setSuccess(""); }}
                  className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    flow === f
                      ? "bg-slate-700 text-slate-100"
                      : "text-slate-400 hover:text-slate-300"
                  }`}
                >
                  {f === "signIn" ? "Sign In" : "Register"}
                </button>
              ))}
            </div>
          )}

          {flow === "reset" && (
            <div className="mb-6">
              <h2 className="text-slate-100 font-semibold text-center">Reset Password</h2>
              <p className="text-xs text-slate-400 text-center mt-1">Enter the code your admin provided</p>
            </div>
          )}

          {success && (
            <p className="text-green-400 text-sm bg-green-900/20 rounded-lg px-3 py-2 mb-4">
              {success}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {flow === "signUp" && (
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="you@example.com"
              />
            </div>
            {flow !== "reset" && (
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>
            )}
            {flow === "reset" && (
              <>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Reset Code</label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 font-mono tracking-widest"
                    placeholder="XXXXXXXX"
                    maxLength={8}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder="At least 8 characters"
                  />
                </div>
              </>
            )}

            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Spinner size="sm" />
              ) : flow === "signIn" ? (
                "Sign In"
              ) : flow === "signUp" ? (
                "Create Account"
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>

          {flow !== "reset" ? (
            <p className="text-center text-xs text-slate-500 mt-4">
              <button
                onClick={() => { setFlow("reset"); setError(""); setSuccess(""); }}
                className="text-slate-400 hover:text-slate-200 underline"
              >
                Have a reset code?
              </button>
            </p>
          ) : (
            <p className="text-center text-xs text-slate-500 mt-4">
              <button
                onClick={() => { setFlow("signIn"); setError(""); }}
                className="text-slate-400 hover:text-slate-200 underline"
              >
                Back to sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
