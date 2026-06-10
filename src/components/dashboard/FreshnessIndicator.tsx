import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

function formatRelative(date: Date, lang: "en" | "fr"): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (lang === "fr") {
    if (diff < 60) return "à l'instant";
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} minute(s)`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} heure(s)`;
    return `il y a ${Math.floor(diff / 86400)} jour(s)`;
  }
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} minute${Math.floor(diff / 60) === 1 ? "" : "s"} ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) === 1 ? "" : "s"} ago`;
  return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) === 1 ? "" : "s"} ago`;
}

function formatAbsolute(date: Date, lang: "en" | "fr"): string {
  return date.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
    timeZone: "Africa/Casablanca",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

interface Props {
  lastUpdated?: string | null;
}

export function FreshnessIndicator({ lastUpdated }: Props) {
  const [, force] = useState(0);
  const { lang } = useLanguage();

  // Re-render every minute so the relative time stays accurate.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!lastUpdated) return null;
  const date = new Date(lastUpdated);
  if (Number.isNaN(date.getTime())) return null;

  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Clock className="w-3 h-3" />
      <span>
        {lang === "fr" ? "Dernière mise à jour à " : "Last updated at "}
        <span className="font-medium text-foreground">{formatAbsolute(date, lang)}</span>
        <span className="text-muted-foreground"> · {formatRelative(date, lang)}</span>
      </span>
    </div>
  );
}