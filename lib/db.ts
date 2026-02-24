import { supabase, supabaseAdmin } from './supabase';
import type { UserProfile, NetworkAgent, MatchProfile, SearchFilters, Role, Badge, SocialProof, IdentityState, UserIntent, SocialLinks } from '@/types';

// Strongly-typed input for upsertUser (replaces Partial<Record<string, unknown>>)
type UpsertUserData = {
  trust_score?: number;
  level?: string;
  username?: string;
  activeBadges?: Badge[];
  socialProof?: SocialProof;
  identityState?: IdentityState;
  is_opted_in?: boolean;
  intent?: UserIntent;
  tags?: string[];
  joined_at?: number;
  match_filters?: { minTrustScore?: number };
  social_links?: SocialLinks;
};

const VALID_ROLES: Role[] = ["Dev", "Artist", "Marketing", "Whale", "Community"];

function toValidRole(value: unknown): Role {
  return VALID_ROLES.includes(value as Role) ? (value as Role) : "Community";
}

// ── YARDIMCI: Tip Dönüşümleri ──
// Supabase'den gelen veriyi bizim UserProfile tipine çevirir
/**
 * Compute reputationDecay (0.0–1.0) from lastActiveAt.
 * 1.0 = active in last 7 days (full reputation)
 * 0.7 = active 7–30 days ago (slight decay)
 * 0.3 = active 30–90 days ago (significant decay)
 * 0.1 = inactive 90+ days (near-full decay)
 */
function computeReputationDecay(lastActiveAt: number): number {
  const daysSinceActive = (Date.now() - lastActiveAt) / (24 * 60 * 60 * 1000);
  if (daysSinceActive <= 7)  return 1.0;
  if (daysSinceActive <= 30) return 0.7;
  if (daysSinceActive <= 90) return 0.3;
  return 0.1;
}

function mapDbUserToProfile(dbUser: Record<string, unknown>): UserProfile {
  const lastActiveAt = (dbUser.last_active_at as number) || Date.now();
  return {
    id: dbUser.id as string,
    address: dbUser.wallet_address as string,
    username: (dbUser.username as string) || 'Anon',
    role: toValidRole(dbUser.level),
    trustScore: dbUser.trust_score as number,
    tags: (dbUser.tags as string[]) ?? [],
    intent: dbUser.intent as UserProfile['intent'],
    socialProof: (dbUser.social_proof as UserProfile['socialProof']) || {
      verified: false,
      communityTrusted: false,
      endorsements: 0,
    },
    activeBadges: (dbUser.active_badges as UserProfile['activeBadges']) || [],
    lastActiveAt,
    isOptedIn: dbUser.is_opted_in === true,
    joinedAt: (dbUser.joined_at as number) || Date.now(),
    identityState: (dbUser.identity_state as UserProfile['identityState']) || 'GHOST',
    reputationDecay: computeReputationDecay(lastActiveAt),
    matchFilters: dbUser.match_filters as UserProfile['matchFilters'],
    cachedMatches: dbUser.cached_matches as UserProfile['cachedMatches'],
    lastMatchSnapshotAt: dbUser.last_match_snapshot_at as number | undefined,
    socialLinks: dbUser.social_links as UserProfile['socialLinks'],
  };
}

// ── 1. TEMEL CRUD İŞLEMLERİ ──

export async function getUserProfile(wallet: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', wallet)
    .single();

  if (error || !data) return null;
  return mapDbUserToProfile(data);
}

// isUserRegistered: lightweight existence check — avoids SELECT * overhead
export async function isUserRegistered(wallet: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('id, is_opted_in')
    .eq('wallet_address', wallet)
    .maybeSingle();

  if (error || !data) return false;
  return (data as { is_opted_in: boolean }).is_opted_in === true;
}

export async function upsertUser(wallet: string, partialData: UpsertUserData) {
  const dbData: Record<string, unknown> = {
    wallet_address: wallet,
    trust_score: partialData.trust_score,
    level: partialData.level,
    username: partialData.username,
    active_badges: partialData.activeBadges,
    social_proof: partialData.socialProof,
    identity_state: partialData.identityState,
    is_opted_in: partialData.is_opted_in,
    intent: partialData.intent,
    tags: partialData.tags,
    joined_at: partialData.joined_at,
    match_filters: partialData.match_filters,
    social_links: partialData.social_links,
    last_active_at: Date.now(),
  };

  // Remove undefined keys so Supabase doesn't null-out existing values
  for (const key of Object.keys(dbData)) {
    if (dbData[key] === undefined) {
      delete dbData[key];
    }
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert(dbData, { onConflict: 'wallet_address' })
    .select()
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error('Supabase Upsert Error:', error);
    return null;
  }
  return data;
}

