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
    default:
      "border-slate-700/50 bg-slate-800/30 text-slate-300",
    warning:
      "border-amber-500/20 bg-amber-500/5 text-amber-300",
    success:
      "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
  };

  return (
    <div
      className={`rounded-xl border p-4 md:p-5 my-6 ${colors[variant]}`}
    >
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
      {/* Hackathon Badge */}
      <div className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/5 px-4 py-1.5 text-xs font-semibold text-purple-300">
          <Zap className="h-3.5 w-3.5 text-purple-400" />
          Build in Public &mdash; Pump.fun Hackathon 2026
        </span>
      </div>

      <SectionBadge>Getting Started</SectionBadge>
      <H1>The Reputation Layer for Pump.fun</H1>

      <P>
        Pump Match is an on-chain matchmaking engine built for the Pump.fun
        ecosystem. It analyzes wallet behavior, calculates trust scores, and
        connects verified degens into high-signal squads.
      </P>
      <P>
        Instead of blindly DMing strangers on Discord, you can now discover
        teammates whose on-chain reputation speaks for itself.
      </P>

      <H2>From PvP to Co-Op</H2>
      <P>
        The Pump.fun ecosystem is full of talent &mdash; devs shipping smart
        contracts, whales with deep liquidity, artists minting culture, and
        community leaders rallying thousands. But right now, finding these
        people is pure PvP: scams, fake followers, and zero signal.
      </P>
      <P>
        Pump Match flips the script. We transform the ecosystem from
        every-person-for-themselves into a cooperative network where trust
        is earned, scored, and matched.
      </P>

      <Callout
        icon={<Shield className="h-4 w-4 text-emerald-400" />}
        title="Core Philosophy"
        variant="success"
      >
        <ul className="space-y-1.5 list-disc list-inside">
          <li>
            <strong className="text-slate-200">Identity over Assets</strong> &mdash; We
            measure behavior and reputation, not just balance.
          </li>
          <li>
            <strong className="text-slate-200">Consent First</strong> &mdash; Only users who
            explicitly opt-in are indexed in the Match Registry.
          </li>
          <li>
            <strong className="text-slate-200">Weak Link Principle</strong> &mdash; In a
            squad, risk is defined by the least trustworthy member.
          </li>
        </ul>
      </Callout>

      <H2>How It Works</H2>
      <div className="grid gap-4 md:grid-cols-3 my-6">
        {[
          {
            step: "01",
            title: "Analyze",
            desc: "Paste any Solana wallet or connect your own. We scan on-chain history, assets, and first activity.",
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
            title: "Match",
            desc: "Join the network. Get matched with verified devs, whales, and builders who complement your profile.",
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

      <H2>Quick Start</H2>
      <P>
        No signup required to analyze. Just paste a wallet address and hit
        &ldquo;Analyze&rdquo;. To unlock squad matching, connect your wallet and
        join the Pump Match Network.
      </P>
      <CodeBlock>
        {`1. Go to pumpmatch.app\n2. Paste a Solana wallet address\n3. View Trust Score + Badges\n4. Connect wallet → "Join Pump Match Network"\n5. Discover your perfect squad`}
      </CodeBlock>
    </article>
  );
}

// ──────────────────────────────────────────────────────────────
// TRUST SCORE SECTION
// ──────────────────────────────────────────────────────────────

export function TrustSection() {
  return (
    <article className="max-w-3xl">
      <SectionBadge>Core Concepts</SectionBadge>
      <H1>Trust Score</H1>

      <P>
        Trust is not claimed. It is calculated. The Trust Score is a
        deterministic, on-chain metric that measures wallet reputation
        across multiple dimensions.
      </P>

      <Callout
        icon={<Shield className="h-4 w-4 text-emerald-400" />}
        title="Deterministic Scoring"
        variant="success"
      >
        Every score is reproducible. Given the same on-chain data, the same
        score is produced every time. No randomness, no manual overrides.
      </Callout>

      <H2>Scoring Dimensions</H2>

      <H3>1. Wallet Age (Age Bracketing)</H3>
      <P>
        How long has this wallet been active? We detect the first transaction
        and calculate the approximate age. Newer wallets get lower scores &mdash;
        this helps filter out freshly created bot wallets.
      </P>
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 my-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            { range: "< 7 days", score: "0 pts", color: "text-rose-400" },
            { range: "7–30 days", score: "+0.5 pts", color: "text-amber-400" },
            { range: "30–180 days", score: "+1 pt", color: "text-emerald-300" },
            { range: "180+ days", score: "+2 pts", color: "text-emerald-400" },
          ].map((bracket) => (
            <div key={bracket.range} className="text-center">
              <p className="text-slate-500 mb-1">{bracket.range}</p>
              <p className={`font-semibold font-mono ${bracket.color}`}>
                {bracket.score}
              </p>
            </div>
          ))}
        </div>
      </div>

      <H3>2. Asset Portfolio</H3>
      <P>
        We analyze SOL balance, token holdings, and NFT/asset count. A
        diversified portfolio signals a real, engaged user rather than a
        single-purpose bot.
      </P>

      <H3>3. Transaction History</H3>
      <P>
        Transaction count and pattern analysis reveal how active a wallet is.
        High activity with consistent patterns builds trust; sudden bursts
        can indicate suspicious behavior.
      </P>

      <H3>4. Social Proof &amp; Badges</H3>
      <P>
        Badges are earned, not purchased. System badges (Whale, Dev, OG Wallet)
        are assigned algorithmically. Social badges (Community Trusted, Governor)
        require human endorsement from other network members.
      </P>

      <Callout
        icon={<Clock className="h-4 w-4 text-amber-400" />}
        title="Activity Decay"
        variant="warning"
      >
        Trust isn&apos;t permanent. If a user goes inactive, their match
        visibility decays: full weight within 24h, 90% at 72h, 70% at 7 days.
        After 7 days, they enter &ldquo;Sleeping Mode&rdquo; and are excluded from
        active match results (but never removed from the registry).
      </Callout>

      <H2>The Weak Link Formula</H2>
      <P>
        Match confidence between two users isn&apos;t a simple average. We apply
        the Weak Link Principle: the lower-trust user pulls the score down
        disproportionately. This protects high-trust users from being matched
        with unverified wallets.
      </P>
      <CodeBlock>
        {`BaseScore = (Min × 0.7) + (Max × 0.3)\nFinalScore = min(98, BaseScore + BadgeBonus + IntentBonus)\n\nWhere:\n  Min = lower trust score of the two users\n  Max = higher trust score of the two users`}
      </CodeBlock>

      <H2>Identity Hierarchy</H2>
      <P>
        Each user in the network has an identity state that can only move
        upward. This prevents gaming through verification downgrade.
      </P>
      <div className="flex items-center gap-3 my-6 text-sm">
        <span className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-slate-500">
          Ghost
        </span>
        <ArrowRight className="h-4 w-4 text-slate-600" />
        <span className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-sky-400">
          Reachable
        </span>
        <ArrowRight className="h-4 w-4 text-slate-600" />
        <span className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-400">
          Verified
        </span>
      </div>
    </article>
  );
}

