"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
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

    if (mode === "login") setIsEntering(true);

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
      setIsEntering(false);
      setError(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data?.session) {
      setIsEntering(false);
      setSuccess("Success! Please check your email to verify your account.");
      setMode("login");
      return;
    }

    setIsEntering(true);
    router.push(nextPath());
  }

  return (
    <main className="min-h-screen flex font-sans selection:bg-primary/20">

      {/* ── Entering overlay ────────────────────────────── */}
      {isEntering && (
        <div
          className="fixed inset-0 z-9999 flex flex-col items-center justify-center backdrop-blur-md animate-in fade-in duration-300"
          style={{ background: "linear-gradient(135deg, #001228 0%, #002055 100%)" }}
        >
          <div className="flex flex-col items-center gap-6">
            <div className="relative flex size-16 items-center justify-center select-none">
              <Image src="/favicon.svg" alt="Scholarian Logo" width={64} height={64} className="size-16 block p-1" />
              <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-white/15 border border-white/20">
                <Loader2 className="size-3 animate-spin text-tertiary-fixed-dim" />
              </span>
            </div>
            <div className="text-center">
              <p className="font-heading text-xl font-semibold text-white">Entering Scholarian</p>
              <p className="mt-1 text-sm text-white/50">Loading your research workspace…</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 0.15, 0.3].map((delay, i) => (
                <span
                  key={i}
                  className="size-1.5 rounded-full bg-tertiary-fixed-dim/50 animate-bounce"
                  style={{ animationDelay: `${delay}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Left panel — dark navy branding ─────────────── */}
      <div
        className="hidden lg:flex lg:w-[44%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #001228 0%, #001e50 50%, #002055 100%)" }}
      >
        {/* Dot grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Radial glow */}
        <div
          className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(13,71,161,0.4) 0%, transparent 70%)" }}
        />

        {/* Logo */}
        <Link href="/" className="relative flex items-center gap-2.5 w-fit">
          <Image src="/favicon.svg" alt="Scholarian Logo" width={36} height={36} className="size-9 block p-0.5 select-none" />
          <span className="font-heading text-xl font-bold text-white">Scholarian</span>
        </Link>

        {/* Headline & Features */}
        <div className="relative">
          <h2 className="text-5xl font-heading font-bold text-white leading-tight mb-5 tracking-tight">
            Research without<br />
            <span
              style={{ fontFamily: "var(--font-playfair)", fontStyle: "italic", color: "#70d8c8" }}
            >
              boundaries
            </span>
          </h2>
          <p className="text-white/50 text-lg leading-relaxed mb-8">
            AI-powered synthesis across thousands of academic papers, in seconds.
          </p>
          <div className="space-y-3">
            {[
              "Search arXiv, Semantic Scholar & Google Scholar",
              "Synthesize findings across 2,400+ sources",
              "Refine with conversational AI follow-ups",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-white/60 text-sm">
                <CheckCircle2 className="size-4 text-tertiary-fixed-dim shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-[0.65rem] text-white/22 uppercase tracking-widest">
          © 2026 Scholarian · Precision in every insight
        </p>
      </div>

      {/* ── Right panel — form ───────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-surface relative">

        {/* Back link */}
        <div className="absolute top-6 left-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span className="text-sm font-semibold">Back</span>
          </Link>
        </div>

        <div className="w-full max-w-md" style={{ animation: "fadeInUp 0.6s ease-out both" }}>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <Image
              src="/favicon.svg"
              alt="Scholarian Logo"
              width={64}
              height={64}
              className="size-16 block p-1 select-none"
            />
          </div>

          {/* Form header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-heading font-bold text-on-surface tracking-tight mb-2">
              {mode === "login" && "Welcome back"}
              {mode === "signup" && "Start your research"}
              {mode === "forgot" && "Reset password"}
            </h1>
            <p className="text-secondary text-sm font-medium">
              {mode === "login" && "Continue your intellectual journey with Scholarian"}
              {mode === "signup" && "Create an account to begin your analytical project"}
              {mode === "forgot" && "Enter your email and we'll send a reset link"}
            </p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-3xl shadow-[0_24px_64px_-16px_rgba(0,49,120,0.12)] border border-secondary/8 overflow-hidden">
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">

                {/* Mode toggle */}
                {mode !== "forgot" && (
                  <div className="flex bg-surface p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === "login" ? "bg-white text-primary shadow-sm" : "text-secondary hover:text-primary"
                        }`}
                    >
                      SIGN IN
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === "signup" ? "bg-white text-primary shadow-sm" : "text-secondary hover:text-primary"
                        }`}
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

                {/* Full Name (signup only) */}
                {mode === "signup" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">
                      Full Name
                    </label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Smith"
                      className="bg-surface border-none h-11 px-4 rounded-xl focus-visible:ring-primary/20"
                    />
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">
                    Email Address
                  </label>
                  <Input
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="scholar@university.edu"
                    className="bg-surface border-none h-11 px-4 rounded-xl focus-visible:ring-primary/20"
                  />
                </div>

                {/* Password */}
                {mode !== "forgot" && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">
                        Password
                      </label>
                      {mode === "login" && (
                        <button
                          type="button"
                          onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
                          className="text-[10px] font-bold text-primary hover:underline"
                        >
                          FORGOT?
                        </button>
                      )}
                    </div>
                    <Input
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      placeholder="••••••••"
                      className="bg-surface border-none h-11 px-4 rounded-xl focus-visible:ring-primary/20"
                    />
                  </div>
                )}

                {/* Alerts */}
                {error && (
                  <p className="rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-xs font-semibold text-red-700">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="rounded-xl bg-green-50 border border-green-100 px-4 py-2.5 text-xs font-semibold text-green-700">
                    {success}
                  </p>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary hover:bg-primary-container text-white h-12 rounded-xl font-bold text-sm tracking-wide shadow-sm"
                >
                  {isSubmitting
                    ? "WORKING..."
                    : mode === "login"
                      ? "PROCEED TO DASHBOARD"
                      : mode === "signup"
                        ? "INITIALIZE ACCOUNT"
                        : "SEND RESET LINK"}
                </Button>
              </div>

              {/* Footer */}
              <div className="bg-surface/50 border-t border-secondary/5 px-5 sm:px-6 py-4 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2 text-secondary/50 shrink-0">
                  <ShieldCheck className="size-3.5 text-tertiary" />
                  <span className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                    Enterprise-Grade Security
                  </span>
                </div>
                <p className="text-[9px] text-secondary/50 text-center sm:text-right leading-relaxed sm:ml-auto">
                  By proceeding, you agree to Scholarian&apos;s Terms of Service and Privacy Policy.
                </p>
              </div>
            </form>
          </div>

          <p className="text-center mt-6 text-xs text-secondary/40">
            © {new Date().getFullYear()} Scholarian AI · Precision in every insight
          </p>
        </div>
      </div>
    </main>
  );
}