// ── 2. MATCH ENGINE İHTİYAÇLARI ──

/**
 * Find opted-in network members for matching.
 * CRITICAL: Only returns users with is_opted_in = true.
 * Ghost users (not opted in) are excluded from matchmaking.
 */
export async function findMatches(
  userAddress: string,
  limit: number = 20,
): Promise<UserProfile[]> {
  // Sleeping Logic: Exclude users inactive for more than 7 days
  // (matches comment in match-engine.ts: "anything beyond 7 days is filtered by Sleeping Logic in db.ts")
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // Explicit column list: excludes 'cached_matches' JSONB to avoid fetching large blobs
  const MATCH_COLUMNS = [
    'id', 'wallet_address', 'username', 'level', 'trust_score', 'tags',
    'intent', 'social_proof', 'active_badges', 'last_active_at', 'is_opted_in',
    'joined_at', 'identity_state', 'match_filters', 'last_match_snapshot_at', 'social_links',
  ].join(', ');

  const { data, error } = await supabase
    .from('users')
    .select(MATCH_COLUMNS)
    .eq('is_opted_in', true)
    .neq('wallet_address', userAddress)
    .gte('last_active_at', sevenDaysAgo)
    .limit(limit);

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error('[findMatches] Supabase query error:', error);
    return [];
  }

  // Cast needed: Supabase loses generic inference when select() receives a string variable
  return (data as unknown as Record<string, unknown>[]).map(mapDbUserToProfile);
}

// Snapshot güncelleme
export async function updateMatchSnapshot(wallet: string, matches: MatchProfile[]) {
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      cached_matches: matches,
      last_match_snapshot_at: Date.now(),
    })
    .eq('wallet_address', wallet);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[updateMatchSnapshot] Supabase update error:', error);
  }
}

// ── 3. ENDORSEMENT SYSTEM ──

/**
 * Add an endorsement from one wallet to another.
 * Idempotent — UNIQUE(from_wallet, to_wallet) constraint prevents duplicates.
 */
export async function addEndorsement(
  fromWallet: string,
  toWallet: string,
): Promise<{ success: boolean; alreadyEndorsed: boolean }> {
  const { error } = await supabaseAdmin
    .from('endorsements')
    .insert({ from_wallet: fromWallet, to_wallet: toWallet });

  if (error) {
    // Postgres unique violation code = 23505
    if (error.code === '23505') {
      return { success: true, alreadyEndorsed: true };
    }
    // eslint-disable-next-line no-console
    console.error('[addEndorsement] Error:', error);
    return { success: false, alreadyEndorsed: false };
  }
  return { success: true, alreadyEndorsed: false };
}

/** Get total endorsement count for a single wallet. */
export async function getEndorsementCount(wallet: string): Promise<number> {
  const { count, error } = await supabase
    .from('endorsements')
    .select('id', { count: 'exact', head: true })
    .eq('to_wallet', wallet);

  if (error) return 0;
  return count ?? 0;
}

/** Check if fromWallet has already endorsed toWallet. */
export async function hasEndorsed(fromWallet: string, toWallet: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('endorsements')
    .select('id')
    .eq('from_wallet', fromWallet)
    .eq('to_wallet', toWallet)
    .maybeSingle();

  return !error && !!data;
}

/**
 * Batch: Get endorsement counts for multiple wallets.
 * Returns a Map<walletAddress, count> for efficient O(1) lookup.
 */
export async function getEndorsementCounts(wallets: string[]): Promise<Map<string, number>> {
  if (wallets.length === 0) return new Map();

  const { data, error } = await supabase
    .from('endorsements')
    .select('to_wallet')
    .in('to_wallet', wallets);

  if (error || !data) return new Map();

  const counts = new Map<string, number>();
  for (const row of data) {
    const wallet = row.to_wallet as string;
    counts.set(wallet, (counts.get(wallet) ?? 0) + 1);
  }
  return counts;
}

