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
  return (
    <article className="max-w-3xl">
      <SectionBadge>Getting Started</SectionBadge>
      <H1>The Trust Layer for Solana</H1>

      <P>
        PumpMatch is a decentralized infrastructure protocol and matchmaking engine built on Solana. We solve Web3's most critical vulnerability: <strong>Trust.</strong>
      </P>
      <P>
        By deriving verifiable reputation from on-chain history, PumpMatch enables founders, developers, and marketers to build elite squads, orchestrate workflows, and execute trustless collaboration.
      </P>

      <H2>The Coordination Problem</H2>
      <P>
        The current Solana ecosystem moves at lightning speed, but coordination is broken. Anonymous actors, rug pulls, and a lack of accountability make forming a reliable team a high-risk gamble. Finding top-tier talent often relies on blind trust in Discord or Telegram.
      </P>
      <P>
        PumpMatch replaces "blind trust" with <strong>cryptographic truth</strong>. We transform the ecosystem from an untrustworthy PvP environment into a cooperative network where reputation is earned, scored, and verifiable.
      </P>

      <Callout
        icon={<Shield className="h-4 w-4 text-emerald-400" />}
        title="Core Philosophy"
        variant="success"
      >
        <ul className="space-y-1.5 list-disc list-inside">
          <li>
            <strong className="text-slate-200">Identity over Assets</strong> &mdash; We measure behavior, execution, and history, not just token balances.
          </li>
          <li>
            <strong className="text-slate-200">Consent First</strong> &mdash; Only users who explicitly authenticate are indexed in the Match Registry.
          </li>
          <li>
            <strong className="text-slate-200">Weak Link Principle</strong> &mdash; In a squad, the collective risk is defined by the least trustworthy member.
          </li>
        </ul>
      </Callout>

      <H2>How It Works</H2>
      <div className="grid gap-4 md:grid-cols-3 my-6">
        {[
          {
            step: "01",
            title: "Analyze",
            desc: "Connect your wallet. We scan on-chain history, assets, and project interactions to build your profile.",
            icon: <Activity className="h-5 w-5 text-emerald-400" />,
          },
          {
            step: "02",
            title: "Score",
            desc: "Our Trust Engine calculates a deterministic score based on balance, activity, age, and social proof.",
            icon: <Shield className="h-5 w-5 text-emerald-400" />,
          },
          {
            step: "03",
            title: "Orchestrate",
            desc: "Form a verified Squad. Assign Role Slots, propose revenue splits, and sign cryptographically.",
            icon: <Users className="h-5 w-5 text-emerald-400" />,
          },
        ].map((item) => (
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
    </article>
  );
}

// ──────────────────────────────────────────────────────────────
// TRUST SCORE SECTION
// ──────────────────────────────────────────────────────────────

export function TrustSection() {
  return (
    <article className="max-w-3xl">
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
        How long has this wallet been active? We detect the first transaction to calculate age. Newer wallets face severe score penalties—filtering out freshly created bot wallets and "burner" addresses used for rug pulls.
      </P>

      <H3>2. Asset Portfolio & Diversity</H3>
      <P>
        We analyze SOL balances, token holdings, and NFT assets. A highly diversified portfolio with historical holding patterns signals a real, engaged network participant rather than a single-purpose bot.
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
        Finding a team is only step one. <strong>Squad OS</strong> is the operational engine that turns a loose group of wallets into a disciplined, execution-ready protocol entity.
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
            desc: "Once slots are filled, the Founder proposes a Revenue Split (measured in Basis Points - BPS). For example: 70% Founder, 15% Developer, 15% Marketer.",
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
// ROADMAP SECTION
// ──────────────────────────────────────────────────────────────

export function RoadmapSection() {
  return (
    <article className="max-w-3xl">
      <SectionBadge>Vision</SectionBadge>
      <H1>Master Roadmap</H1>

      <P>
        PumpMatch is developed in deliberate, sequential phases to ensure security, scalability, and optimal user experience. Our roadmap focuses on transitioning from off-chain coordination to fully trustless on-chain execution.
      </P>

      <div className="space-y-6 my-8">

        {/* Phase 1 & 2 */}
        <div className="relative pl-6 border-l-2 border-slate-700 pb-2">
          <div className="absolute w-3 h-3 bg-slate-500 rounded-full -left-[7px] top-1"></div>
          <h3 className="text-sm font-bold text-slate-400 mb-1">Phase 1 & 2: Identity & Matchmaking <span className="text-xs font-normal text-slate-500 ml-2">(Completed)</span></h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Integration of Solana Wallet Adapter, establishment of Supabase RLS infrastructure, deployment of the Trust Engine algorithm, and the launch of the Arena Leaderboard.
          </p>
        </div>

        {/* Phase 3 */}
        <div className="relative pl-6 border-l-2 border-emerald-500 pb-2">
          <div className="absolute w-3 h-3 bg-emerald-400 rounded-full -left-[7px] top-1 shadow-[0_0_10px_rgba(52,211,153,0.8)]"></div>
          <h3 className="text-sm font-bold text-emerald-400 mb-1">Phase 2.5: Squad OS <span className="text-xs font-normal text-emerald-500/70 ml-2">(Current Focus)</span></h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-2">
            Transforming raw match data into actionable workflows.
          </p>
          <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
            <li>Role Slots capacity tracking (DEV, MKT, etc.)</li>
            <li>Strict State Machine (Forming ➔ Launch Ready)</li>
            <li>Off-chain Cryptographic Split Proposals & Signatures</li>
          </ul>
        </div>

        {/* Phase 4 */}
        <div className="relative pl-6 border-l-2 border-slate-800 pb-2">
          <div className="absolute w-3 h-3 border-2 border-slate-600 bg-slate-900 rounded-full -left-[7px] top-1"></div>
          <h3 className="text-sm font-bold text-slate-300 mb-1">Phase 3.0: Verified Launch & On-Chain Registry</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-2">
            Moving off-chain agreements into immutable Solana smart contracts.
          </p>
          <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
            <li>Deploying "Verified Squad" PDAs to Solana Mainnet</li>
            <li>Trustless, automated Revenue Splitting upon launch</li>
            <li>Launchpad tax mechanisms and ecosystem funding</li>
          </ul>
        </div>

        {/* Phase 5 */}
        <div className="relative pl-6 border-transparent">
          <div className="absolute w-3 h-3 border-2 border-slate-600 bg-slate-900 rounded-full -left-[7px] top-1"></div>
          <h3 className="text-sm font-bold text-slate-300 mb-1">Phase 4.0: Ecosystem Oracle & Comms</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-2">
            Becoming the default Trust Layer API for the Solana Network.
          </p>
          <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
            <li>B2B Trust API for external dApp Sybil resistance</li>
            <li>Stake-to-Access premium filters and gating</li>
            <li>High-signal, token-gated communication channels</li>
          </ul>
        </div>

      </div>
    </article>
  );
}
