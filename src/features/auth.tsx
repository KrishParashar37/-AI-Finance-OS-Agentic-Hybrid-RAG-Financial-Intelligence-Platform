"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye, EyeOff, Loader2, Mail, MailCheck,
  ScanLine, ShieldCheck, TrendingUp, Zap, Lock,
} from "lucide-react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence
} from "firebase/auth";
import { Field } from "@/components/forms";
import { useToast } from "@/components/feedback";
import { StrengthMeter } from "@/features/settings";
import { auth } from "@/lib/firebase";

const EMAIL = /^\S+@\S+\.\S+$/;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ── Google icon ─────────────────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/* ── Firebase error messages ─────────────────────────────────────────────── */
function firebaseMsg(code: string): string {
  const map: Record<string, string> = {
    "auth/user-not-found":          "No account found with this email.",
    "auth/wrong-password":          "Incorrect password. Try again.",
    "auth/invalid-credential":      "Incorrect email or password.",
    "auth/email-already-in-use":    "This email is already registered. Sign in instead.",
    "auth/weak-password":           "Password must be at least 6 characters.",
    "auth/popup-closed-by-user":    "Sign-in popup was closed.",
    "auth/cancelled-popup-request": "Another popup is already open.",
    "auth/popup-blocked":           "Popup was blocked. Allow popups for this site and try again.",
    "auth/network-request-failed":  "Network error. Check your connection.",
    "auth/too-many-requests":       "Too many attempts. Please wait a moment.",
    "auth/operation-not-allowed":   "Google sign-in not enabled. Enable it in Firebase Console.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}

/* ── Reusable small components ───────────────────────────────────────────── */
function PasswordInput({ value, onChange, label = "Password", autoComplete, placeholder }: {
  value: string; onChange: (v: string) => void; label?: string; autoComplete?: string; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label}>
      <div className="relative">
        <input
          className="input !pr-11"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder ?? "••••••••"}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
}

function Divider() {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-200 dark:border-white/10" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-white px-3 text-slate-400 dark:bg-slate-950">or continue with email</span>
      </div>
    </div>
  );
}

function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button className="btn btn-primary w-full !py-3 text-sm font-semibold" disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function AuthCard({ title, subtitle, children, footer }: {
  title: string; subtitle: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
      <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-7">{children}</div>
      {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
    </div>
  );
}

/* ── LOGIN ───────────────────────────────────────────────────────────────── */
export function Login() {
  const router = useRouter();
  const toast  = useToast();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [busy,     setBusy]     = useState(false);
  const [gBusy,    setGBusy]    = useState(false);
  const [checking, setChecking] = useState(true);
  const [remember, setRemember] = useState(false);

  // If already logged in → go straight to dashboard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/overview");
      } else {
        setChecking(false);
      }
    });
    return () => unsub();
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const validate = () => {
    const er: Record<string, string> = {};
    if (!EMAIL.test(email))    er.email    = "Enter a valid email address";
    if (password.length < 6)   er.password = "Password must be at least 6 characters";
    setErrors(er);
    return !Object.keys(er).length;
  };

  const signInEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Welcome back! 🎉");
      router.push("/overview");
    } catch (err: unknown) {
      toast.error(firebaseMsg((err as { code?: string }).code ?? ""));
      setBusy(false);
    }
  };

  const signInGoogle = async () => {
    setGBusy(true);
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      toast.success("Welcome back! 🎉");
      router.push("/overview");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        toast.error(firebaseMsg(code));
      }
      setGBusy(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your AI Finance OS"
      footer={<>New here? <Link href="/signup" className="font-semibold text-indigo-500 hover:underline">Create an account</Link></>}
    >
      {/* Google — primary */}
      <button
        type="button"
        onClick={signInGoogle}
        disabled={gBusy}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
      >
        {gBusy ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : <GoogleIcon />}
        Continue with Google
      </button>

      <Divider />

      {/* Email / password form */}
      <form onSubmit={signInEmail} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email}>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </Field>

        <div className="space-y-1">
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            placeholder="Your password"
          />
          {errors.password && <p className="text-xs text-rose-500">{errors.password}</p>}
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-slate-600 dark:text-slate-400">
            <input 
              type="checkbox" 
              className="accent-indigo-500" 
              checked={remember} 
              onChange={(e) => setRemember(e.target.checked)} 
            />
            Remember me
          </label>
          <Link href="/forgot-password" className="font-medium text-indigo-500 hover:underline">
            Forgot password?
          </Link>
        </div>

        <Submit busy={busy}>
          <Lock className="h-4 w-4" />
          Sign in
        </Submit>
      </form>
    </AuthCard>
  );
}

