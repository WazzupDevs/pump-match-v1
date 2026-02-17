import { supabase } from './supabase';
import type { UserProfile, NetworkAgent, MatchProfile, SearchFilters } from '@/types';

// ── YARDIMCI: Tip Dönüşümleri ──
// Supabase'den gelen veriyi bizim UserProfile tipine çevirir
function mapDbUserToProfile(dbUser: Record<string, unknown>): UserProfile {
  return {
    id: dbUser.id as string,
    address: dbUser.wallet_address as string,
    username: (dbUser.username as string) || 'Anon',
    role: (dbUser.level as UserProfile['role']) || 'Community',
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

export async function upsertUser(wallet: string, partialData: Partial<Record<string, unknown>>) {
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
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('is_opted_in', true)
    .neq('wallet_address', userAddress)
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
  await supabase
    .from('users')
    .update({
      cached_matches: matches,
      last_match_snapshot_at: Date.now(),
    })
    .eq('wallet_address', wallet);
}

// ── 3. GOD MODE / SEARCH ──

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
      query = query.contains('active_badges', JSON.stringify([{ id: badgeId }]));
    }
  }

  const { data, error } = await query.limit(50);

  if (error || !data) return [];

  return data.map((user) => ({
    id: user.id as string,
    address: user.wallet_address as string,
    username: (user.username as string) || 'Anon',
    role: user.level as NetworkAgent['role'],
    trustScore: user.trust_score as number,
    identityState: user.identity_state as NetworkAgent['identityState'],
    activeBadges: (user.active_badges as NetworkAgent['activeBadges']) || [],
    tags: (user.tags as string[]) || [],
  }));
}
