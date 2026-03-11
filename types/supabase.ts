export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      v_public_receipts: {
        Row: {
          id: string | null
          share_id: string
          wallet_address: string
          snapshot_id: string
          visibility:
            | "GHOST"
            | "CLAIMED_PRIVATE"
            | "PUBLIC"
            | "VERIFIED_PUBLIC"
          created_at: string | null
          expires_at: string | null
        }
        Insert: {
          [_ in never]: never
        }
        Update: {
          [_ in never]: never
        }
        Relationships: []
      }
      v_wallet_latest_intelligence: {
        Row: {
          user_id: string
          wallet_address: string
          visibility_mode:
            | "GHOST"
            | "CLAIMED_PRIVATE"
            | "PUBLIC"
            | "VERIFIED_PUBLIC"
            | null
          latest_snapshot_id: string | null
          style: Json | null
          quality: Json | null
          risk: Json | null
          confidence: Json | null
          summary: Json | null
          sample_size: number | null
          computed_at: number | null
        }
        Insert: {
          [_ in never]: never
        }
        Update: {
          [_ in never]: never
        }
        Relationships: []
      }
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      auth_nonces: {
        Row: {
          action: string
          created_at: string
          nonce: string
          wallet_address: string
        }
        Insert: {
          action: string
          created_at?: string
          nonce: string
          wallet_address: string
        }
        Update: {
          action?: string
          created_at?: string
          nonce?: string
          wallet_address?: string
        }
        Relationships: []
      }
      baseline_epochs: {
        Row: {
          created_at: string | null
          description: string | null
          is_active: boolean | null
          version: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          is_active?: boolean | null
          version: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          is_active?: boolean | null
          version?: string
        }
        Relationships: []
      }
      endorsements: {
        Row: {
          created_at: string
          from_wallet: string
          id: string
          to_wallet: string
        }
        Insert: {
          created_at?: string
          from_wallet: string
          id?: string
          to_wallet: string
        }
        Update: {
          created_at?: string
          from_wallet?: string
          id?: string
          to_wallet?: string
        }
        Relationships: []
      }
      engine_versions: {
        Row: {
          created_at: string | null
          description: string | null
          git_commit_hash: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          git_commit_hash?: string | null
          version: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          git_commit_hash?: string | null
          version?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          compatibility_score: number | null
          created_at: string | null
          id: string
          shared_interests: string[] | null
          user_one: string
          user_two: string
        }
        Insert: {
          compatibility_score?: number | null
          created_at?: string | null
          id?: string
          shared_interests?: string[] | null
          user_one: string
          user_two: string
        }
        Update: {
          compatibility_score?: number | null
          created_at?: string | null
          id?: string
          shared_interests?: string[] | null
          user_one?: string
          user_two?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_user_one_fkey"
            columns: ["user_one"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      processed_events: {
        Row: {
          event_type: string
          processed_at: string
          tx_hash: string
        }
        Insert: {
          event_type: string
          processed_at?: string
          tx_hash: string
        }
        Update: {
          event_type?: string
          processed_at?: string
          tx_hash?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          role: string | null
          twitter_linked_at: string | null
          twitter_user_id: string | null
          verified_x_handle: string | null
          wallet_address: string | null
          x_handle: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id: string
          role?: string | null
          twitter_linked_at?: string | null
          twitter_user_id?: string | null
          verified_x_handle?: string | null
          wallet_address?: string | null
          x_handle?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          role?: string | null
          twitter_linked_at?: string | null
          twitter_user_id?: string | null
          verified_x_handle?: string | null
          wallet_address?: string | null
          x_handle?: string | null
        }
        Relationships: []
      }
      project_owners: {
        Row: {
          assigned_at: string
          is_active: boolean
          owner_user_id: string
          revoked_at: string | null
          role: string
          token_address: string
        }
        Insert: {
          assigned_at?: string
          is_active?: boolean
          owner_user_id: string
          revoked_at?: string | null
          role?: string
          token_address: string
        }
        Update: {
          assigned_at?: string
          is_active?: boolean
          owner_user_id?: string
          revoked_at?: string | null
          role?: string
          token_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_owners_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reputation_snapshots: {
        Row: {
          analyzed_tx_count: number
          archetype: string
          baseline_version: string
          computed_at: string | null
          engine_version: string
          execution_count: number | null
          id: string
          longevity_days: number | null
          median_holding_duration: number | null
          pool_diversity: number | null
          proof_hash: string
          signal_tier: string
          wallet_id: string
        }
        Insert: {
          analyzed_tx_count: number
          archetype: string
          baseline_version: string
          computed_at?: string | null
          engine_version: string
          execution_count?: number | null
          id?: string
          longevity_days?: number | null
          median_holding_duration?: number | null
          pool_diversity?: number | null
          proof_hash: string
          signal_tier: string
          wallet_id: string
        }
        Update: {
          analyzed_tx_count?: number
          archetype?: string
          baseline_version?: string
          computed_at?: string | null
          engine_version?: string
          execution_count?: number | null
          id?: string
          longevity_days?: number | null
          median_holding_duration?: number | null
          pool_diversity?: number | null
          proof_hash?: string
          signal_tier?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reputation_snapshots_baseline_version_fkey"
            columns: ["baseline_version"]
            isOneToOne: false
            referencedRelation: "baseline_epochs"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "reputation_snapshots_engine_version_fkey"
            columns: ["engine_version"]
            isOneToOne: false
            referencedRelation: "engine_versions"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "reputation_snapshots_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      slashing_appeals: {
        Row: {
          created_at: string
          id: number
          reviewed_by: string | null
          slashing_log_id: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          reviewed_by?: string | null
          slashing_log_id: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          reviewed_by?: string | null
          slashing_log_id?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slashing_appeals_slashing_log_id_fkey"
            columns: ["slashing_log_id"]
            isOneToOne: false
            referencedRelation: "slashing_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slashing_appeals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      slashing_logs: {
        Row: {
          created_at: string
          id: number
          reason: string
          stake_slashed: boolean
          tx_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          reason: string
          stake_slashed?: boolean
          tx_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          reason?: string
          stake_slashed?: boolean
          tx_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slashing_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshot_locks: {
        Row: {
          lock_key: string
          locked_at: string
          worker_id: string | null
        }
        Insert: {
          lock_key: string
          locked_at: string
          worker_id?: string | null
        }
        Update: {
          lock_key?: string
          locked_at?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      squad_members: {
        Row: {
          id: string
          joined_at: string
          left_at: string | null
          project_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          left_at?: string | null
          project_id: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          left_at?: string | null
          project_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "squad_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_projects: {
        Row: {
          claim_tier: string | null
          created_at: string | null
          created_by: string
          created_by_wallet: string | null
          id: string
          is_renounced: boolean | null
          last_mc_update: string | null
          last_valid_mc: number | null
          liquidity_usd: number | null
          market_cap: number | null
          mint_address: string
          one_hour_change: number | null
          ops_description: string | null
          ops_discord: string | null
          ops_status: string
          ops_twitter: string | null
          ops_website: string | null
          project_name: string
          project_risk_band: string | null
          project_symbol: string | null
          project_trust_score: number | null
          status: string | null
          team_members: string[] | null
          update_authority: string | null
          volume_24h: number | null
        }
        Insert: {
          claim_tier?: string | null
          created_at?: string | null
          created_by: string
          created_by_wallet?: string | null
          id?: string
          is_renounced?: boolean | null
          last_mc_update?: string | null
          last_valid_mc?: number | null
          liquidity_usd?: number | null
          market_cap?: number | null
          mint_address: string
          one_hour_change?: number | null
          ops_description?: string | null
          ops_discord?: string | null
          ops_status?: string
          ops_twitter?: string | null
          ops_website?: string | null
          project_name: string
          project_risk_band?: string | null
          project_symbol?: string | null
          project_trust_score?: number | null
          status?: string | null
          team_members?: string[] | null
          update_authority?: string | null
          volume_24h?: number | null
        }
        Update: {
          claim_tier?: string | null
          created_at?: string | null
          created_by?: string
          created_by_wallet?: string | null
          id?: string
          is_renounced?: boolean | null
          last_mc_update?: string | null
          last_valid_mc?: number | null
          liquidity_usd?: number | null
          market_cap?: number | null
          mint_address?: string
          one_hour_change?: number | null
          ops_description?: string | null
          ops_discord?: string | null
          ops_status?: string
          ops_twitter?: string | null
          ops_website?: string | null
          project_name?: string
          project_risk_band?: string | null
          project_symbol?: string | null
          project_trust_score?: number | null
          status?: string | null
          team_members?: string[] | null
          update_authority?: string | null
          volume_24h?: number | null
        }
        Relationships: []
      }
      squad_role_slots: {
        Row: {
          created_at: string
          id: string
          max_count: number
          min_trust_score: number
          project_id: string
          role_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_count?: number
          min_trust_score?: number
          project_id: string
          role_label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_count?: number
          min_trust_score?: number
          project_id?: string
          role_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_role_slots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "squad_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_split_proposals: {
        Row: {
          created_at: string
          created_by: string
          id: string
          project_id: string
          status: string
          total_bps: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          project_id: string
          status?: string
          total_bps?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          project_id?: string
          status?: string
          total_bps?: number
        }
        Relationships: [
          {
            foreignKeyName: "squad_split_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_split_proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "squad_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_split_shares: {
        Row: {
          bps: number
          created_at: string
          id: string
          proposal_id: string
          user_id: string
        }
        Insert: {
          bps: number
          created_at?: string
          id?: string
          proposal_id: string
          user_id: string
        }
        Update: {
          bps?: number
          created_at?: string
          id?: string
          proposal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_split_shares_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "squad_split_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_split_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_split_signatures: {
        Row: {
          id: string
          payload_hash: string
          proposal_id: string
          signature: string
          signed_at: string
          signer_user_id: string
        }
        Insert: {
          id?: string
          payload_hash: string
          proposal_id: string
          signature: string
          signed_at?: string
          signer_user_id: string
        }
        Update: {
          id?: string
          payload_hash?: string
          proposal_id?: string
          signature?: string
          signed_at?: string
          signer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_split_signatures_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "squad_split_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_split_signatures_signer_user_id_fkey"
            columns: ["signer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_transition_logs: {
        Row: {
          action_type: string
          actor_wallet: string
          created_at: string
          nonce: string
          project_id: string
          protocol_version: number
          role: string
          sequence_number: number
          signature_hash: string
          target_wallet: string
        }
        Insert: {
          action_type: string
          actor_wallet: string
          created_at?: string
          nonce: string
          project_id: string
          protocol_version?: number
          role: string
          sequence_number?: number
          signature_hash: string
          target_wallet: string
        }
        Update: {
          action_type?: string
          actor_wallet?: string
          created_at?: string
          nonce?: string
          project_id?: string
          protocol_version?: number
          role?: string
          sequence_number?: number
          signature_hash?: string
          target_wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_transition_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "squad_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      score_snapshots: {
        Row: {
          id: string
          wallet_address: string
          model_version: string
          score_window: string
          style: Json
          quality: Json
          risk: Json
          confidence: Json
          summary: Json
          sample_size: number
          computed_at: number
        }
        Insert: {
          id?: string
          wallet_address: string
          model_version: string
          score_window: string
          style: Json
          quality: Json
          risk: Json
          confidence: Json
          summary: Json
          sample_size: number
          computed_at: number
        }
        Update: {
          id?: string
          wallet_address?: string
          model_version?: string
          score_window?: string
          style?: Json
          quality?: Json
          risk?: Json
          confidence?: Json
          summary?: Json
          sample_size?: number
          computed_at?: number
        }
        Relationships: []
      }
      wallet_receipts: {
        Row: {
          id: string
          share_id: string
          wallet_address: string
          snapshot_id: string
          visibility:
            | "GHOST"
            | "CLAIMED_PRIVATE"
            | "PUBLIC"
            | "VERIFIED_PUBLIC"
          created_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          share_id: string
          wallet_address: string
          snapshot_id: string
          visibility:
            | "GHOST"
            | "CLAIMED_PRIVATE"
            | "PUBLIC"
            | "VERIFIED_PUBLIC"
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          share_id?: string
          wallet_address?: string
          snapshot_id?: string
          visibility?:
            | "GHOST"
            | "CLAIMED_PRIVATE"
            | "PUBLIC"
            | "VERIFIED_PUBLIC"
          created_at?: string
          expires_at?: string | null
        }
        Relationships: []
      }
      trust_metrics: {
        Row: {
          composite_score: number
          consecutive_growth_epochs: number
          designer_score: number
          dev_score: number
          last_active_at: string | null
          last_calculated_at: string | null
          marketer_score: number
          tier: string
          updated_at: string
          user_id: string
          latest_snapshot_id: string | null
          primary_style: string | null
          quality_overall: number | null
          suspiciousness: number | null
          confidence_tier: string | null
          score_label: string | null
        }
        Insert: {
          composite_score?: number
          consecutive_growth_epochs?: number
          designer_score?: number
          dev_score?: number
          last_active_at?: string | null
          last_calculated_at?: string | null
          marketer_score?: number
          tier?: string
          updated_at?: string
          user_id: string
          latest_snapshot_id?: string | null
          primary_style?: string | null
          quality_overall?: number | null
          suspiciousness?: number | null
          confidence_tier?: string | null
          score_label?: string | null
        }
        Update: {
          composite_score?: number
          consecutive_growth_epochs?: number
          designer_score?: number
          dev_score?: number
          last_active_at?: string | null
          last_calculated_at?: string | null
          marketer_score?: number
          tier?: string
          updated_at?: string
          user_id?: string
          latest_snapshot_id?: string | null
          primary_style?: string | null
          quality_overall?: number | null
          suspiciousness?: number | null
          confidence_tier?: string | null
          score_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trust_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active_badges: Json | null
          cached_matches: Json | null
          created_at: string | null
          id: string
          identity_state: string | null
          intent: string | null
          is_opted_in: boolean | null
          joined_at: number | null
          last_active_at: number | null
          last_match_snapshot_at: number | null
          level: string | null
          match_count: number | null
          match_filters: Json | null
          social_links: Json | null
          social_proof: Json | null
          tags: string[] | null
          trust_score: number | null
          username: string | null
          wallet_address: string
          visibility_mode:
            | "GHOST"
            | "CLAIMED_PRIVATE"
            | "PUBLIC"
            | "VERIFIED_PUBLIC"
            | null
          latest_snapshot_id: string | null
        }
        Insert: {
          active_badges?: Json | null
          cached_matches?: Json | null
          created_at?: string | null
          id?: string
          identity_state?: string | null
          intent?: string | null
          is_opted_in?: boolean | null
          joined_at?: number | null
          last_active_at?: number | null
          last_match_snapshot_at?: number | null
          level?: string | null
          match_count?: number | null
          match_filters?: Json | null
          social_links?: Json | null
          social_proof?: Json | null
          tags?: string[] | null
          trust_score?: number | null
          username?: string | null
          wallet_address: string
          visibility_mode?:
            | "GHOST"
            | "CLAIMED_PRIVATE"
            | "PUBLIC"
            | "VERIFIED_PUBLIC"
            | null
          latest_snapshot_id?: string | null
        }
        Update: {
          active_badges?: Json | null
          cached_matches?: Json | null
          created_at?: string | null
          id?: string
          identity_state?: string | null
          intent?: string | null
          is_opted_in?: boolean | null
          joined_at?: number | null
          last_active_at?: number | null
          last_match_snapshot_at?: number | null
          level?: string | null
          match_count?: number | null
          match_filters?: Json | null
          social_links?: Json | null
          social_proof?: Json | null
          tags?: string[] | null
          trust_score?: number | null
          username?: string | null
          wallet_address?: string
          visibility_mode?:
            | "GHOST"
            | "CLAIMED_PRIVATE"
            | "PUBLIC"
            | "VERIFIED_PUBLIC"
            | null
          latest_snapshot_id?: string | null
        }
        Relationships: []
      }
      wallets: {
        Row: {
          chain: string | null
          created_at: string | null
          id: string
          verified_x_handle: string | null
          verified_x_id: string | null
          wallet_address: string
          x_verified_at: string | null
        }
        Insert: {
          chain?: string | null
          created_at?: string | null
          id?: string
          verified_x_handle?: string | null
          verified_x_id?: string | null
          wallet_address: string
          x_verified_at?: string | null
        }
        Update: {
          chain?: string | null
          created_at?: string | null
          id?: string
          verified_x_handle?: string | null
          verified_x_id?: string | null
          wallet_address?: string
          x_verified_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_public_receipts: {
        Row: {
          share_id: string
          wallet_address: string
          snapshot_id: string
          visibility:
            | "GHOST"
            | "CLAIMED_PRIVATE"
            | "PUBLIC"
            | "VERIFIED_PUBLIC"
          created_at: string | null
          expires_at: string | null
        }
        Insert: {
          [_ in never]: never
        }
        Update: {
          [_ in never]: never
        }
        Relationships: []
      }
      v_wallet_latest_intelligence: {
        Row: {
          user_id: string
          wallet_address: string
          visibility_mode:
            | "GHOST"
            | "CLAIMED_PRIVATE"
            | "PUBLIC"
            | "VERIFIED_PUBLIC"
            | null
          latest_snapshot_id: string | null
          style: Json | null
          quality: Json | null
          risk: Json | null
          confidence: Json | null
          summary: Json | null
          sample_size: number | null
          computed_at: number | null
        }
        Insert: {
          [_ in never]: never
        }
        Update: {
          [_ in never]: never
        }
        Relationships: []
      }
    }
    Functions: {
      acquire_lock: {
        Args: { p_key: string; p_worker_id: string }
        Returns: boolean
      }
      auth_wallet_address: { Args: never; Returns: string }
      cleanup_expired_nonces: { Args: never; Returns: undefined }
      ensure_wallet_profile: { Args: never; Returns: Json }
      execute_slashing: {
        Args: {
          p_reason: string
          p_should_slash_stake?: boolean
          p_tx_hash: string
          p_user_id: string
        }
        Returns: undefined
      }
      get_my_command_center_projects: {
        Args: never
        Returns: {
          claim_tier: string | null
          created_at: string | null
          created_by: string
          created_by_wallet: string | null
          id: string
          is_renounced: boolean | null
          last_mc_update: string | null
          last_valid_mc: number | null
          liquidity_usd: number | null
          market_cap: number | null
          mint_address: string
          one_hour_change: number | null
          ops_description: string | null
          ops_discord: string | null
          ops_status: string
          ops_twitter: string | null
          ops_website: string | null
          project_name: string
          project_risk_band: string | null
          project_symbol: string | null
          project_trust_score: number | null
          status: string | null
          team_members: string[] | null
          update_authority: string | null
          volume_24h: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "squad_projects"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      process_squad_transition:
        | {
            Args: {
              p_action: string
              p_actor: string
              p_nonce: string
              p_project_id: string
              p_role: string
              p_signature: string
              p_target: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_action: Database["public"]["Enums"]["squad_action_t"]
              p_actor: string
              p_nonce: string
              p_project_id: string
              p_role: string
              p_signature: string
              p_target: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_action: string
              p_actor: string
              p_nonce: string
              p_project_id: string
              p_role: string
              p_signature: string
              p_target: string
            }
            Returns: Json
          }
      process_squad_transition_v2: {
        Args: {
          p_action: Database["public"]["Enums"]["squad_action_t"]
          p_actor: string
          p_nonce: string
          p_project_id: string
          p_signature: string
          p_target: string
          p_timestamp: number
        }
        Returns: Json
      }
      recalculate_project_trust: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      release_lock: {
        Args: { p_key: string; p_worker_id: string }
        Returns: undefined
      }
      sync_my_twitter_identity: { Args: never; Returns: Json }
    }
    Enums: {
      squad_action_t:
        | "invite"
        | "apply"
        | "approve_app"
        | "reject_app"
        | "accept_invite"
        | "reject_invite"
        | "revoke_invite"
        | "kick"
        | "leave"
      squad_status_t:
        | "pending_invite"
        | "pending_application"
        | "active"
        | "rejected"
        | "revoked"
        | "kicked"
        | "left"
      visibility_mode_t:
        | "GHOST"
        | "CLAIMED_PRIVATE"
        | "PUBLIC"
        | "VERIFIED_PUBLIC"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      squad_action_t: [
        "invite",
        "apply",
        "approve_app",
        "reject_app",
        "accept_invite",
        "reject_invite",
        "revoke_invite",
        "kick",
        "leave",
      ],
      squad_status_t: [
        "pending_invite",
        "pending_application",
        "active",
        "rejected",
        "revoked",
        "kicked",
        "left",
      ],
      visibility_mode_t: [
        "GHOST",
        "CLAIMED_PRIVATE",
        "PUBLIC",
        "VERIFIED_PUBLIC",
      ],
    },
  },
} as const
