import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "fr";

const STORAGE_KEY = "hitek_lang";

// Exact-match dictionary: text node trimmed value === key.
const EXACT: Record<string, string> = {
  // Sidebar / nav
  Dashboard: "Tableau de bord",
  "Regulatory Changes": "Changements réglementaires",
  "Finance Regulation": "Réglementation financière",
  "IT News": "Actualités IT",
  "Weekly Report": "Rapport hebdomadaire",
  "Monthly Summary": "Résumé mensuel",
  "Chat Assistant": "Assistant",
  Archive: "Archives",
  Settings: "Paramètres",

  // Dashboard chrome
  "Freight intelligence overview": "Vue d'ensemble des renseignements fret",
  "Top News": "Actualités principales",
  "The updates that matter most today":
    "Les mises à jour qui comptent aujourd'hui",
  "Morocco Focus": "Focus Maroc",
  "Regulatory & Compliance": "Réglementation & Conformité",
  "View all": "Voir tout",
  "Read full article": "Lire l'article complet",
  "Impact Assessment": "Évaluation de l'impact",
  "Action Required": "Action requise",
  "⚠ Action Required": "⚠ Action requise",
  "No Morocco-specific entries yet.":
    "Aucune entrée spécifique au Maroc pour le moment.",
  "No compliance or regulatory entries yet.":
    "Aucune entrée de conformité ou réglementaire pour le moment.",
  "No intelligence data yet": "Aucune donnée disponible",
  "No items for this region": "Aucun élément pour cette région",
  'Click "Fetch News" to pull the latest freight intelligence using AI.':
    'Cliquez sur « Actualiser » pour obtenir les dernières informations fret via l\'IA.',
  "Try a different region or fetch new data.":
    "Essayez une autre région ou actualisez les données.",

  // Buttons / actions
  "Fetch News": "Actualiser",
  "Fetching...": "Chargement...",
  "Fetch News Now": "Actualiser maintenant",
  "Refresh successful": "Actualisation réussie",
  "Refresh successful: 0 new entries": "Actualisation réussie : 0 nouvelle entrée",
  "Refresh failed": "Échec de l'actualisation",
  Save: "Enregistrer",
  Cancel: "Annuler",
  Send: "Envoyer",
  Search: "Rechercher",
  "Loading...": "Chargement...",
  Loading: "Chargement",

  // Regions
  Region: "Région",
  Global: "Mondial",
  Morocco: "Maroc",
  Europe: "Europe",
  Africa: "Afrique",
  "Middle East": "Moyen-Orient",
  Asia: "Asie",
  "North America": "Amérique du Nord",
  "South America": "Amérique du Sud",
  Oceania: "Océanie",
  Americas: "Amériques",

  // Tags / priority
  Critical: "Critique",
  Important: "Important",
  Info: "Info",
  Alert: "Alerte",
  Regulatory: "Réglementaire",
  Customs: "Douanes",
  Port: "Port",
  Logistics: "Logistique",
  Market: "Marché",
  Regulation: "Réglementation",
  Weather: "Météo",
  Trade: "Commerce",
  Compliance: "Conformité",
  General: "Général",

  // Time
  "just now": "à l'instant",
  "same as yesterday": "identique à hier",

  // Regulatory page
  "Regulatory & Law Changes": "Changements réglementaires & légaux",
  "Only actual laws, decrees, circulars, and binding rule changes — newest first. Click any entry to read the official source.":
    "Uniquement les lois, décrets, circulaires et changements contraignants — du plus récent au plus ancien. Cliquez sur une entrée pour lire la source officielle.",
  "No regulatory or compliance entries found yet. Fetch news from the Dashboard.":
    "Aucune entrée réglementaire ou de conformité trouvée. Actualisez depuis le tableau de bord.",
};