// ──────────────────────────────────────────────────────────────
// GOD MODE SECTION
// ──────────────────────────────────────────────────────────────

export function GodModeSection() {
  return (
    <article className="max-w-3xl">
      <SectionBadge>Core Concepts</SectionBadge>
      <H1>God Mode Discovery</H1>

      <P>
        God Mode is the advanced filtering system that lets you search the
        entire Pump Match network with surgical precision. Think of it as
        a headhunter interface for on-chain talent.
      </P>

      <H2>The AND Logic</H2>
      <P>
        Unlike traditional search where selecting multiple filters broadens
        results (OR logic), God Mode uses strict AND logic. This means every
        selected filter must be satisfied simultaneously.
      </P>

      <Callout
        icon={<Filter className="h-4 w-4 text-emerald-400" />}
        title="Example: Whale + Dev"
        variant="success"
      >
        Selecting both &ldquo;Whale&rdquo; and &ldquo;Dev&rdquo; returns only users who have
        both the Whale badge AND the Dev badge. This narrows
        results to elite, multi-dimensional profiles.
      </Callout>

      <H2>Available Filters</H2>
      <div className="grid gap-3 md:grid-cols-2 my-6">
        {[
          {
            label: "Whale",
            desc: "High SOL balance (10+ SOL). System-assigned badge.",
            icon: <Wallet className="h-4 w-4 text-indigo-400" />,
            border: "border-indigo-500/30",
          },
          {
            label: "Dev",
            desc: "Multiple program interactions detected. Builder profile.",
            icon: <Activity className="h-4 w-4 text-blue-400" />,
            border: "border-blue-500/30",
          },
          {
            label: "Early Adopter",
            desc: "OG Wallet badge. Wallet active for 180+ days.",
            icon: <Clock className="h-4 w-4 text-amber-400" />,
            border: "border-amber-500/30",
          },
          {
            label: "High Roller",
            desc: "Trust Score >= 90. The top tier of the network.",
            icon: <Zap className="h-4 w-4 text-emerald-400" />,
            border: "border-emerald-500/30",
          },
        ].map((filter) => (
          <div
            key={filter.label}
            className={`rounded-xl border ${filter.border} bg-slate-900/50 p-4`}
          >
            <div className="flex items-center gap-2 mb-2">
              {filter.icon}
              <span className="text-sm font-semibold text-slate-200">
                {filter.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {filter.desc}
            </p>
          </div>
        ))}
      </div>

      <H2>Additional Controls</H2>

      <H3>Min Trust Score Slider</H3>
      <P>
        Set a floor for search results. Default is 70, filtering out low-quality
        profiles. Slide down to 0 for maximum discovery, or up to 90+ for
        elite-only results.
      </P>

      <H3>Verified Only Toggle</H3>
      <P>
        When enabled, only users with the VERIFIED identity state appear.
        These are users who have completed on-chain identity verification &mdash;
        the highest level of trust in the network.
      </P>

      <H2>How Results Are Displayed</H2>
      <P>
        Search results appear as a responsive grid of Micro Cards &mdash; minimal
        profile tiles showing avatar, username, trust score, and badge icons.
        Click any card to load their full trust analysis.
      </P>
      <P>
        Results are sorted by Trust Score (highest first), giving you
        instant visibility into the most reputable network members.
      </P>
    </article>
  );
}

// ──────────────────────────────────────────────────────────────
// TOKENOMICS SECTION
// ──────────────────────────────────────────────────────────────

export function TokenomicsSection() {
  return (
    <article className="max-w-3xl">
      <SectionBadge>Economics</SectionBadge>
      <H1>$MATCH Utility</H1>

      <P>
        $MATCH is the native utility token of the Pump Match ecosystem. It
        is not a governance token or a speculative asset &mdash; it is the fuel
        that powers premium features and on-chain verification.
      </P>

      <Callout
        icon={<Coins className="h-4 w-4 text-emerald-400" />}
        title="Utility-First Design"
        variant="success"
      >
        Every $MATCH use case directly maps to a product feature. No empty
        promises, no inflationary rewards. Pure utility.
      </Callout>

      <H2>Token Use Cases</H2>

      <div className="space-y-4 my-6">
        {[
          {
            title: "Identity Verification",
            desc: "Burn $MATCH to upgrade your identity state from Ghost to Verified. This is a permanent, one-time action that signals commitment.",
            icon: <CheckCircle2 className="h-5 w-5 text-amber-400" />,
            tag: "BURN",
          },
          {
            title: "Premium Discovery",
            desc: "Stake $MATCH to access advanced God Mode filters, expanded result limits, and priority matching in the network.",
            icon: <Crosshair className="h-5 w-5 text-purple-400" />,
            tag: "STAKE",
          },
          {
            title: "Squad Rooms",
            desc: "Create private, token-gated squad rooms where only verified members can participate. Costs $MATCH to create, free to join if invited.",
            icon: <Users className="h-5 w-5 text-emerald-400" />,
            tag: "SPEND",
          },
          {
            title: "Reputation Insurance",
            desc: "Lock $MATCH as collateral to back your reputation. If you act maliciously, your stake is slashed. Good actors earn yield.",
            icon: <Lock className="h-5 w-5 text-sky-400" />,
            tag: "LOCK",
          },
        ].map((useCase) => (
          <div
            key={useCase.title}
            className="flex gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 md:p-5"
          >
            <div className="flex-shrink-0 mt-0.5">{useCase.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-sm font-semibold text-slate-200">
                  {useCase.title}
                </h3>
                <span className="rounded-full border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[9px] font-mono font-bold text-slate-500 uppercase">
                  {useCase.tag}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {useCase.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <H2>Token Distribution</H2>
      <P>
        $MATCH will be launched on Pump.fun with a fair launch model. No
        presale, no VC allocation, no team tokens at launch.
      </P>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 my-6">
        <div className="space-y-3">
          {[
            { label: "Community Fair Launch", pct: "40%", color: "bg-emerald-500" },
            { label: "Ecosystem Rewards", pct: "25%", color: "bg-purple-500" },
            { label: "Development Fund", pct: "20%", color: "bg-sky-500" },
            { label: "Liquidity Pool", pct: "15%", color: "bg-amber-500" },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">{item.label}</span>
                <span className="text-xs font-mono font-semibold text-slate-300">
                  {item.pct}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${item.color}`}
                  style={{ width: item.pct }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Callout
        icon={<Zap className="h-4 w-4 text-purple-400" />}
        title="Launch Timeline"
      >
        $MATCH token launch is planned for post-hackathon. The current MVP
        focuses on proving the core matching engine. Token integration will
        follow once the network reaches critical mass.
      </Callout>
    </article>
  );
}
