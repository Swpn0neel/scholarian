"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Sparkles, 
  ArrowLeft, 
  Mail, 
  ShieldCheck,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  function nextPath() {
    if (typeof window === "undefined") return "/dashboard";
    return new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    const supabase = createClient();

    if (mode === "forgot") {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      setIsSubmitting(false);
      if (resetError) {
        setError(resetError.message);
      } else {
        setSuccess("Check your email for a password reset link.");
      }
      return;
    }

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
          });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data?.session) {
      setSuccess("Success! Please check your email to verify your account.");
      setMode("login");
      return;
    }

    router.push(nextPath());
  }

  async function handleOAuth(provider: "github" | "google") {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}` },
    });
  }

  return (
    <main className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-primary/20">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-tertiary-fixed-dim/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] grayscale" />
      </div>

      {/* Header / Logo */}
      <div className="absolute top-8 left-8">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-white shadow-sm rounded-lg flex items-center justify-center text-primary group-hover:shadow-md transition-all">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-secondary">Back to Home</span>
        </Link>
      </div>

      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary rounded-2xl text-white mb-6 shadow-ambient">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-on-surface mb-2 tracking-tight">
            {mode === "login" && "Welcome Back"}
            {mode === "signup" && "Start your Research"}
            {mode === "forgot" && "Reset Password"}
          </h1>
          <p className="text-secondary text-sm font-medium">
            {mode === "login" && "Continue your intellectual journey with Scholarian"}
            {mode === "signup" && "Create an account to begin your analytical project"}
            {mode === "forgot" && "Enter your email and we'll send a reset link"}
          </p>
        </div>

        <Card className="border-none shadow-ambient-lg bg-white overflow-hidden rounded-3xl">
          <form onSubmit={handleSubmit}>
          <CardHeader className="pb-4">
            {mode !== "forgot" && (
              <div className="flex bg-surface p-1 rounded-xl">
                <button 
                  type="button"
                  onClick={() => setMode("login")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === "login" ? "bg-white text-primary shadow-sm" : "text-secondary hover:text-primary"}`}
                >
                  SIGN IN
                </button>
                <button 
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === "signup" ? "bg-white text-primary shadow-sm" : "text-secondary hover:text-primary"}`}
                >
                  CREATE ACCOUNT
                </button>
              </div>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                className="text-xs font-bold text-primary hover:underline text-left"
              >
                ← Back to Sign In
              </button>
            )}
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            
            {mode === "signup" && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Full Name</label>
                <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="John Doe" className="bg-surface border-none h-11 px-4 rounded-xl focus-visible:ring-primary/20" />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Email Address</label>
              <Input required value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="scholar@university.edu" className="bg-surface border-none h-11 px-4 rounded-xl focus-visible:ring-primary/20" />
            </div>

            {mode !== "forgot" && (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Password</label>
                  {mode === "login" && (
                    <button type="button" onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }} className="text-[10px] font-bold text-primary hover:underline">
                      FORGOT?
                    </button>
                  )}
                </div>
                <Input required value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="••••••••" className="bg-surface border-none h-11 px-4 rounded-xl focus-visible:ring-primary/20" />
              </div>
            )}

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
            {success && <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">{success}</p>}



            <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary-container text-white h-12 rounded-xl font-bold text-sm tracking-wide mt-2 shadow-sm">
              {isSubmitting
                ? "WORKING..."
                : mode === "login"
                ? "PROCEED TO DASHBOARD"
                : mode === "signup"
                ? "INITIALIZE ACCOUNT"
                : "SEND RESET LINK"}
            </Button>

            {mode !== "forgot" && (
              <>
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-secondary/10" />
                  </div>
                  <div className="relative flex justify-center text-[10px] font-bold tracking-widest uppercase">
                    <span className="bg-white px-3 text-secondary/40">Or continue with</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleOAuth("github")}
                    className="bg-white border border-secondary/10 hover:bg-surface h-11 rounded-xl text-xs font-bold text-secondary gap-2"
                  >
                  <GitBranch className="w-4 h-4" /> GITHUB
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleOAuth("google")}
                    className="bg-white border border-secondary/10 hover:bg-surface h-11 rounded-xl text-xs font-bold text-secondary gap-2"
                  >
                    <Mail className="w-4 h-4" /> GOOGLE
                  </Button>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="bg-surface/50 border-t border-secondary/5 py-4 flex flex-col gap-3">
             <div className="flex items-center gap-2 opacity-60">
                <ShieldCheck className="w-3.5 h-3.5 text-tertiary" />
                <span className="text-[10px] font-bold text-secondary tracking-wide uppercase">Enterprise-Grade Security Enforced</span>
             </div>
             <p className="text-[9px] text-secondary text-center px-6 leading-relaxed">
               By proceeding, you agree to Scholarian's{" "}
               <Link href="/terms" className="text-primary underline">Terms of Service</Link>{" "}
               and{" "}
               <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>.
             </p>
          </CardFooter>
          </form>
        </Card>

        <p className="text-center mt-8 text-xs font-medium text-secondary/60">
          © {new Date().getFullYear()} Scholarian AI. Precision in every insight.
        </p>
      </div>
    </main>
  );
}
