import { Link } from "react-router-dom";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

/**
 * Global top bar shown on every page. Hosts the language toggle and
 * the auth control so users can switch language / sign in from anywhere.
 */
export function TopBar() {
  const { lang, toggle: toggleLang } = useLanguage();
  const { user, signOut } = useAuth();

  return (
    <div className="flex items-center justify-end gap-2 px-4 sm:px-6 lg:px-8 py-2 border-b border-border bg-background/60 backdrop-blur">
      {user ? (
        <Button variant="outline" size="sm" className="h-8" onClick={() => signOut()}>
          <LogOut className="w-3.5 h-3.5 mr-1" /> {user.email}
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link to="/auth">
            <LogIn className="w-3.5 h-3.5 mr-1" />
            {lang === "fr" ? "Se connecter" : "Login"}
          </Link>
        </Button>
      )}
      <button
        onClick={toggleLang}
        aria-label="Toggle language"
        className="h-8 px-3 text-xs rounded-md border border-border bg-card text-card-foreground hover:bg-accent transition-colors font-semibold"
      >
        {lang === "en" ? "Français" : "English"}
      </button>
    </div>
  );
}