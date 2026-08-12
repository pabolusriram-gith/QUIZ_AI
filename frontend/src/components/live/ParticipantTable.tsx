import React, { useState, useMemo, useCallback } from "react";
import { Search, ChevronDown, ChevronUp, User, Activity, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Participant {
  id: string;
  nickname: string;
  connected: boolean;
  score: number;
}

interface ParticipantTableProps {
  participants: Participant[];
  answeredNicknames: string[];
}

type SortField = "nickname" | "score" | "connected" | "answered";
type SortOrder = "asc" | "desc";

export default function ParticipantTable({ participants, answeredNicknames }: ParticipantTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Virtualization state (Custom Windowing for performance)
  const [scrollTop, setScrollTop] = useState(0);
  const rowHeight = 52; // row height in pixels
  const containerHeight = 350; // container height in pixels

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Filter and sort memoization
  const processedData = useMemo(() => {
    let result = [...participants];

    // 1. Search Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p => p.nickname.toLowerCase().includes(q));
    }

    // 2. Sort Logic
    result.sort((a, b) => {
      let valA: any = a[sortField === "answered" ? "nickname" : sortField];
      let valB: any = b[sortField === "answered" ? "nickname" : sortField];

      // Custom fields overrides
      if (sortField === "answered") {
        valA = answeredNicknames.includes(a.nickname) ? 1 : 0;
        valB = answeredNicknames.includes(b.nickname) ? 1 : 0;
      } else if (sortField === "connected") {
        valA = a.connected ? 1 : 0;
        valB = b.connected ? 1 : 0;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [participants, search, sortField, sortOrder, answeredNicknames]);

  // Windowing offsets calculation
  const { visibleItems, paddingTop, paddingBottom } = useMemo(() => {
    const totalCount = processedData.length;
    const itemsCount = Math.ceil(containerHeight / rowHeight);
    
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
    const endIndex = Math.min(totalCount, startIndex + itemsCount + 4);

    const items = processedData.slice(startIndex, endIndex).map((item, index) => ({
      item,
      realIndex: startIndex + index
    }));

    return {
      visibleItems: items,
      paddingTop: startIndex * rowHeight,
      paddingBottom: (totalCount - endIndex) * rowHeight
    };
  }, [processedData, scrollTop, containerHeight, rowHeight]);

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? (
      <ChevronUp className="h-3 w-3 inline ml-1 text-indigo-400" />
    ) : (
      <ChevronDown className="h-3 w-3 inline ml-1 text-indigo-400" />
    );
  };

  return (
    <div className="space-y-4 w-full animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity className="h-4.5 w-4.5 text-indigo-400" />
          <span>Active Participants List ({participants.length})</span>
        </h3>
        
        {/* Search Input */}
        <div className="relative w-full sm:w-60">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
          <Input
            type="text"
            placeholder="Search nickname..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/3 border-white/10 rounded-xl h-10 text-white font-medium text-xs focus:border-indigo-500/50"
          />
        </div>
      </div>

      {processedData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 border border-dashed border-white/10 rounded-2xl bg-white/1">
          <AlertCircle className="h-7 w-7 text-slate-500" />
          <div>
            <h4 className="text-xs font-bold text-slate-300">No matching participants</h4>
            <p className="text-[10px] text-slate-500">Try adjusting your search criteria.</p>
          </div>
        </div>
      ) : (
        <div className="border border-white/5 bg-slate-950/20 rounded-2xl overflow-hidden backdrop-blur-md">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2.5 p-3.5 border-b border-white/5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider select-none bg-white/2">
            <div className="col-span-4 cursor-pointer hover:text-white" onClick={() => handleSort("nickname")}>
              Nickname {renderSortIndicator("nickname")}
            </div>
            <div className="col-span-3 cursor-pointer hover:text-white text-center" onClick={() => handleSort("score")}>
              Score {renderSortIndicator("score")}
            </div>
            <div className="col-span-3 cursor-pointer hover:text-white text-center" onClick={() => handleSort("connected")}>
              Status {renderSortIndicator("connected")}
            </div>
            <div className="col-span-2 cursor-pointer hover:text-white text-right" onClick={() => handleSort("answered")}>
              Response {renderSortIndicator("answered")}
            </div>
          </div>

          {/* Table Body (Virtualized scrolling window) */}
          <div
            onScroll={handleScroll}
            className="overflow-y-auto"
            style={{ height: `${containerHeight}px` }}
          >
            <div style={{ paddingTop: `${paddingTop}px`, paddingBottom: `${paddingBottom}px` }}>
              {visibleItems.map(({ item, realIndex }) => {
                const isAnswered = answeredNicknames.includes(item.nickname);
                const initials = item.nickname.slice(0, 2).toUpperCase();
                
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2.5 px-3.5 py-2.5 border-b border-white/2 text-xs font-semibold items-center text-slate-300 hover:bg-white/3 transition-colors"
                    style={{ height: `${rowHeight}px` }}
                  >
                    {/* Nickname & Avatar */}
                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      <div className="h-6 w-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[9px] font-bold text-indigo-300 shrink-0">
                        {initials}
                      </div>
                      <span className="text-white font-bold truncate block">{item.nickname}</span>
                    </div>

                    {/* Score */}
                    <div className="col-span-3 text-center text-white font-mono font-bold">
                      {item.score}
                    </div>

                    {/* Connected status indicator */}
                    <div className="col-span-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border ${
                        item.connected 
                          ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/15" 
                          : "text-rose-400 bg-rose-500/5 border-rose-500/15"
                      }`}>
                        <div className={`h-1 w-1 rounded-full ${item.connected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                        <span>{item.connected ? "Online" : "Offline"}</span>
                      </span>
                    </div>

                    {/* Answered status indicator */}
                    <div className="col-span-2 text-right">
                      {isAnswered ? (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/5 border border-emerald-500/15 px-2 py-0.5 rounded-full">
                          Answered
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-500 bg-white/3 border border-white/5 px-2 py-0.5 rounded-full animate-pulse">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