// Pattern-based dictionary (full text-node match via regex).
const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^(\d+) new today$/, (m) => `${m[1]} nouveau(x) aujourd'hui`],
  [/^\(([+\-]?\d+) vs yesterday\)$/, (m) => `(${m[1]} vs hier)`],
  [/^([+\-]?\d+) vs yesterday$/, (m) => `${m[1]} vs hier`],
  [/^(\d+) critical$/, (m) => `${m[1]} critique(s)`],
  [/^(\d+) require action$/, (m) => `${m[1]} nécessite(nt) une action`],
  [/^ · (\d+) entries?$/, (m) => ` · ${m[1]} entrée(s)`],
  [/^· (\d+) entries?$/, (m) => `· ${m[1]} entrée(s)`],
  [/^(\d+) minutes? ago$/, (m) => `il y a ${m[1]} minute(s)`],
  [/^(\d+) hours? ago$/, (m) => `il y a ${m[1]} heure(s)`],
  [/^(\d+) days? ago$/, (m) => `il y a ${m[1]} jour(s)`],
  [/^ · (\d+) minutes? ago$/, (m) => ` · il y a ${m[1]} minute(s)`],
  [/^ · (\d+) hours? ago$/, (m) => ` · il y a ${m[1]} heure(s)`],
  [/^ · (\d+) days? ago$/, (m) => ` · il y a ${m[1]} jour(s)`],
  [/^ · just now$/, () => ` · à l'instant`],
  [/^Last updated at $/, () => `Dernière mise à jour à `],
  [/^Refresh failed — (.+)$/, (m) => `Échec de l'actualisation — ${m[1]}`],
];

type Ctx = { lang: Lang; toggle: () => void };
const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const v = sessionStorage.getItem(STORAGE_KEY);
      return v === "fr" ? "fr" : "en";
    } catch {
      return "en";
    }
  });

  // Map of text node -> original value, so we can revert cleanly.
  const originalsRef = useRef<WeakMap<Text, string>>(new WeakMap());
  // Track all touched nodes so we can iterate on revert.
  const touchedRef = useRef<Set<Text>>(new Set());
  const observerRef = useRef<MutationObserver | null>(null);

  const translateNode = useCallback((node: Text) => {
    const raw = node.nodeValue;
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    // Avoid double-translating (already replaced).
    if (originalsRef.current.has(node)) return;
    let replaced: string | null = null;
    if (EXACT[trimmed]) {
      replaced = raw.replace(trimmed, EXACT[trimmed]);
    } else {
      for (const [re, fn] of PATTERNS) {
        const m = raw.match(re);
        if (m) {
          replaced = fn(m);
          break;
        }
      }
    }
    if (replaced !== null && replaced !== raw) {
      originalsRef.current.set(node, raw);
      touchedRef.current.add(node);
      node.nodeValue = replaced;
    }
  }, []);

  const walkAndTranslate = useCallback(
    (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          const p = n.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          const tag = p.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let cur: Node | null = walker.currentNode;
      // If root itself is a text node, handle it.
      if (root.nodeType === Node.TEXT_NODE) translateNode(root as Text);
      while ((cur = walker.nextNode())) {
        translateNode(cur as Text);
      }
    },
    [translateNode],
  );

  const revertAll = useCallback(() => {
    for (const node of touchedRef.current) {
      const orig = originalsRef.current.get(node);
      if (orig !== undefined && node.isConnected) {
        node.nodeValue = orig;
      }
    }
    originalsRef.current = new WeakMap();
    touchedRef.current = new Set();
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang;

    // Tear down any previous observer.
    observerRef.current?.disconnect();
    observerRef.current = null;
    // Always start from a clean slate.
    revertAll();

    if (lang !== "fr") return;

    walkAndTranslate(document.body);

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === Node.TEXT_NODE) {
              translateNode(n as Text);
            } else if (n.nodeType === Node.ELEMENT_NODE) {
              walkAndTranslate(n);
            }
          });
        } else if (m.type === "characterData") {
          if (m.target.nodeType === Node.TEXT_NODE) {
            const t = m.target as Text;
            // React replaced text — clear our memory of it and retry.
            originalsRef.current.delete(t);
            touchedRef.current.delete(t);
            translateNode(t);
          }
        }
      }
    });
    obs.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    observerRef.current = obs;

    return () => {
      obs.disconnect();
      observerRef.current = null;
    };
  }, [lang, walkAndTranslate, translateNode, revertAll]);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      toggle: () => setLang((l) => (l === "en" ? "fr" : "en")),
    }),
    [lang],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}