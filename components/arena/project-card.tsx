"use client";

import { type ReactNode, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Trophy, Medal, Ghost, Droplets, TrendingUp, Skull,
  ShieldCheck, ShieldAlert, AlertTriangle, Shield, ChevronDown, Info,
  Users
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import type { PowerSquadProject } from "@/app/actions/arena"; 
import { FounderBadge } from "@/components/arena/founder-badge";
import { TrustBadge } from "@/components/arena/trust-badge";
import { getSquadMembersAction } from "@/app/actions/arena";

// 🔥 YENİ: Squad Yönetim Modalı
import ManageSquadModal from "@/components/ManageSquadModal"; // import { getSquadMembers } from "@/lib/db";

type SquadMemberStatus =
  | "active"
  | "pending_invite"
  | "pending_application"
  | "rejected"
  | "revoked"
  | "kicked"
  | "left";

type SquadMember = {
  id: string;
  wallet_address: string;
  role: string;
  status: SquadMemberStatus;
  joined_at?: string;
}; 

// ──────────────────────────────────────────────────────────────
// Formatters
// ──────────────────────────────────────────────────────────────
const mcFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 2,
});

function fmtMC(value: number | null): string {
  if (value == null || value <= 0) return "—";
  return mcFormatter.format(value);
}

function timeAgo(isoDate: string | null): string {
  if (!isoDate) return "Never";
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ──────────────────────────────────────────────────────────────
// Risk Band Badge
// ──────────────────────────────────────────────────────────────
type RiskBandConfig = { color: string; icon: ReactNode; label: string };

function RiskBandBadge({ band, score }: { band: string, score: number }) {
  const configs: Record<string, RiskBandConfig> = {
    SAFE: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_-2px_rgba(16,185,129,0.3)]", icon: <ShieldCheck className="h-3 w-3" />, label: "SAFE" },
    LOW_RISK: { color: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: <Shield className="h-3 w-3" />, label: "LOW RISK" },
    MEDIUM: { color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", icon: <AlertTriangle className="h-3 w-3" />, label: "MEDIUM RISK" },
    HIGH: { color: "bg-orange-500/10 text-orange-400 border-orange-500/30", icon: <AlertTriangle className="h-3 w-3" />, label: "HIGH RISK" },
    EXTREME: { color: "bg-red-500/10 text-red-400 border-red-500/30", icon: <ShieldAlert className="h-3 w-3" />, label: "EXTREME RISK" },
    RUGGED: { color: "bg-red-950/80 text-red-500 border-red-500/50 animate-pulse", icon: <Skull className="h-3 w-3" />, label: "RUGGED" }
  };

  const config = configs[band] || configs.EXTREME;

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all ${config.color}`}>
      {config.icon}
      {config.label} {score > 0 && `(${score})`}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Trust Breakdown Panel
// ──────────────────────────────────────────────────────────────
function TrustBreakdownPanel({ project }: { project: PowerSquadProject }) {
  const calculateWidth = (score: number) => `${Math.min(Math.max((score / 1000) * 100, 0), 100)}%`;
  const hasSquad = project.memberCount > 0;

  return (
    <div className="pt-4 pb-2 px-2 mt-4 border-t border-slate-800/60 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-slate-500" /> Trust Underwriting Engine
        </h4>
        <span className="text-[10px] text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full">
          {hasSquad ? "60/40 Hybrid Algorithm" : "100% Founder Trust"}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Founder Trust ({(project.dev_tier || 'Newbie')})</span>
          <span className="font-mono font-medium text-slate-200">{project.dev_trust_score} / 1000</span>
        </div>
        <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: calculateWidth(project.dev_trust_score) }} 
            transition={{ duration: 0.8, delay: 0.1 }}
            className={`h-full rounded-full ${project.dev_trust_score >= 600 ? 'bg-emerald-500' : project.dev_trust_score >= 400 ? 'bg-blue-500' : 'bg-slate-500'}`}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className={hasSquad ? "text-slate-400" : "text-slate-600"}>
            Squad Avg ({project.memberCount} Members)
          </span>
          <span className="font-mono font-medium text-slate-200">
            {hasSquad ? `${project.squad_avg_trust_score} / 1000` : 'No Squad'}
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden">
          {hasSquad ? (
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: calculateWidth(project.squad_avg_trust_score) }} 
              transition={{ duration: 0.8, delay: 0.2 }}
              className={`h-full rounded-full ${project.squad_avg_trust_score >= 600 ? 'bg-emerald-500' : project.squad_avg_trust_score >= 400 ? 'bg-blue-500' : 'bg-slate-500'}`}
            />
          ) : (
            <div className="h-full w-full bg-slate-700/30 rounded-full" />
          )}
        </div>
        {!hasSquad && (
          <p className="text-[10px] text-rose-400/80 mt-1 italic">
            Warning: Solo founders carry higher risk. Add proven members to boost trust.
          </p>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Rank Icon
// ──────────────────────────────────────────────────────────────
function RankIcon({ rank, isExiled }: { rank: number; isExiled?: boolean }) {
  if (isExiled) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-950/80 border border-red-500/50 shadow-[0_0_15px_-3px_rgba(239,68,68,0.5)]">
        <Skull className="h-5 w-5 text-red-500" />
      </div>
    );
  }
  if (rank === 1) return <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 shadow-lg shadow-yellow-500/50 ring-2 ring-yellow-400/40"><Crown className="h-5 w-5 text-yellow-950" /></div>;
  if (rank === 2) return <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 shadow-lg shadow-slate-400/40 ring-2 ring-slate-300/30"><Trophy className="h-4.5 w-4.5 text-slate-700" /></div>;
  if (rank === 3) return <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 via-amber-500 to-orange-600 shadow-lg shadow-orange-500/40 ring-2 ring-orange-400/30"><Medal className="h-4.5 w-4.5 text-orange-100" /></div>;
  
  return (
    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-700/60 bg-slate-800/70">
      <span className="text-sm font-bold text-slate-400 tabular-nums">{rank}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ANA BİLEŞEN: Project Card
// ──────────────────────────────────────────────────────────────
interface ProjectCardProps {
  project: PowerSquadProject;
  index: number;
}

export function ProjectCard({ project, index }: ProjectCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 🔥 YENİ: Modal State'leri ve Cüzdan
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [squadMembers, setSquadMembers] = useState<SquadMember[]>([]); 
  const { publicKey } = useWallet();
  const router = useRouter();

  const isGhost = project.status === "ghost";
  const isFounder = project.claim_tier === "founder";
  const rank = project.rank;
  const isExiled = project.dev_status === "EXILED" || project.dev_tier === "EXILED";

  const currentUserWallet = publicKey?.toBase58();
  const isUserFounder = currentUserWallet?.toLowerCase() === project.claimed_by_full?.toLowerCase();

  // YENİ: Tüm kart yerine sadece çerçeve stili.
  const getCardBaseStyle = () => {
    if (isGhost && !isExiled) return "grayscale opacity-60 border-slate-800/30 bg-slate-950/30";
    if (isExiled || project.project_risk_band === "RUGGED") return "border-red-500/40 bg-gradient-to-br from-red-950/30 to-slate-950/90 shadow-[0_0_20px_-5px_rgba(239,68,68,0.2)] grayscale-[0.5]";
    
    let style = `border-slate-800/60 bg-slate-950/70 hover:border-slate-700/60 transition-all duration-300 ${isExpanded ? 'bg-slate-900/90 border-slate-700/80 shadow-lg' : ''}`;
    
    if (project.project_risk_band === "SAFE") {
      style = `transition-all duration-300 ${isExpanded ? 'border-emerald-500/60 bg-slate-900/95 shadow-[0_0_25px_-5px_rgba(16,185,129,0.25)]' : 'border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 to-slate-950/90 shadow-[0_0_15px_-3px_rgba(16,185,129,0.15)] hover:border-emerald-500/50'}`;
    } else if (project.project_risk_band === "LOW_RISK") {
      style = `transition-all duration-300 ${isExpanded ? 'border-blue-500/50 bg-slate-900/95 shadow-[0_0_20px_-5px_rgba(59,130,246,0.2)]' : 'border-blue-500/20 bg-gradient-to-br from-blue-950/10 to-slate-950/80 hover:border-blue-500/40'}`;
    }

    if (rank === 1) style += ` relative z-10 scale-[1.02] bg-gradient-to-br from-yellow-500/10 to-transparent shadow-[0_0_30px_-5px_rgba(250,204,21,0.2)] ${isExpanded ? 'border-yellow-400/80' : 'border-yellow-400/50'} ${project.project_risk_band === 'SAFE' ? 'ring-1 ring-emerald-500/50' : ''}`;
    if (rank === 2) style += ` bg-gradient-to-br from-slate-400/5 to-transparent shadow-[0_0_20px_-5px_rgba(148,163,184,0.15)] ${isExpanded ? 'border-slate-300/60' : 'border-slate-300/40'}`;
    if (rank === 3) style += ` bg-gradient-to-br from-orange-500/5 to-transparent shadow-[0_0_20px_-5px_rgba(251,146,60,0.15)] ${isExpanded ? 'border-orange-400/60' : 'border-orange-400/40'}`;
    
    return style;
  };

  // Kartı açtığımızda veya Modal'ı açmak istediğimizde o projeye ait üyeleri DB'den çekmemiz lazım.
  // Gerçek uygulamada bu veriyi üst component'ten veya bir SWR/React-Query ile çekebilirsin.
  // Şimdilik Modal'a boş array (veya mock) gönderiyorum, entegre ederken buraya fetch eklemelisin.
  const handleOpenManageModal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsManageModalOpen(true); // 1. Modalı anında aç (Kullanıcıyı bekletme, hızlı hissettirsin)
    
    // 2. Arka planda gerçek veriyi çek
    const result = await getSquadMembersAction(project.id);
    
    // 3. Veri geldiyse State'i güncelle (Modal anında dolu verilerle güncellenecek)
    if (result.success && result.data) {
      setSquadMembers(result.data as SquadMember[]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: index * 0.06 }}
      className={`relative flex flex-col rounded-2xl border p-4 md:p-5 ${getCardBaseStyle()}`}
    >
      <div className="flex items-center gap-4">
        <RankIcon rank={rank} isExiled={isExiled} />

        {/* İkon / Ticker */}
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-black shadow-md flex-shrink-0 ${
            isExiled ? "bg-red-950 border border-red-500/30 text-red-500" : isGhost ? "bg-slate-800/80 border border-slate-700/60 text-slate-600" : rank === 1 ? "bg-gradient-to-br from-yellow-500/25 to-amber-600/15 border border-yellow-500/25 text-yellow-300" : rank <= 3 ? "bg-gradient-to-br from-purple-500/20 to-amber-500/10 border border-purple-500/20 text-purple-200" : "bg-gradient-to-br from-purple-500/15 to-emerald-500/10 border border-purple-500/10 text-purple-300"
          }`}
        >
          {isGhost && !isExiled ? <Ghost className="h-5 w-5" /> : <span className={`text-[11px] leading-none tracking-tight ${isExiled ? "line-through opacity-70" : ""}`}>${(project.symbol || project.name || "??").slice(0, 3)}</span>}
        </div>

        {/* Orta Alan */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-bold truncate max-w-[160px] md:max-w-[220px] ${isExiled ? "text-red-400 line-through" : isGhost ? "text-slate-600" : "text-slate-100"}`}>
              {project.name}
            </span>
            <span className={`text-[10px] font-mono leading-none ${isExiled ? "text-red-500/50" : isGhost ? "text-slate-700" : "text-slate-500"}`}>
              ${project.symbol || "???"}
            </span>
            {isFounder && !isGhost && !isExiled && <FounderBadge />}
            {project.project_risk_band && !isGhost && (
              <RiskBandBadge band={project.project_risk_band} score={project.project_trust_score} />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className={`text-[10px] flex items-center gap-1 ${isExiled ? "text-red-500/60" : isGhost ? "text-slate-700" : "text-slate-500"}`}><Droplets className="h-3 w-3" />Liq: {fmtMC(project.liquidity_usd)}</span>
            <span className={`text-[10px] flex items-center gap-1 ${isExiled ? "text-red-500/60" : isGhost ? "text-slate-700" : "text-slate-500"}`}><TrendingUp className="h-3 w-3" />Vol: {fmtMC(project.volume_24h)}</span>
            <span className={`text-[10px] ${isExiled ? "text-red-500/40" : isGhost ? "text-slate-700" : "text-slate-600"}`}>{timeAgo(project.last_mc_update)}</span>
          </div>
        </div>

        {/* YENİ: Olay Yönlendirmesi Çözüldü */}
        <div className="text-right flex-shrink-0 pl-2 flex items-center gap-3">
          <div>
            <span className={`text-xl font-black tabular-nums tracking-tight leading-none ${isExiled ? "text-red-500/50 line-through" : isGhost ? "text-slate-700" : project.last_valid_mc && project.last_valid_mc >= 1_000_000 ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]" : project.last_valid_mc && project.last_valid_mc > 0 ? "text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.2)]" : "text-slate-600"}`}>
              {fmtMC(project.last_valid_mc)}
            </span>
            <p className={`text-[8px] uppercase tracking-[0.15em] mt-1 ${isExiled ? "text-red-500/40" : isGhost ? "text-slate-700" : "text-slate-600"}`}>
              {isExiled ? "RUGGED" : "Market Cap"}
            </p>
          </div>
          
          {!isGhost && !isExiled && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              aria-expanded={isExpanded}
              aria-controls={`trust-panel-${project.id}`}
              className="p-1.5 rounded-full hover:bg-slate-800/80 transition-colors focus:outline-none"
            >
              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className={`h-5 w-5 ${isExpanded ? 'text-emerald-400' : 'text-slate-500'}`} />
              </motion.div>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && !isGhost && !isExiled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <TrustBreakdownPanel project={project} />
            
            {/* 🔥 YENİ: SQUAD YÖNETİM BUTONLARI (Kart Açıldığında Görünür) */}
            <div className="pt-4 mt-2 border-t border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                <span className="text-xs text-slate-400">{project.memberCount} Squad Members</span>
              </div>
              
              <button
                onClick={handleOpenManageModal}
                className={`text-xs px-4 py-2 rounded-lg font-semibold transition-colors ${
                  isUserFounder 
                    ? "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                }`}
              >
                {isUserFounder ? "Manage Squad" : "View Squad"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔥 YENİ: MODAL'IN KENDİSİ */}
      <ManageSquadModal 
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        project={{
          id: project.id,
          name: project.name,
          claimed_by: project.claimed_by_full || project.claimed_by // Gerçek cüzdan adresini ilet
        }}
        currentUserWallet={currentUserWallet}
        members={squadMembers} // DB'den çektiğin veriyi buraya vereceksin
        onRefresh={() => {
          // Aksiyon başarılı olunca sayfayı yenile
          router.refresh();
        }}
      />
      
    </motion.div>
  );
}