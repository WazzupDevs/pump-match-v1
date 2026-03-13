export type IntelligenceReportSchemaVersion = "intelligence-report.v3";

export type ObservationWindowKind =
  | "ROLLING_30D"
  | "ROLLING_90D"
  | "ROLLING_180D"
  | "CUSTOM";

export type CoverageTier = "LOW" | "MEDIUM" | "HIGH";
export type AxisStatus = "MEASURED" | "ESTIMATED" | "INSUFFICIENT";

export type PrimaryStyleLabel =
  | "CONVICTION_LED"
  | "ROTATION_LED"
  | "MOMENTUM_REACTIVE"
  | "OPPORTUNISTIC"
  | "PASSIVE_ALLOCATOR"
  /**
   * Emitted when the wallet has no closed positions, fewer than 5 total
   * transactions observed, and hard-insufficient credibility. Prevents the
   * system from inventing a trader persona for behaviorally-empty wallets.
   */
  | "INSUFFICIENT_DATA";

export type WalletIdentityV3 = {
  readonly address: string;
  readonly chain: "solana";
};

export type ObservationWindow = {
  readonly kind: ObservationWindowKind;
  readonly startAt: string;
  readonly endAt: string;
};

export type CoverageAssessment = {
  readonly tier: CoverageTier;
  readonly txSampleSize: number;
  readonly positionsSampled: number;
  readonly activeDaysObserved: number;
  readonly familyCompleteness: number;
  readonly axisReliability: {
    readonly style: CoverageTier;
    readonly quality: CoverageTier;
    readonly risk: CoverageTier;
    readonly adaptation: CoverageTier;
    readonly credibility: CoverageTier;
  };
};

export type AxisComponentScore = {
  readonly key: string;
  readonly value: number;
};

export type AxisResult = {
  readonly overall: number;
  readonly status: AxisStatus;
  readonly components: readonly AxisComponentScore[];
};

export type StyleAxis = AxisResult & {
  readonly dimensions: {
    readonly conviction: number;
    readonly rotation: number;
    readonly momentum: number;
    readonly patience: number;
    readonly opportunism: number;
  };
};

export type QualityAxis = AxisResult;
export type RiskAxis = AxisResult;
export type AdaptationAxis = AxisResult;
export type CredibilityAxis = AxisResult;

export type BehavioralAxes = {
  readonly style: StyleAxis;
  readonly quality: QualityAxis;
  readonly risk: RiskAxis;
  readonly adaptation: AdaptationAxis;
  readonly credibility: CredibilityAxis;
};

export type NumericSignal = {
  readonly kind: "number";
  readonly value: number;
  readonly core: boolean;
};

export type TierSignal<T extends string> = {
  readonly kind: "tier";
  readonly value: T;
  readonly core: boolean;
};

export type EnumSignal<T extends string> = {
  readonly kind: "enum";
  readonly value: T;
  readonly core: boolean;
};

export type ActivitySignals = {
  readonly activeDaysRatio: NumericSignal;
  readonly txTempo: TierSignal<"LOW" | "MEDIUM" | "HIGH">;
  readonly sessionBurstiness: NumericSignal;
};

export type PositionSignals = {
  readonly medianHoldDurationTier: EnumSignal<
    "VERY_SHORT" | "SHORT" | "MEDIUM" | "LONG"
  >;
  readonly fastFlipRatio: NumericSignal;
  readonly concentrationIndex: NumericSignal;
};

export type RotationSignals = {
  readonly tokenChurnRate: NumericSignal;
  readonly reEntryPattern: EnumSignal<"RARE" | "OCCASIONAL" | "FREQUENT">;
  readonly narrativeSwitchRate: TierSignal<"LOW" | "MEDIUM" | "HIGH">;
};

export type RiskSignals = {
  readonly microcapExposureTier: EnumSignal<"LOW" | "MEDIUM" | "HIGH">;
  readonly illiquidExposureTier: EnumSignal<"LOW" | "MEDIUM" | "HIGH">;
  readonly panicExitPattern: TierSignal<"LOW" | "MEDIUM" | "HIGH">;
};