/* ── SIGNUP ──────────────────────────────────────────────────────────────── */
export function Signup() {
  const router = useRouter();
  const toast  = useToast();
  const [f, setF]       = useState({ name: "", email: "", password: "", confirm: "", terms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy,  setBusy]    = useState(false);
  const [gBusy, setGBusy]   = useState(false);

  const signUpEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.name.trim())          er.name    = "Tell us your name";
    if (!EMAIL.test(f.email))    er.email   = "Enter a valid email address";
    if (f.password.length < 8)   er.password = "Use at least 8 characters";
    if (f.confirm !== f.password) er.confirm = "Passwords don't match";
    if (!f.terms)                er.terms   = "Please accept the terms";
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await createUserWithEmailAndPassword(auth, f.email, f.password);
      toast.success("Account created! Welcome aboard 🎉");
      router.push("/overview");
    } catch (err: unknown) {
      toast.error(firebaseMsg((err as { code?: string }).code ?? ""));
      setBusy(false);
    }
  };

  const signUpGoogle = async () => {
    setGBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      toast.success("Account created! Welcome aboard 🎉");
      router.push("/overview");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        toast.error(firebaseMsg(code));
      }
      setGBusy(false);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Scan. Understand. Predict. Save."
      footer={<>Already registered? <Link href="/login" className="font-semibold text-indigo-500 hover:underline">Sign in</Link></>}
    >
      <button
        type="button"
        onClick={signUpGoogle}
        disabled={gBusy}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
      >
        {gBusy ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : <GoogleIcon />}
        Sign up with Google
      </button>

      <Divider />

      <form onSubmit={signUpEmail} className="space-y-4" noValidate>
        <Field label="Full name" error={errors.name}>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" placeholder="Krish Sharma" />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" placeholder="you@example.com" />
        </Field>
        <div>
          <PasswordInput value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" placeholder="Min. 8 characters" />
          <StrengthMeter value={f.password} />
          {errors.password && <p className="mt-1 text-xs text-rose-500">{errors.password}</p>}
        </div>
        <Field label="Confirm password" error={errors.confirm}>
          <input className="input" type="password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} autoComplete="new-password" placeholder="Repeat password" />
        </Field>
        <div>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input type="checkbox" className="mt-0.5 accent-indigo-500" checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} />
            I agree to the <span className="text-indigo-500">Terms of Service</span> and <span className="text-indigo-500">Privacy Policy</span>
          </label>
          {errors.terms && <p className="mt-1 text-xs text-rose-500">{errors.terms}</p>}
        </div>
        <Submit busy={busy}>Create account</Submit>
      </form>
    </AuthCard>
  );
}

/* ── FORGOT PASSWORD ─────────────────────────────────────────────────────── */
export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent,  setSent]  = useState(false);
  const [busy,  setBusy]  = useState(false);

  if (sent)
    return (
      <AuthCard title="Check your inbox" subtitle={`Reset link sent to ${email}`} footer={<Link href="/login" className="font-semibold text-indigo-500">Back to sign in</Link>}>
        <div className="space-y-4 text-center">
          <span className="bg-grad mx-auto grid h-16 w-16 place-items-center rounded-2xl text-white"><MailCheck className="h-8 w-8" /></span>
          <p className="text-sm text-slate-500">The link expires in 30 minutes. Check your spam folder too.</p>
        </div>
      </AuthCard>
    );

  return (
    <AuthCard title="Forgot password?" subtitle="Enter your email and we'll send a reset link" footer={<Link href="/login" className="font-semibold text-indigo-500">Back to sign in</Link>}>
      <form className="space-y-4" noValidate onSubmit={async (e) => {
        e.preventDefault();
        if (!EMAIL.test(email)) return setError("Enter a valid email address");
        setError(""); setBusy(true);
        try { await sendPasswordResetEmail(auth, email); setSent(true); }
        catch (err: unknown) { setError(firebaseMsg((err as { code?: string }).code ?? "")); setBusy(false); }
      }}>
        <Field label="Email" error={error}>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input !pl-10" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
          </div>
        </Field>
        <Submit busy={busy}>Send reset link</Submit>
      </form>
    </AuthCard>
  );
}

/* ── RESET PASSWORD ──────────────────────────────────────────────────────── */
export function ResetPassword() {
  const router = useRouter();
  const toast  = useToast();
  const [p, setP] = useState(""); const [c, setC] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <AuthCard title="Set a new password" subtitle="Choose a strong password you haven't used before">
      <form className="space-y-4" noValidate onSubmit={async (e) => {
        e.preventDefault();
        if (p.length < 8) return setError("Use at least 8 characters");
        if (p !== c) return setError("Passwords don't match");
        setError(""); setBusy(true); await sleep(700);
        toast.success("Password updated — please sign in"); router.push("/login");
      }}>
        <div><PasswordInput value={p} onChange={setP} label="New password" autoComplete="new-password" /><StrengthMeter value={p} /></div>
        <Field label="Confirm password" error={error}><input className="input" type="password" value={c} onChange={(e) => setC(e.target.value)} autoComplete="new-password" /></Field>
        <Submit busy={busy}>Update password</Submit>
      </form>
    </AuthCard>
  );
}

