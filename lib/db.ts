import { supabase } from './supabase';
import type { UserProfile, NetworkAgent, MatchProfile, SearchFilters, Role, Badge, SocialProof, IdentityState, UserIntent, SocialLinks, SquadMember, SquadMemberStatus } from '@/types';

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
function mapDbUserToProfile(dbUser: Record<string, unknown>): UserProfile {
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
    lastActiveAt: (dbUser.last_active_at as number) || Date.now(),
    isOptedIn: dbUser.is_opted_in === true,
    joinedAt: (dbUser.joined_at as number) || Date.now(),
    identityState: (dbUser.identity_state as UserProfile['identityState']) || 'GHOST',
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

// isUserRegistered: async wrapper that checks DB
export async function isUserRegistered(wallet: string): Promise<boolean> {
  const profile = await getUserProfile(wallet);
  return profile?.isOptedIn === true;
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

  const { data, error } = await supabase
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

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('is_opted_in', true)
    .neq('wallet_address', userAddress)
    .gte('last_active_at', sevenDaysAgo)
    .limit(limit);

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error('[findMatches] Supabase query error:', error);
    return [];
  }

  return data.map(mapDbUserToProfile);
}

// Snapshot güncelleme
export async function updateMatchSnapshot(wallet: string, matches: MatchProfile[]) {
  const { error } = await supabase
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
  const { error } = await supabase
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
  let query = supabase
    .from('users')
    .select('*')
    .eq('is_opted_in', true); // Only search opted-in agents

  if (filters.minTrustScore) {
    query = query.gte('trust_score', filters.minTrustScore);
  }

  if (filters.verifiedOnly) {
    query = query.eq('identity_state', 'VERIFIED');
  }

  if (filters.badgeFilters && filters.badgeFilters.length > 0) {
    for (const badgeId of filters.badgeFilters) {
      // JSONB array containment: pass array of objects directly, not JSON string
      query = query.contains('active_badges', [{ id: badgeId }]);
    }
  }

  const { data, error } = await query.limit(50);

  if (error || !data) return [];

  return data.map((user) => ({
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

function maskAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function mapDbMember(row: Record<string, unknown>): SquadMember {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    walletAddress: row.wallet_address as string,
    displayAddress: maskAddress(row.wallet_address as string),
    role: row.role as SquadMember['role'],
    status: (row.status as SquadMemberStatus) ?? 'active',
    joinedAt: row.joined_at as string,
  };
}

/** Add a member to a squad. Idempotent — UNIQUE(project_id, wallet_address). */
export async function addSquadMember(
  projectId: string,
  walletAddress: string,
  role?: string,
  status: SquadMemberStatus = 'active',
): Promise<{ success: boolean; alreadyMember: boolean }> {
  const { error } = await supabase
    .from('squad_members')
    .insert({ project_id: projectId, wallet_address: walletAddress, role: role ?? null, status });

  if (error) {
    if (error.code === '23505') return { success: true, alreadyMember: true };
    // eslint-disable-next-line no-console
    console.error('[addSquadMember] Error:', error);
    return { success: false, alreadyMember: false };
  }
  return { success: true, alreadyMember: false };
}

/** Get all members of a squad project. */
export async function getSquadMembers(projectId: string): Promise<SquadMember[]> {
  const { data, error } = await supabase
    .from('squad_members')
    .select('*')
    .eq('project_id', projectId)
    .order('joined_at', { ascending: true });

  if (error || !data) return [];
  return data.map(mapDbMember);
}

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

/** Remove a member from a squad. Only founder or the member themselves can do this (enforced at action layer). */
export async function removeSquadMember(projectId: string, walletAddress: string): Promise<boolean> {
  const { error } = await supabase
    .from('squad_members')
    .delete()
    .eq('project_id', projectId)
    .eq('wallet_address', walletAddress);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[removeSquadMember] Error:', error);
    return false;
  }
  return true;
}