/**
 * Batch: Get which wallets in toWallets have been endorsed by fromWallet.
 * Returns a Set of endorsed wallet addresses.
 */
export async function getMyEndorsements(
  fromWallet: string,
  toWallets: string[],
): Promise<Set<string>> {
  if (toWallets.length === 0) return new Set();

  const { data, error } = await supabase
    .from('endorsements')
    .select('to_wallet')
    .eq('from_wallet', fromWallet)
    .in('to_wallet', toWallets);

  if (error || !data) return new Set();
  return new Set(data.map((row) => row.to_wallet as string));
}

// ── 4. GOD MODE / SEARCH ──

export async function searchNetwork(filters: SearchFilters): Promise<NetworkAgent[]> {
  // Explicit columns: NetworkAgent only needs a subset of user fields
  const SEARCH_COLUMNS = [
    'id', 'wallet_address', 'username', 'level',
    'trust_score', 'identity_state', 'active_badges', 'tags',
  ].join(', ');

  const limit  = Math.min(filters.limit  ?? 50, 100); // cap at 100
  const offset = filters.offset ?? 0;

  let query = supabase
    .from('users')
    .select(SEARCH_COLUMNS)
    .eq('is_opted_in', true); // Only search opted-in agents

  if (filters.minTrustScore) {
    query = query.gte('trust_score', filters.minTrustScore);
  }

  if (filters.verifiedOnly) {
    query = query.eq('identity_state', 'VERIFIED');
  }

  if (filters.username && filters.username.trim().length > 0) {
    // Case-insensitive partial match (Postgres ilike)
    query = query.ilike('username', `%${filters.username.trim()}%`);
  }

  if (filters.badgeFilters && filters.badgeFilters.length > 0) {
    for (const badgeId of filters.badgeFilters) {
      // JSONB array containment: pass array of objects directly, not JSON string
      query = query.contains('active_badges', [{ id: badgeId }]);
    }
  }

  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error || !data) return [];

  // Cast needed: Supabase loses generic inference when select() receives a string variable
  return (data as unknown as Record<string, unknown>[]).map((user) => ({
    id: user.id as string,
    address: user.wallet_address as string,
    username: (user.username as string) || 'Anon',
    role: toValidRole(user.level),
    trustScore: user.trust_score as number,
    identityState: user.identity_state as NetworkAgent['identityState'],
    activeBadges: (user.active_badges as NetworkAgent['activeBadges']) || [],
    tags: (user.tags as string[]) || [],
  }));
}

// ── 5. SQUAD MEMBER MANAGEMENT ──
// NOTE: addSquadMember, getSquadMembers and removeSquadMember were removed.
// All squad writes MUST go through the process_squad_transition stored procedure
// via executeSquadTransitionAction / addSquadMemberAction / joinSquadAction in arena.ts.
// All squad reads use getSquadMembersAction (arena.ts) which filters terminal states.

/** Get all squads a wallet address belongs to. */
export async function getMySquads(walletAddress: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('squad_members')
    .select('project_id')
    .eq('wallet_address', walletAddress)
    .eq('status', 'active');

  if (error || !data) return [];
  return data.map((row) => row.project_id as string);
}

/** Get member count per project (batch). Returns Map<projectId, count>. */
export async function getSquadMemberCounts(projectIds: string[]): Promise<Map<string, number>> {
  if (projectIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('squad_members')
    .select('project_id')
    .in('project_id', projectIds)
    .eq('status', 'active');

  if (error || !data) return new Map();

  const counts = new Map<string, number>();
  for (const row of data) {
    const id = row.project_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/**
 * GDPR opt-out: anonymize and deactivate a user profile.
 * Sets is_opted_in = false and wipes PII fields (username, social_links, tags,
 * cached_matches). The wallet_address row is kept so trust_score history is preserved
 * but the user is no longer visible in the network or matched.
 */
export async function leaveNetwork(wallet: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      is_opted_in: false,
      username: 'Anon',
      social_links: null,
      tags: [],
      cached_matches: null,
      last_match_snapshot_at: null,
      last_active_at: Date.now(),
    })
    .eq('wallet_address', wallet);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[leaveNetwork] Error:', error);
    return false;
  }
  return true;
}