/* ── OTP / 2FA ───────────────────────────────────────────────────────────── */
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  const set = (i: number, d: string) => { const arr = [...digits]; arr[i] = d; onChange(arr.join("")); if (d && i < 5) refs.current[i + 1]?.focus(); };
  return (
    <div className="flex justify-center gap-2" onPaste={(e) => { const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); if (t) { e.preventDefault(); onChange(t); refs.current[Math.min(5, t.length)]?.focus(); } }}>
      {digits.map((d, i) => <input key={i} ref={(el) => { refs.current[i] = el; }} className="input !w-12 !px-0 text-center !text-xl font-semibold" inputMode="numeric" maxLength={1} value={d} aria-label={`Digit ${i + 1}`} onChange={(e) => set(i, e.target.value.replace(/\D/g, "").slice(-1))} onKeyDown={(e) => e.key === "Backspace" && !d && i > 0 && refs.current[i - 1]?.focus()} autoFocus={i === 0} />)}
    </div>
  );
}

function CodeScreen({ title, subtitle, icon: Icon, footer, backup }: { title: string; subtitle: string; icon: typeof ShieldCheck; footer?: ReactNode; backup?: boolean }) {
  const router = useRouter(); const toast = useToast();
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [wait, setWait] = useState(30);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);
  return (
    <AuthCard title={title} subtitle={subtitle} footer={footer}>
      <form className="space-y-6" onSubmit={async (e) => { e.preventDefault(); if (code.length !== 6) return toast.error("Enter the 6-digit code"); setBusy(true); await sleep(600); toast.success("Verified"); router.push("/overview"); }}>
        <span className="bg-grad mx-auto grid h-16 w-16 place-items-center rounded-2xl text-white"><Icon className="h-8 w-8" /></span>
        <OtpInput value={code} onChange={setCode} />
        <Submit busy={busy}>Verify</Submit>
        <p className="text-center text-sm text-slate-500">{wait > 0 ? `Resend in ${wait}s` : <button type="button" className="font-semibold text-indigo-500" onClick={() => { setWait(30); toast.info("New code sent"); }}>Resend code</button>}{backup && <> · <button type="button" className="font-semibold text-indigo-500" onClick={() => toast.info("Backup codes in Settings → Security")}>Use backup code</button></>}</p>
      </form>
    </AuthCard>
  );
}

export const VerifyEmail = () => <CodeScreen title="Verify your email" subtitle="Enter the 6-digit code we emailed you" icon={MailCheck} footer={<Link href="/login" className="font-semibold text-indigo-500">Back to sign in</Link>} />;
export const TwoFactor  = () => <CodeScreen title="Two-factor authentication" subtitle="Enter the code from your authenticator app" icon={ShieldCheck} backup footer={<Link href="/login" className="font-semibold text-indigo-500">Use a different account</Link>} />;

/* ── AUTH BRAND (left panel) ─────────────────────────────────────────────── */
export function AuthBrand() {
  const features = [
    { icon: Zap,         text: "Snap a receipt — data extracted in seconds" },
    { icon: ShieldCheck, text: "Fraud, duplicates & anomaly detection" },
    { icon: TrendingUp,  text: "Forecast next month before it happens" },
  ];
  return (
    <div className="bg-grad relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
      {/* Decorative blobs */}
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-black/15 blur-3xl" />

      {/* Logo */}
      <div className="relative flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-sm">
          <ScanLine className="h-6 w-6" />
        </span>
        <span className="text-xl font-bold tracking-tight">AI Finance OS</span>
      </div>

      {/* Headline */}
      <div className="relative">
        <h2 className="text-4xl font-bold leading-snug">
          Scan. Understand.<br />Predict. Save.
        </h2>
        <p className="mt-4 max-w-sm text-[15px] text-white/75">
          Intelligent personal finance — receipt OCR, smart budgets, anomaly detection
          and an AI assistant that knows your actual numbers.
        </p>

        {/* Feature list */}
        <ul className="mt-8 space-y-4">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-white/90">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/15">
                <Icon className="h-4 w-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>

        {/* Mini stat strip */}
        <div className="mt-10 flex gap-6 text-white/80">
          {[["14 mo", "transaction history"], ["AI", "powered insights"], ["100%", "your data"]].map(([val, label]) => (
            <div key={label}>
              <p className="text-2xl font-bold text-white">{val}</p>
              <p className="text-xs">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="relative text-xs text-white/40">
        Next.js · MySQL · Firebase Auth · AI/OCR pipeline
      </p>
    </div>
  );
}