export type MarketPostureSignals = {
  readonly momentumParticipation: TierSignal<"LOW" | "MEDIUM" | "HIGH">;
  readonly dipBuyConsistency: TierSignal<"LOW" | "MEDIUM" | "HIGH">;
  readonly breakoutChaseTendency: TierSignal<"LOW" | "MEDIUM" | "HIGH">;
};

export type ProtocolSignals = {
  readonly dexPreferenceConsistency: TierSignal<"LOW" | "MEDIUM" | "HIGH">;
  readonly bridgeUsagePattern: EnumSignal<"NONE" | "OCCASIONAL" | "FREQUENT">;
  readonly stakingVsSpeculationBias: EnumSignal<
    "STAKING_LEANING" | "BALANCED" | "SPECULATION_LEANING"
  >;
};

export type BehavioralSignalFamilies = {
  readonly activity: ActivitySignals;
  readonly positions: PositionSignals;
  readonly rotation: RotationSignals;
  readonly risk: RiskSignals;
  readonly marketPosture: MarketPostureSignals;
  readonly protocol: ProtocolSignals;
};

export type PrimaryStyleClassification = {
  readonly label: PrimaryStyleLabel;
  readonly confidence: number;
  readonly affinities: {
    readonly convictionLed: number;
    readonly rotationLed: number;
    readonly momentumReactive: number;
    readonly opportunistic: number;
    readonly passiveAllocator: number;
  };
  readonly explanation: string;
};

export type BadgeStrength = "soft" | "strong";

export type BadgeEvidenceRef = {
  readonly sourceType: "signal" | "axis";
  readonly sourcePath: string;
};

export type IntelligenceBadgeV3 = {
  readonly code: string;
  readonly label: string;
  readonly reason: string;
  readonly strength: BadgeStrength;
  readonly evidence: readonly BadgeEvidenceRef[];
};

export type DeterministicSummary = {
  /**
   * Template-derived, deterministic. NOT generated by an LLM.
   */
  readonly headline: string;
  /**
   * Template-derived, deterministic. NOT generated by an LLM.
   */
  readonly description: string;
  /**
   * Template-derived, deterministic. NOT generated by an LLM.
   */
  readonly keyPoints: readonly string[];
};

export type BehavioralProfile = {
  readonly operatorType:
    | "CONVICTION_OPERATOR"
    | "ROTATION_OPERATOR"
    | "MOMENTUM_OPERATOR"
    | "OPPORTUNISTIC_OPERATOR"
    | "ALLOCATOR";
  readonly pace: "FAST" | "MODERATE" | "PATIENT";
  readonly convictionProfile:
    | "HIGH_CONVICTION"
    | "MIXED_CONVICTION"
    | "LOW_CONVICTION";
  readonly riskPosture: "CONTROLLED" | "ELEVATED" | "AGGRESSIVE";
  readonly adaptationProfile: "STICKY" | "RESPONSIVE" | "HIGHLY_ADAPTIVE";
};

export type TransitionalCompatibilityV3 = {
  /**
   * @deprecated Transitional only. Do not treat as canonical intelligence.
   */
  readonly compatibilityScore?: number | null;
  /**
   * @deprecated Transitional only. Do not treat as canonical intelligence.
   */
  readonly trustScore?: number | null;
};

export type IntelligenceReportV3 = {
  readonly schemaVersion: IntelligenceReportSchemaVersion;
  readonly producerVersion: string;
  readonly computedAt: string;

  readonly wallet: WalletIdentityV3;
  readonly observationWindow: ObservationWindow;
  readonly coverage: CoverageAssessment;

  readonly primaryStyle: PrimaryStyleClassification;
  readonly axes: BehavioralAxes;
  readonly signals: BehavioralSignalFamilies;
  readonly badges: readonly IntelligenceBadgeV3[];
  readonly summary: DeterministicSummary;
  readonly behavioralProfile: BehavioralProfile;

  readonly _transitional?: TransitionalCompatibilityV3;
};