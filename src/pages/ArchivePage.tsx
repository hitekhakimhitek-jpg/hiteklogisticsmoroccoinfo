import { useState, useMemo } from "react";
import {
  Archive as ArchiveIcon,
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { mockNewsEntries } from "@/data/mockData";
import {
  priorityConfig,
  categoryLabels,
  regionLabels,
  categoryColors,
  Category,
  Region,
  Priority,
} from "@/types/freight";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

const categories: Category[] = ["regulation", "weather", "port", "trade", "compliance", "market", "general"];
const regions: Region[] = ["morocco", "europe", "asia", "americas", "africa", "middle_east", "global"];
const priorities: Priority[] = ["critical", "important", "informational"];

// Generate a larger archive dataset by duplicating & shifting dates
const archiveEntries = [
  ...mockNewsEntries,
  ...mockNewsEntries.map((e, i) => ({
    ...e,
    id: `archive-1-${i}`,
    publishedDate: "2026-02-10",
  })),
  ...mockNewsEntries.map((e, i) => ({
    ...e,
    id: `archive-2-${i}`,
    publishedDate: "2026-01-25",
  })),
  ...mockNewsEntries.map((e, i) => ({
    ...e,
    id: `archive-3-${i}`,
    publishedDate: "2026-01-10",
  })),
  ...mockNewsEntries.map((e, i) => ({
    ...e,
    id: `archive-4-${i}`,
    publishedDate: "2025-12-20",
  })),
];

const ArchivePage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<Region[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<Priority[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const toggleFilter = <T,>(arr: T[], item: T, setter: (v: T[]) => void) => {
    setter(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  };

  const activeFilterCount =
    selectedCategories.length + selectedRegions.length + selectedPriorities.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const clearAll = () => {
    setSearchQuery("");
    setSelectedCategories([]);
    setSelectedRegions([]);
    setSelectedPriorities([]);
    setDateFrom("");
    setDateTo("");
  };

  const filtered = useMemo(() => {
    return archiveEntries.filter((entry) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          entry.headline.toLowerCase().includes(q) ||
          entry.summary.toLowerCase().includes(q) ||
          entry.sourceName.toLowerCase().includes(q) ||
          (entry.impactAssessment && entry.impactAssessment.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (selectedCategories.length && !selectedCategories.includes(entry.category)) return false;
      if (selectedRegions.length && !selectedRegions.includes(entry.region)) return false;
      if (selectedPriorities.length && !selectedPriorities.includes(entry.priority)) return false;
      if (dateFrom && entry.publishedDate < dateFrom) return false;
      if (dateTo && entry.publishedDate > dateTo) return false;
      return true;
    });
  }, [searchQuery, selectedCategories, selectedRegions, selectedPriorities, dateFrom, dateTo]);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-secondary/10 p-2 rounded-lg">
          <ArchiveIcon className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Archive</h1>
          <p className="text-sm text-muted-foreground">
            Searchable 3-month rolling intelligence archive
          </p>
        </div>
      </div>

      {/* Retention notice */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/5 border border-secondary/20 text-xs text-secondary">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        Archive retains the last 90 days of intelligence data.
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search headlines, summaries, sources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-input bg-card text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg border transition-colors font-medium ${
            showFilters || activeFilterCount > 0
              ? "border-secondary bg-secondary/10 text-secondary"
              : "border-input bg-card text-card-foreground hover:bg-muted"
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-card rounded-lg border border-border card-elevated p-4 space-y-4">
              {/* Category */}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 block">
                  Category
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => toggleFilter(selectedCategories, cat, setSelectedCategories)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        selectedCategories.includes(cat)
                          ? `${categoryColors[cat]} font-medium`
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {categoryLabels[cat]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Region */}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 block">
                  Region
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {regions.map((reg) => (
                    <button
                      key={reg}
                      onClick={() => toggleFilter(selectedRegions, reg, setSelectedRegions)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        selectedRegions.includes(reg)
                          ? "bg-primary text-primary-foreground border-primary font-medium"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {regionLabels[reg]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 block">
                  Priority
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {priorities.map((pri) => {
                    const pConfig = priorityConfig[pri];
                    return (
                      <button
                        key={pri}
                        onClick={() => toggleFilter(selectedPriorities, pri, setSelectedPriorities)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          selectedPriorities.includes(pri)
                            ? `${pConfig.className} font-medium`
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {pConfig.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 block">
                  Date Range
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">to</span>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>

              {/* Clear */}
              {activeFilterCount > 0 && (
                <button onClick={clearAll} className="text-xs text-secondary hover:underline font-medium">
                  Clear all filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "result" : "results"} found
        {searchQuery && <span> for "<span className="font-medium text-foreground">{searchQuery}</span>"</span>}
      </p>

      {/* Results */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-lg border border-border card-elevated p-12 text-center">
            <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No results match your search criteria.</p>
            <button onClick={clearAll} className="text-xs text-secondary hover:underline mt-2">
              Clear all filters
            </button>
          </div>
        ) : (
          filtered.map((entry, i) => {
            const isExpanded = expandedId === entry.id;
            const pConfig = priorityConfig[entry.priority];
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25 }}
                className="bg-card rounded-lg border border-border card-elevated overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full text-left p-4 flex items-start gap-3"
                >
                  <Badge className={`${pConfig.className} shrink-0 text-[10px] px-2 py-0.5 mt-0.5`}>
                    {pConfig.label}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-card-foreground leading-tight">
                      {entry.headline}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${categoryColors[entry.category]}`}>
                        {categoryLabels[entry.category]}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {regionLabels[entry.region]}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {entry.publishedDate}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-muted-foreground">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0 border-t border-border space-y-3">
                        <p className="text-sm text-muted-foreground pt-3">{entry.summary}</p>
                        <div className="bg-muted/50 rounded-md p-3">
                          <p className="text-xs font-medium text-foreground mb-1">Impact Assessment</p>
                          <p className="text-xs text-muted-foreground">{entry.impactAssessment}</p>
                        </div>
                        {entry.actionRequired && entry.suggestedAction && (
                          <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3">
                            <p className="text-xs font-semibold text-destructive mb-1">⚠ Action Required</p>
                            <p className="text-xs text-card-foreground">{entry.suggestedAction}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Source: {entry.sourceName}</span>
                          {entry.sourceUrl && (
                            <a href={entry.sourceUrl} className="text-secondary hover:underline inline-flex items-center gap-1">
                              Visit <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ArchivePage;
