import Link from "next/link";
import {
  Zap,
  Shield,
  Clock,
  Wallet,
  Activity,
  Crosshair,
  Filter,
  Coins,
  Lock,
  Users,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  Brain,
  Database,
  TrendingUp,
  Eye,
  EyeOff,
  BarChart3,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────
// Shared typography helpers
// ──────────────────────────────────────────────────────────────

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-400 mb-6">
      {children}
    </span>
  );
}

function H1({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-100 mb-4 leading-tight">
      {children}
    </h1>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-100 mt-12 mb-4 pb-2 border-b border-slate-800">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base md:text-lg font-semibold text-slate-200 mt-8 mb-3">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm md:text-base text-slate-400 leading-relaxed mb-4">
      {children}
    </p>
  );
}

function Callout({
  icon,
  title,
  children,
  variant = "default",
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  variant?: "default" | "warning" | "success";
}) {
  const colors = {
    default: "border-slate-700/50 bg-slate-800/30 text-slate-300",
    warning: "border-amber-500/20 bg-amber-500/5 text-amber-300",
    success: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
  };

  return (
    <div className={`rounded-xl border p-4 md:p-5 my-6 ${colors[variant]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="text-xs md:text-sm text-slate-400 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-lg border border-slate-800 bg-slate-900/80 px-4 py-3 my-4 overflow-x-auto">
      <code className="text-xs md:text-sm text-emerald-300 font-mono leading-relaxed">
        {children}
      </code>
    </pre>
  );
}

// ──────────────────────────────────────────────────────────────
// INTRO SECTION
// ──────────────────────────────────────────────────────────────

export function IntroSection() {
  const philosophyItems = [
    {
      icon: <Brain className="h-4 w-4 text-emerald-400" aria-hidden="true" />,
      label: "Behavior Over Balance",
      desc: "We measure timing, execution, holding behavior, consistency, and risk patterns  not just balances or one-off wins.",
    },
    {
      icon: <Eye className="h-4 w-4 text-emerald-400" aria-hidden="true" />,
      label: "Explainability Over Black Boxes",
      desc: "Every meaningful output should be interpretable through measurable signals, score windows, and confidence ratings.",
    },
    {
      icon: <EyeOff className="h-4 w-4 text-emerald-400" aria-hidden="true" />,
      label: "Consent for Identity, Not for Analysis",
      desc: "Wallets can be analyzed behaviorally without public identity linkage. Public profiles and discoverability require explicit opt-in.",
    },
    {
      icon: <Users className="h-4 w-4 text-emerald-400" aria-hidden="true" />,
      label: "Coordination Built on Intelligence",
      desc: "Squad formation is a future layer. It must be built on top of credible intelligence and reputation — not the other way around.",
    },
  ];

  const howItWorks = [
    {
      step: "01",
      title: "Analyze",
      icon: <Activity className="h-5 w-5 text-emerald-400" aria-hidden="true" />,
      desc: "Connect or input a wallet. PumpMatch transforms raw on-chain activity into measurable behavioral features.",
    },
    {
      step: "02",
      title: "Interpret",
      icon: <BarChart3 className="h-5 w-5 text-emerald-400" aria-hidden="true" />,
      desc: "Our intelligence engine produces multi-axis outputs — style, quality, suspiciousness, and confidence — rather than a single opaque trust number.",
    },
    {
      step: "03",
      title: "Coordinate",
      icon: <Users className="h-5 w-5 text-emerald-400" aria-hidden="true" />,
      desc: "As the system matures, these signals power public proof, reputation surfaces, token community intelligence, and high signal squad coordination.",
    },
  ];

  const designLaw = [
    { num: "1", label: "Raw Events", sublabel: "source truth" },
    { num: "2", label: "Features", sublabel: "measurable signals" },
    { num: "3", label: "Scores", sublabel: "interpreted outputs" },
    { num: "4", label: "Reputation", sublabel: "application layer" },
    { num: "5", label: "Coordination", sublabel: "future layer built on top" },
  ];

  return (
    <article className="max-w-3xl">
      <SectionBadge>Getting Started</SectionBadge>
      <H1>The Behavioral Intelligence Layer for Solana</H1>

      <P>
        PumpMatch is building the behavioral intelligence and reputation layer
        for Solana.
      </P>
      <P>
        We do not believe trust should be based on hype, anonymous chat rooms,
        or surface-level wallet snapshots. We believe trust should be earned
        through{" "}
        <strong className="text-slate-200">observable behavior</strong>,{" "}
        <strong className="text-slate-200">explainable signals</strong>, and{" "}
        <strong className="text-slate-200">verifiable history</strong>.
      </P>
      <P>
        PumpMatch helps users understand how wallets behave, how communities are
        composed, and  over time  how high signal teams can be formed using
        intelligence instead of guesswork. 
      </P>

      {/* ── The Coordination Problem ── */}
      <H2>The Coordination Problem</H2>

      <P>Solana moves fast, but coordination is fragile.</P>
      <P>
        Anonymous actors, staged communities, inconsistent execution, and low
        accountability make it difficult to evaluate who is credible, who is
        risky, and which groups are actually durable. In most cases, people
        still rely on screenshots, reputation theater, or blind trust in Discord
        and Telegram.
      </P>

      <Callout
        icon={<Zap className="h-4 w-4 text-emerald-400" />}
        title="Our Approach"
        variant="success"
      >
        PumpMatch replaces blind trust with behavioral intelligence. We
        transform raw on-chain activity into explainable signals that help users
        evaluate wallets, communities, and collaborative risk with more clarity
        and less guesswork.
      </Callout>

      {/* ── Core Philosophy ── */}
      <H2>Core Philosophy</H2>

      <div className="grid gap-3 my-6">
        {philosophyItems.map((item) => (
          <div
            key={item.label}
            className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
          >
            <div className="mt-0.5 shrink-0">{item.icon}</div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">
                {item.label}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── How It Works ── */}
      <H2>How It Works</H2>

      <div className="grid gap-4 md:grid-cols-3 my-6">
        {howItWorks.map((item) => (
          <div
            key={item.step}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              {item.icon}
              <span className="text-xs font-mono text-slate-600">
                {item.step}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">
              {item.title}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>

      {/* ── Design Law ── */}
      <H2>Design Law</H2>

      <P>
        PumpMatch follows a strict hierarchy. Any system that collapses these
        layers into a single rigid label is architecturally invalid.
      </P>

      <div className="space-y-2 my-6">
        {designLaw.map((item) => (
          <div key={item.num} className="flex items-center gap-3">
            <span className="h-6 w-6 rounded-full border border-slate-700 bg-slate-900/60 flex items-center justify-center text-xs font-mono text-slate-500 shrink-0">
              {item.num}
            </span>
            <span className="text-sm text-slate-200 font-semibold">
              {item.label}
            </span>
            <span className="text-xs text-slate-600">— {item.sublabel}</span>
          </div>
        ))}
      </div>

      <Callout
        icon={<ArrowRight className="h-4 w-4 text-slate-400" />}
        title="Start Here"
        variant="default"
      >
        Read the{" "}
        <Link
          href="/docs?tab=intelligence-core-v2"
          className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300 transition-[color] duration-150 font-semibold"
        >
          Intelligence Core v2 specification
        </Link>{" "}
        for the full architecture detail, or jump to the{" "}
        <Link
          href="/docs?tab=roadmap"
          className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300 transition-[color] duration-150 font-semibold"
        >
          Grand Vision &amp; Roadmap
        </Link>{" "}
        to see where we are going.
      </Callout>
    </article>
  );
}

// ──────────────────────────────────────────────────────────────
// TRUST SCORE SECTION
// ──────────────────────────────────────────────────────────────

export function TrustSection() {
  return (
    <article className="max-w-3xl">
      {/* ── DEPRECATION NOTICE ── */}
      <Callout
        icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
        title="⚠️ DEPRECATED (LEGACY FROZEN)"
        variant="warning"
      >
        This document is obsolete. PumpMatch has pivoted from an
        identity/matchmaking protocol to a behavioral intelligence protocol.
        Raw features, scoring models, and score taxonomy have all been
        redesigned.{" "}
        <Link
          href="/docs?tab=intelligence-core-v2"
          className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300 transition-[color] duration-150 font-semibold"
        >
          Read the Intelligence Core v2 specification →
        </Link>
      </Callout>

      <SectionBadge>Core Infrastructure</SectionBadge>
      <H1>The Trust Engine</H1>

      <P>
        Trust is not claimed. It is calculated. The PumpMatch Trust Score is a deterministic, on-chain metric that evaluates wallet reputation across multiple dimensions, acting as a decentralized oracle for Sybil resistance.
      </P>

      <Callout
        icon={<Shield className="h-4 w-4 text-emerald-400" />}
        title="Deterministic Scoring"
        variant="success"
      >
        Every score is reproducible. Given the same on-chain data, the same score is produced every time. No randomness, no manual overrides.
      </Callout>

      <H2>Scoring Dimensions</H2>

      <H3>1. Wallet Age & Sybil Resistance</H3>
      <P>
        How long has this wallet been active? We detect the first transaction to calculate age. Newer wallets face severe score penalties filtering out freshly created bot wallets and "burner" addresses used for rug pulls.
      </P>
  
      <H3>2. Asset Portfolio & Diversity</H3>
      <P>
        We analyze SOL balances, token holdings, and NFT assets. A highly diversified portfolio with historical holding patterns signals a real, engaged network participant rather than a single purpose bot.
      </P>

      <H3>3. Transaction History</H3>
      <P>
        High activity with consistent, long-term patterns builds trust. Sudden, unnatural bursts of identical transactions without historical precedent can trigger risk flags.
      </P>

      <H2>The Weak Link Formula</H2>
      <P>
        When evaluating the overall trustworthiness of a Squad, we don't just calculate the average score of its members. We apply the Weak Link Principle: the lower-trust user pulls the score down disproportionately.
      </P>
      <CodeBlock>
        {`BaseScore = (MinScore × 0.7) + (MaxScore × 0.3)\nSquadTrust = min(98, BaseScore + BadgeBonus)\n\nWhere:\n  MinScore = The lowest trust score in the squad\n  MaxScore = The highest trust score in the squad`}
      </CodeBlock>
    </article>
  );
}

// ──────────────────────────────────────────────────────────────
// SQUAD OS SECTION
// ──────────────────────────────────────────────────────────────

export function SquadOsSection() {
  return (
    <article className="max-w-3xl">
      <SectionBadge>Core Infrastructure</SectionBadge>
      <H1>Squad OS</H1>

      <P>
        Finding a team is only step one. <strong>Squad OS</strong> is the operational engine that turns a loose group of wallets into a disciplined, execution ready protocol entity.
      </P>

      <H2>The Pipeline to Launch</H2>
      <P>
        Squad OS enforces a strict state machine for every project. This ensures clarity, alignment, and cryptographic agreement before any real work or funding begins.
      </P>

      <div className="grid gap-3 my-6">
        {[
          {
            label: "1. Forming & Recruiting",
            desc: "Founders define exact Role Slots (e.g., 1 DEV, 2 MKT) with specific Trust Score requirements. Open applications are matched against these criteria.",
            icon: <Users className="h-5 w-5 text-indigo-400" />,
            border: "border-indigo-500/30",
          },
          {
            label: "2. Split Proposal",
            desc: "Once slots are filled, the Founder proposes a Revenue Split (measured in Basis Points, BPS). For example: 70% Founder, 15% Developer, 15% Marketer.",
            icon: <Filter className="h-5 w-5 text-blue-400" />,
            border: "border-blue-500/30",
          },
          {
            label: "3. Cryptographic Signatures",
            desc: "All members must explicitly agree to the split by signing an off-chain message with their Solana Wallet. This creates an undeniable audit trail.",
            icon: <Lock className="h-5 w-5 text-amber-400" />,
            border: "border-amber-500/30",
          },
          {
            label: "4. Launch Ready",
            desc: "Once 100% of signatures are collected, the Squad state locks into 'Ready'. The squad is now verified and prepared for on-chain execution.",
            icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
            border: "border-emerald-500/30",
          },
        ].map((step) => (
          <div
            key={step.label}
            className={`flex items-start gap-4 rounded-xl border ${step.border} bg-slate-900/50 p-4`}
          >
            <div className="mt-1">{step.icon}</div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">
                {step.label}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Callout
        icon={<Shield className="h-4 w-4 text-emerald-400" />}
        title="Why This Matters"
        variant="success"
      >
        By requiring cryptographic signatures for revenue splits BEFORE a launch, Squad OS eliminates the "Will I get paid?" anxiety that destroys most Web3 teams.
      </Callout>
    </article>
  );
}

// ──────────────────────────────────────────────────────────────
// INTELLIGENCE CORE V2 SECTION
// ──────────────────────────────────────────────────────────────

export function IntelligenceCoreV2Section() {
  const hierarchyLayers = [
    {
      num: "01",
      label: "Raw Events",
      sublabel: "Immutable Source Truth",
      desc: "Blockchain signatures, swap events, transfers. Never modified, never deleted. This is the only ground truth the system trusts.",
      examples: "signatures · swaps · transfers",
      icon: <Database className="h-5 w-5 text-slate-400" />,
      border: "border-slate-700/50",
    },
    {
      num: "02",
      label: "Derived Features",
      sublabel: "Versioned Measurements",
      desc: "Computed metrics extracted from raw events by a versioned pipeline. Re-derivable from scratch  features are never the source of truth.",
      examples: "median hold time · win rate · launch-window entry ratio",
      icon: <Filter className="h-5 w-5 text-blue-400" />,
      border: "border-blue-500/30",
    },
    {
      num: "03",
      label: "Interpreted Scores",
      sublabel: "Versioned Algorithmic Models",
      desc: "Style, quality, and suspiciousness scores produced by versioned models over derived features. Historical scores are never overwritten  new model versions produce new rows.",
      examples: "style score · quality score · suspiciousness score",
      icon: <TrendingUp className="h-5 w-5 text-purple-400" />,
      border: "border-purple-500/30",
    },
    {
      num: "04",
      label: "Presentation",
      sublabel: "Human-Readable Artifacts",
      desc: "Personas, badges, and receipts rendered for the end user. Pure UI layer — editing profile metadata here never reaches or alters layer 01–03.",
      examples: "persona label · trust receipt · share card",
      icon: <Eye className="h-5 w-5 text-emerald-400" />,
      border: "border-emerald-500/30",
    },
  ];

  const scoreTaxonomy = [
    {
      label: "Style Scores",
      items: ["Sniper", "Scalper", "Swing", "Conviction"],
      desc: "Classifies how a wallet approaches entries and exits.",
      icon: <Crosshair className="h-4 w-4 text-cyan-400" />,
      border: "border-cyan-500/20",
    },
    {
      label: "Quality Scores",
      items: ["Consistency", "Risk-Adjusted PnL", "Longevity"],
      desc: "Measures execution quality and sustained performance over time.",
      icon: <BarChart3 className="h-4 w-4 text-emerald-400" />,
      border: "border-emerald-500/20",
    },
    {
      label: "Suspiciousness Scores",
      items: ["Coordination Risk", "Fresh-Wallet Anomaly", "Wash-Trade Likelihood"],
      desc: "Detects patterns statistically inconsistent with organic human trading.",
      icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
      border: "border-amber-500/20",
    },
    {
      label: "Confidence Metric",
      items: ["Sample size", "Recency weight", "Data completeness"],
      desc: "Every score ships with a confidence rating — low sample sizes are never presented as high-certainty outputs.",
      icon: <Shield className="h-4 w-4 text-slate-400" />,
      border: "border-slate-700/50",
    },
  ];

  const privacyItems = [
    {
      icon: <EyeOff className="h-5 w-5 text-slate-400" />,
      label: "Ghost Mode (Default)",
      desc: "Any wallet can be analyzed without consent. Behavioral analysis is derived from public on-chain data. The wallet is never indexed publicly unless the owner opts in.",
      border: "border-slate-700/50",
    },
    {
      icon: <Eye className="h-5 w-5 text-emerald-400" />,
      label: "Public Identity",
      desc: "Profile claiming, public linking to X/Twitter, and social discoverability all require explicit, cryptographically verified user opt-in.",
      border: "border-emerald-500/20",
    },
    {
      icon: <Lock className="h-5 w-5 text-blue-400" />,
      label: "Immutable Intelligence",
      desc: "User-edited profile metadata (display name, bio, avatar) never propagates into the raw events, feature, or score layers. Scores are derived from chain data alone.",
      border: "border-blue-500/20",
    },
  ];

  return (
    <article className="max-w-3xl">
      <SectionBadge>
        <Brain className="h-3.5 w-3.5" aria-hidden="true" />
        Intelligence Core
      </SectionBadge>
      <H1>Intelligence Core Specification (v2.0)</H1>

      <P>
        <strong className="text-slate-200">Architecture:</strong> Behavioral
        Wallet Intelligence &amp; Reputation Layer &nbsp;·&nbsp;{" "}
        <strong className="text-slate-200">Chain Focus:</strong> Solana
      </P>

      {/* ── Design Law callout ── */}
      <Callout
        icon={<Brain className="h-4 w-4 text-emerald-400" />}
        title="The Design Law"
        variant="success"
      >
        <code className="font-mono text-emerald-300 text-xs">
          Raw Events → Derived Features → Interpreted Scores → Presentation
        </code>
        <p className="mt-2">
          Any system that collapses these layers into a single rigid label is
          architecturally invalid. Scoring and heavy computation are always
          decoupled from the database layer.
        </p>
      </Callout>

      {/* ─────────────────────────────────── */}
      <H2>1. Core Philosophy: Behavior Over Balance</H2>

      <P>
        PumpMatch is a behavioral wallet intelligence layer. We do not score
        vanity — balance size or one lucky win  we score{" "}
        <strong className="text-slate-200">behavior</strong>. The real signal
        comes from entry timing, exit discipline, holding duration, and risk
        management repeated consistently over time.
      </P>
      <P>
        A wallet that has made 200 disciplined trades over 14 months with a
        documented strategy outranks a wallet that stumbled into one 50× gain
        and has been dormant since.
      </P>

      {/* ─────────────────────────────────── */}
      <H2>2. The Hierarchy of Truth</H2>

      <P>
        Our intelligence engine strictly enforces four non-overlapping data
        layers. Data flows <em>downward only</em>  presentation never
        influences scoring, and scores never alter raw events.
      </P>

      <div className="grid gap-3 my-6">
        {hierarchyLayers.map((layer) => (
          <div
            key={layer.num}
            className={`flex items-start gap-4 rounded-xl border ${layer.border} bg-slate-900/50 p-4`}
          >
            <div className="mt-0.5 shrink-0">{layer.icon}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-slate-600">
                  {layer.num}
                </span>
                <h3 className="text-sm font-semibold text-slate-200">
                  {layer.label}
                </h3>
                <span className="text-xs text-slate-500">
                  — {layer.sublabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-1.5">
                {layer.desc}
              </p>
              <p className="text-[11px] font-mono text-slate-600 truncate">
                e.g. {layer.examples}
              </p>
            </div>
          </div>
        ))}
      </div>

      <CodeBlock>{`// Design Law enforcement
// Data flows downward only  never upward.

Raw Events      ──► immutable, append-only (swaps, transfers)
  │
  ▼
Derived Features ──► versioned, re-computable (win_rate, hold_time)
  │
  ▼
Interpreted Scores ──► versioned model outputs (style, quality, risk)
  │
  ▼
Presentation    ──► UI artifacts only (persona label, receipt, badge)`}</CodeBlock>

      {/* ─────────────────────────────────── */}
      <H2>3. Score Taxonomy (Multi-Axial)</H2>

      <P>
        We do not use a single, opaque "Trust Score". We provide multi-axis
        analysis. Each axis is independently computed, versioned, and
        explainable.
      </P>

      <div className="grid gap-3 sm:grid-cols-2 my-6">
        {scoreTaxonomy.map((category) => (
          <div
            key={category.label}
            className={`rounded-xl border ${category.border} bg-slate-900/50 p-4`}
          >
            <div className="flex items-center gap-2 mb-2">
              {category.icon}
              <h3 className="text-sm font-semibold text-slate-200">
                {category.label}
              </h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-2">
              {category.desc}
            </p>
            <ul className="space-y-1">
              {category.items.map((item) => (
                <li key={item} className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="h-1 w-1 rounded-full bg-slate-600 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ─────────────────────────────────── */}
      <H2>4. Privacy, Identity & Consent</H2>

      <div className="grid gap-3 my-6">
        {privacyItems.map((item) => (
          <div
            key={item.label}
            className={`flex items-start gap-4 rounded-xl border ${item.border} bg-slate-900/50 p-4`}
          >
            <div className="mt-0.5 shrink-0">{item.icon}</div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">
                {item.label}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ─────────────────────────────────── */}
      <H2>5. The Explainability Standard</H2>

      <Callout
        icon={<Activity className="h-4 w-4 text-amber-400" />}
        title="No Black Boxes"
        variant="warning"
      >
        Black-box algorithms are forbidden on PumpMatch. Every major score
        output must be auditable by the wallet owner.
      </Callout>

      <P>Every major score on PumpMatch provides:</P>

      <ul className="space-y-2 my-4 ml-1">
        {[
          "The measurement window (e.g. 7d, 30d, all-time).",
          "Sample size and a confidence rating (low / medium / high).",
          'The top contributing features (e.g. "Median hold time: 4.2m").',
        ].map((point) => (
          <li
            key={point}
            className="flex items-start gap-2.5 text-sm text-slate-400"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            {point}
          </li>
        ))}
      </ul>

      <CodeBlock>{`// Example score output
{
  "axis": "quality",
  "score": 82,
  "confidence": "high",
  "window": "30d",
  "sample_size": 143,
  "model_version": "v2",
  "top_features": [
    "Median hold time: 4.2m",
    "Win rate (30d): 0.67",
    "Entry in launch window: 78%"
  ]
}`}</CodeBlock>

      {/* ─────────────────────────────────── */}
      <H2>6. Token Intelligence</H2>

      <P>
        A token&apos;s quality is inseparable from the quality of its holder
        base. Our Token Radar analyzes the community composition of any SPL
        token and returns actionable signals:
      </P>

      <ul className="space-y-2 my-4 ml-1">
        {[
          "High churn ratios  the fraction of holders who fully exited in the trailing 7 days.",
          "Suspicious cluster detection — coordinated buy/sell patterns across related wallets.",
          "Quality-weighted holder score — the mean behavioral quality score of active holders.",
          "Wash-trade likelihood — statistical anomalies inconsistent with organic volume.",
        ].map((point) => (
          <li
            key={point}
            className="flex items-start gap-2.5 text-sm text-slate-400"
          >
            <ArrowRight className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
            {point}
          </li>
        ))}
      </ul>

      <Callout
        icon={<Shield className="h-4 w-4 text-emerald-400" />}
        title="Token Intel is Phase 2"
        variant="default"
      >
        Token Radar is scoped to Phase 2 (V1.1) of the roadmap. Wallet
        behavioral scoring (Phase 1 / MVP) ships first.{" "}
        <Link
          href="/roadmap"
          className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300 transition-[color] duration-150"
        >
          See the full roadmap →
        </Link>
      </Callout>
    </article>
  );
}

// ──────────────────────────────────────────────────────────────
// ROADMAP SECTION
// ──────────────────────────────────────────────────────────────

export function RoadmapSection() {
  const phases = [
    {
      num: "01",
      name: "The Oracle",
      sublabel: "Behavioral Wallet Intelligence",
      status: "Active",
      statusClass: "text-emerald-400",
      border: "border-emerald-500/30",
      icon: <Crosshair className="h-5 w-5 text-emerald-400" aria-hidden="true" />,
      objective:
        "Establish PumpMatch as the most credible way to understand how a Solana wallet behaves.",
      desc: "A user connects a wallet and receives style analysis, quality analysis, suspiciousness signals, and a shareable public proof artifact.",
      aiRole:
        "AI acts as an explainer, summarizing wallet behavior into human readable reports. It does not replace deterministic scoring.",
    },
    {
      num: "02",
      name: "The Radar",
      sublabel: "Token & Community Intelligence",
      status: "Upcoming",
      statusClass: "text-amber-400",
      border: "border-amber-500/30",
      icon: <Activity className="h-5 w-5 text-amber-400" aria-hidden="true" />,
      objective: "Expand from individual behavior to crowd behavior.",
      desc: "A user inputs a token and receives a behavioral breakdown of its holder base: fresh wallet concentration, high churn ratios, conviction holder density, and suspicious cluster signals.",
      aiRole:
        "AI narrates suspicious cluster patterns and explains token community composition.",
    },
    {
      num: "03",
      name: "Squad OS",
      sublabel: "Coordination & High Signal Matching",
      status: "Future",
      statusClass: "text-purple-400",
      border: "border-purple-500/30",
      icon: <Users className="h-5 w-5 text-purple-400" aria-hidden="true" />,
      objective:
        "Transform intelligence into coordination infrastructure.",
      desc: "Once a base of behavioral intelligence and public identities exists, we enable high signal team formation. The Weak Link Principle evaluates lowest quality member risk and collective fragility patterns.",
      aiRole:
        "AI acts as a coordination analyst, explaining why a team looks strong or fragile.",
    },
  ];

  const designLaw = [
    { num: "1", text: "Raw events are truth." },
    { num: "2", text: "Features are measurements." },
    { num: "3", text: "Scores are interpretations." },
    { num: "4", text: "Reputation is an application layer." },
    { num: "5", text: "Coordination is a future layer built on top." },
  ];

  return (
    <article className="max-w-3xl">
      <SectionBadge>Vision</SectionBadge>
      <H1>Grand Vision &amp; Product Roadmap</H1>

      <P>
        <strong className="text-slate-200">Architecture:</strong> Behavioral
        Intelligence &amp; Reputation Layer &nbsp;·&nbsp;{" "}
        <strong className="text-slate-200">Chain Focus:</strong> Solana
      </P>

      {/* ── 1. Grand Vision ── */}
      <H2>1. Grand Vision</H2>

      <P>
        PumpMatch is building the{" "}
        <strong className="text-slate-200">
          behavioral intelligence and reputation layer for Solana
        </strong>
        . We are not building another token dashboard or a social feed disguised
        as analytics. We are building the system that helps users understand how
        wallets behave, how communities are composed, and eventually, how
        high signal teams can be formed using behavior instead of hype.
      </P>

      <Callout
        icon={<Zap className="h-4 w-4 text-emerald-400" />}
        title="The Long-Term Thesis"
        variant="success"
      >
        <p>
          <strong className="text-slate-200">Intelligence</strong> comes first.{" "}
          <strong className="text-slate-200">Reputation</strong> comes second.{" "}
          <strong className="text-slate-200">Coordination</strong> comes last.
        </p>
        <p className="mt-1.5 text-slate-500">
          Without reliable intelligence, reputation becomes theater. Without
          reliable reputation, coordination becomes chaos.
        </p>
      </Callout>

      {/* ── 2. Strategic Thesis ── */}
      <H2>2. Strategic Thesis</H2>

      <P>
        Most crypto products stop at data display  balances, charts  or basic
        risk heuristics. PumpMatch goes further:{" "}
        <strong className="text-slate-200">we interpret behavior</strong>.
      </P>
      <P>
        We identify timing discipline, holding behavior, consistency,
        suspiciousness, and crowd quality.
      </P>

      <Callout
        icon={<Shield className="h-4 w-4 text-emerald-400" />}
        title="The Core Principle"
        variant="success"
      >
        We do not score vanity. We score behavior.
      </Callout>

      {/* ── 3. Product Evolution ── */}
      <H2>3. Product Evolution (The 3 Phases)</H2>

      <div className="space-y-4 my-6">
        {phases.map((phase) => (
          <div
            key={phase.num}
            className={`flex items-start gap-4 rounded-xl border ${phase.border} bg-slate-900/50 p-4 md:p-5`}
          >
            <div className="mt-0.5 shrink-0">{phase.icon}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-mono text-slate-600">
                  {phase.num}
                </span>
                <h3 className="text-sm font-semibold text-slate-200">
                  Phase {phase.num} — {phase.name}
                </h3>
                <span className={`text-xs font-semibold ${phase.statusClass}`}>
                  {phase.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-2">{phase.sublabel}</p>
              <p className="text-xs text-slate-400 leading-relaxed mb-1.5">
                <strong className="text-slate-300 font-semibold">
                  Objective:
                </strong>{" "}
                {phase.objective}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed mb-1.5">
                {phase.desc}
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-500 font-semibold not-italic">
                  AI Role:
                </strong>{" "}
                <em>{phase.aiRole}</em>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 4. AI & Identity ── */}
      <H2>4. The Role of AI &amp; Identity</H2>

      <div className="grid gap-3 my-6">
        {[
          {
            icon: <Brain className="h-5 w-5 text-emerald-400" aria-hidden="true" />,
            label: "AI is an Analyst, not an Oracle",
            desc: "PumpMatch's intelligence engine remains deterministic at its core. AI is layered on top to interpret, investigate, and compose reports — never to replace verifiable on-chain measurement.",
            border: "border-emerald-500/20",
          },
          {
            icon: <Eye className="h-5 w-5 text-blue-400" aria-hidden="true" />,
            label: "Identity requires Consent",
            desc: "Analysis does not require identity. A wallet can be analyzed in Ghost Mode without being indexed publicly. Public profiles, discoverability, and social linking require explicit user opt-in.",
            border: "border-blue-500/20",
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`flex items-start gap-4 rounded-xl border ${item.border} bg-slate-900/50 p-4`}
          >
            <div className="mt-0.5 shrink-0">{item.icon}</div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">
                {item.label}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 5. Core Design Law ── */}
      <H2>5. Core Design Law</H2>

      <P>
        PumpMatch must always preserve this strict hierarchy. Any feature that
        violates this sequence is architecturally invalid.
      </P>

      <CodeBlock>{`// The sequence is non-negotiable
1. Raw events   ── truth          (immutable, append-only)
2. Features     ── measurements   (versioned, re-derivable)
3. Scores       ── interpretations (versioned model outputs)
4. Reputation   ── application    (built on scores)
5. Coordination ── future layer   (built on reputation)

Intelligence → Reputation → Coordination`}</CodeBlock>

      <div className="space-y-2 my-6">
        {designLaw.map((item) => (
          <div key={item.num} className="flex items-center gap-3">
            <span className="h-6 w-6 rounded-full border border-slate-700 bg-slate-900/60 flex items-center justify-center text-xs font-mono text-slate-500 shrink-0">
              {item.num}
            </span>
            <span className="text-sm text-slate-300">{item.text}</span>
          </div>
        ))}
      </div>

      <Callout
        icon={<ArrowRight className="h-4 w-4 text-slate-400" />}
        title="Next Step"
        variant="default"
      >
        Read the{" "}
        <Link
          href="/docs?tab=intelligence-core-v2"
          className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300 transition-[color] duration-150 font-semibold"
        >
          Intelligence Core v2 specification
        </Link>{" "}
        for the full architecture detail behind Phase 1.
      </Callout>
    </article>
  );
}
