import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, LogIn, ArrowLeft } from "lucide-react";

const ALLOWED_DOMAIN = "hitek.ma";

export default function AuthPage() {
  const nav = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    const domain = normalized.split("@")[1];
    if (domain !== ALLOWED_DOMAIN) {
      toast.error(`Only @${ALLOWED_DOMAIN} email addresses are allowed.`);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      setEmail(normalized);
      setStep("code");
      toast.success("We sent a 6-digit code to your email.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      const userEmail = data.user?.email?.toLowerCase() ?? "";
      if (!userEmail.endsWith(`@${ALLOWED_DOMAIN}`)) {
        await supabase.auth.signOut();
        throw new Error(`Only @${ALLOWED_DOMAIN} accounts can sign in.`);
      }
      toast.success("Signed in");
      nav("/");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm space-y-3">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Back to dashboard
      </Link>
      {step === "email" ? (
        <form onSubmit={sendCode} className="w-full max-w-sm bg-card border border-border rounded-xl p-6 space-y-4 shadow">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <LogIn className="w-5 h-5 text-primary" /> Sign in
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your <span className="font-medium">@{ALLOWED_DOMAIN}</span> email — we'll send you a 6-digit code.
            </p>
          </div>
          <div>
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              placeholder={`you@${ALLOWED_DOMAIN}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Send code
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="w-full max-w-sm bg-card border border-border rounded-xl p-6 space-y-4 shadow">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <LogIn className="w-5 h-5 text-primary" /> Enter code
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              We sent a 6-digit code to <span className="font-medium">{email}</span>.
            </p>
          </div>
          <div>
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || code.length < 6}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Verify & sign in
          </Button>
          <button
            type="button"
            onClick={() => { setStep("email"); setCode(""); }}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> Use a different email
          </button>
        </form>
      )}
      </div>
    </div>
  );
}