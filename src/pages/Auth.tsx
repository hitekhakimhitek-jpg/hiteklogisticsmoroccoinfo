import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, LogIn, ArrowLeft, MailCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const ALLOWED_DOMAIN = "hitek.ma";
// Always send users to the live site — the preview URL is gated by Lovable and breaks the email link.
const SITE_URL = "https://hiteklogisticsmoroccoinfo.lovable.app/";

export default function AuthPage() {
  const { lang } = useLanguage();
  const [step, setStep] = useState<"email" | "sent">("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const t = {
    back: lang === "fr" ? "Retour au tableau de bord" : "Back to dashboard",
    title: lang === "fr" ? "Se connecter" : "Sign in",
    subtitle:
      lang === "fr"
        ? `Entrez votre adresse @${ALLOWED_DOMAIN} — nous vous enverrons un lien pour vous connecter.`
        : `Enter your @${ALLOWED_DOMAIN} email — we'll send you a sign-in link.`,
    workEmail: lang === "fr" ? "Email professionnel" : "Work email",
    sendLink: lang === "fr" ? "Envoyer le lien" : "Send link",
    onlyDomain:
      lang === "fr"
        ? `Seules les adresses @${ALLOWED_DOMAIN} sont autorisées.`
        : `Only @${ALLOWED_DOMAIN} email addresses are allowed.`,
    sent: lang === "fr" ? "Lien de connexion envoyé — vérifiez votre boîte mail." : "Sign-in link sent — check your email.",
    checkEmail: lang === "fr" ? "Vérifiez votre email" : "Check your email",
    sentBody:
      lang === "fr"
        ? "Un lien a été envoyé à"
        : "A link has been sent to",
    sentTail:
      lang === "fr"
        ? ". Cliquez dessus pour vous connecter et modifier le tableau de bord à votre convenance."
        : ". Be sure to click it to sign in and be able to modify the dashboard as you'd like.",
    differentEmail: lang === "fr" ? "Utiliser une autre adresse" : "Use a different email",
  };

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    const domain = normalized.split("@")[1];
    if (domain !== ALLOWED_DOMAIN) {
      toast.error(t.onlyDomain);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: { shouldCreateUser: true, emailRedirectTo: SITE_URL },
      });
      if (error) throw error;
      setEmail(normalized);
      setStep("sent");
      toast.success(t.sent);
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
        <ArrowLeft className="w-3 h-3" /> {t.back}
      </Link>
      {step === "email" ? (
        <form onSubmit={sendLink} className="w-full max-w-sm bg-card border border-border rounded-xl p-6 space-y-4 shadow">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <LogIn className="w-5 h-5 text-primary" /> {t.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t.subtitle}</p>
          </div>
          <div>
            <Label htmlFor="email">{t.workEmail}</Label>
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
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} {t.sendLink}
          </Button>
        </form>
      ) : (
        <div className="w-full max-w-sm bg-card border border-border rounded-xl p-6 space-y-4 shadow">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <MailCheck className="w-5 h-5 text-primary" /> {t.checkEmail}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {t.sentBody} <span className="font-medium">{email}</span>{t.sentTail}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep("email")}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> {t.differentEmail}
          </button>
        </div>
      )}
      </div>
    </div>
  );
}