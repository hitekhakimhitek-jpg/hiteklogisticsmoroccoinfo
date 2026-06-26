import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download, Check } from "lucide-react";
import html2canvas from "html2canvas";
import { ShareCard } from "./ShareCard";
import { IntelligenceItem } from "@/hooks/useIntelligenceItems";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";

export function ShareDialog({
  item,
  open,
  onOpenChange,
}: {
  item: IntelligenceItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLanguage();
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Branded share link on the Hitek custom domain. Humans land on the in-app
  // /news/:id page (rendered by IntelItemPage). For rich link previews the
  // hosting layer should rewrite crawler hits on /news/* to the og-share
  // edge function — see deployment notes.
  const brandedOrigin =
    typeof window !== "undefined" && window.location.hostname === "info.hitek.ma"
      ? "https://info.hitek.ma"
      : (typeof window !== "undefined" ? window.location.origin : "https://info.hitek.ma");
  const directLink = `${brandedOrigin}/news/${item.id}`;

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(directLink);
      setCopied(true);
      toast({
        title: lang === "fr" ? "Lien copié" : "Link copied",
        description: directLink,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: lang === "fr" ? "Échec" : "Failed",
        description: lang === "fr" ? "Impossible de copier le lien." : "Could not copy link.",
        variant: "destructive",
      });
    }
  };

  const onDownload = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const slug = item.headline
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60);
        a.href = url;
        a.download = `hitek-${slug || "intel"}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: lang === "fr" ? "Image téléchargée" : "Image downloaded",
        });
      }, "image/png");
    } catch (e) {
      console.error(e);
      toast({
        title: lang === "fr" ? "Échec de l'export" : "Export failed",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{lang === "fr" ? "Partager" : "Share"}</DialogTitle>
          <DialogDescription>
            {lang === "fr"
              ? "Téléchargez l'image ou copiez le lien direct."
              : "Download the card as PNG or copy the direct link."}
          </DialogDescription>
        </DialogHeader>

        {/* Off-screen real-size card used for PNG export */}
        <div
          style={{ position: "fixed", top: 0, left: "-10000px", pointerEvents: "none" }}
          aria-hidden
        >
          <ShareCard ref={cardRef} item={item} />
        </div>

        {/* Scaled preview (display only) */}
        <div className="w-full overflow-hidden rounded-md border border-border bg-slate-100">
          <div
            style={{
              width: "100%",
              aspectRatio: "1200 / 630",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: 1200,
                height: 630,
                transform: "scale(var(--share-scale, 0.5))",
                transformOrigin: "top left",
              }}
              ref={(el) => {
                if (!el) return;
                const parent = el.parentElement;
                if (!parent) return;
                const ro = new ResizeObserver(() => {
                  el.style.setProperty("--share-scale", String(parent.clientWidth / 1200));
                });
                ro.observe(parent);
                el.style.setProperty("--share-scale", String(parent.clientWidth / 1200));
              }}
            >
              <ShareCard item={item} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={onCopyLink}>
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {lang === "fr" ? "Copier le lien" : "Copy link"}
          </Button>
          <Button onClick={onDownload} disabled={exporting}>
            <Download className="w-4 h-4 mr-2" />
            {exporting
              ? lang === "fr"
                ? "Export..."
                : "Exporting..."
              : lang === "fr"
                ? "Télécharger PNG"
                : "Download PNG"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}