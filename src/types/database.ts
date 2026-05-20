export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string | null
          role: string | null
          company: string | null
          whatsapp_number: string | null
          created_at: string
        }
        Insert: {
          id: string
          name?: string | null
          role?: string | null
          company?: string | null
          whatsapp_number?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          role?: string | null
          company?: string | null
          whatsapp_number?: string | null
          created_at?: string
        }
        Relationships: []
      }
      billing_accounts: {
        Row: {
          user_id: string
          plan: string
          active_billing_provider: string | null
          billing_cycle: string | null
          meetings_this_month: number
          meetings_used: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          stripe_pending_checkout_session_id: string | null
          stripe_pending_plan: string | null
          stripe_auto_renew_enabled: boolean
          stripe_auto_renew_updated_at: string | null
          stripe_renewal_status: string
          abacatepay_customer_id: string | null
          abacatepay_subscription_id: string | null
          abacatepay_auto_renew_enabled: boolean
          abacatepay_auto_renew_updated_at: string | null
          abacatepay_renewal_attempts: number
          abacatepay_renewal_status: string
          abacatepay_renewal_period_end: string | null
          abacatepay_next_renewal_attempt_at: string | null
          abacatepay_last_renewal_error: string | null
          abacatepay_customer_sync_started_at: string | null
          abacatepay_pending_checkout_id: string | null
          abacatepay_pending_plan: string | null
          current_period_start: string | null
          current_period_end: string | null
          quota_period_start: string | null
          quota_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          plan?: string
          active_billing_provider?: string | null
          billing_cycle?: string | null
          meetings_this_month?: number
          meetings_used?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_pending_checkout_session_id?: string | null
          stripe_pending_plan?: string | null
          stripe_auto_renew_enabled?: boolean
          stripe_auto_renew_updated_at?: string | null
          stripe_renewal_status?: string
          abacatepay_customer_id?: string | null
          abacatepay_subscription_id?: string | null
          abacatepay_auto_renew_enabled?: boolean
          abacatepay_auto_renew_updated_at?: string | null
          abacatepay_renewal_attempts?: number
          abacatepay_renewal_status?: string
          abacatepay_renewal_period_end?: string | null
          abacatepay_next_renewal_attempt_at?: string | null
          abacatepay_last_renewal_error?: string | null
          abacatepay_customer_sync_started_at?: string | null
          abacatepay_pending_checkout_id?: string | null
          abacatepay_pending_plan?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          quota_period_start?: string | null
          quota_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          plan?: string
          active_billing_provider?: string | null
          billing_cycle?: string | null
          meetings_this_month?: number
          meetings_used?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_pending_checkout_session_id?: string | null
          stripe_pending_plan?: string | null
          stripe_auto_renew_enabled?: boolean
          stripe_auto_renew_updated_at?: string | null
          stripe_renewal_status?: string
          abacatepay_customer_id?: string | null
          abacatepay_subscription_id?: string | null
          abacatepay_auto_renew_enabled?: boolean
          abacatepay_auto_renew_updated_at?: string | null
          abacatepay_renewal_attempts?: number
          abacatepay_renewal_status?: string
          abacatepay_renewal_period_end?: string | null
          abacatepay_next_renewal_attempt_at?: string | null
          abacatepay_last_renewal_error?: string | null
          abacatepay_customer_sync_started_at?: string | null
          abacatepay_pending_checkout_id?: string | null
          abacatepay_pending_plan?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          quota_period_start?: string | null
          quota_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      meeting_groups: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          id: string
          user_id: string
          group_id: string | null
          title: string | null
          client_name: string | null
          meeting_date: string | null
          audio_r2_key: string | null
          transcript: string | null
          summary_whatsapp: string | null
          summary_json: Json | null
          whatsapp_number: string
          whatsapp_status: string
          status: string
          source: string
          duration_seconds: number | null
          cost_usd: number | null
          assemblyai_transcript_id: string | null
          prompt_version: string | null
          error_message: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          group_id?: string | null
          title?: string | null
          client_name?: string | null
          meeting_date?: string | null
          audio_r2_key?: string | null
          transcript?: string | null
          summary_whatsapp?: string | null
          summary_json?: Json | null
          whatsapp_number: string
          whatsapp_status?: string
          status?: string
          source?: string
          duration_seconds?: number | null
          cost_usd?: number | null
          assemblyai_transcript_id?: string | null
          prompt_version?: string | null
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          group_id?: string | null
          title?: string | null
          client_name?: string | null
          meeting_date?: string | null
          audio_r2_key?: string | null
          transcript?: string | null
          summary_whatsapp?: string | null
          summary_json?: Json | null
          whatsapp_number?: string
          whatsapp_status?: string
          status?: string
          source?: string
          duration_seconds?: number | null
          cost_usd?: number | null
          assemblyai_transcript_id?: string | null
          prompt_version?: string | null
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "meeting_groups"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          meeting_id: string
          user_id: string
          dedupe_key: string
          description: string
          owner: string | null
          due_date: string | null
          priority: string
          status: "todo" | "in_progress" | "completed"
          completed: boolean
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          user_id: string
          dedupe_key: string
          description: string
          owner?: string | null
          due_date?: string | null
          priority?: string
          status?: "todo" | "in_progress" | "completed"
          completed?: boolean
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          user_id?: string
          dedupe_key?: string
          description?: string
          owner?: string | null
          due_date?: string | null
          priority?: string
          status?: "todo" | "in_progress" | "completed"
          completed?: boolean
          completed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          }
        ]
      }
      decisions: {
        Row: {
          id: string
          meeting_id: string
          user_id: string
          dedupe_key: string
          description: string
          decided_by: string | null
          confidence: string
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          user_id: string
          dedupe_key: string
          description: string
          decided_by?: string | null
          confidence?: string
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          user_id?: string
          dedupe_key?: string
          description?: string
          decided_by?: string | null
          confidence?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          }
        ]
      }
      open_items: {
        Row: {
          id: string
          meeting_id: string
          user_id: string
          dedupe_key: string
          description: string
          context: string | null
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          user_id: string
          dedupe_key: string
          description: string
          context?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          user_id?: string
          dedupe_key?: string
          description?: string
          context?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          }
        ]
      }
      jobs: {
        Row: {
          id: string
          meeting_id: string
          status: string
          current_step: string | null
          error_message: string | null
          attempts: number
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          meeting_id: string
          status?: string
          current_step?: string | null
          error_message?: string | null
          attempts?: number
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          meeting_id?: string
          status?: string
          current_step?: string | null
          error_message?: string | null
          attempts?: number
          created_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          }
        ]
      }
      meeting_transcript_chunks: {
        Row: {
          id: string
          meeting_id: string
          user_id: string
          chunk_index: number
          text: string
          speaker: string | null
          start_ms: number | null
          end_ms: number | null
          metadata: Json
          embedding: number[]
          embedding_model: string
          embedding_dimensions: number
          chunking_version: string
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          user_id: string
          chunk_index: number
          text: string
          speaker?: string | null
          start_ms?: number | null
          end_ms?: number | null
          metadata?: Json
          embedding: number[]
          embedding_model?: string
          embedding_dimensions?: number
          chunking_version?: string
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          user_id?: string
          chunk_index?: number
          text?: string
          speaker?: string | null
          start_ms?: number | null
          end_ms?: number | null
          metadata?: Json
          embedding?: number[]
          embedding_model?: string
          embedding_dimensions?: number
          chunking_version?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_transcript_chunks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          }
        ]
      }
      meeting_chats: {
        Row: {
          id: string
          meeting_id: string
          user_id: string
          question: string
          question_embedding: number[] | null
          answer: string | null
          status: "processing" | "completed" | "failed"
          fallback_reason: string | null
          model_confirmed: boolean | null
          sources: Json
          error_message: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          meeting_id: string
          user_id: string
          question: string
          question_embedding?: number[] | null
          answer?: string | null
          status?: "processing" | "completed" | "failed"
          fallback_reason?: string | null
          model_confirmed?: boolean | null
          sources?: Json
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          meeting_id?: string
          user_id?: string
          question?: string
          question_embedding?: number[] | null
          answer?: string | null
          status?: "processing" | "completed" | "failed"
          fallback_reason?: string | null
          model_confirmed?: boolean | null
          sources?: Json
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_chats_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          }
        ]
      }
      meeting_chat_outbox: {
        Row: {
          id: string
          chat_id: string
          meeting_id: string
          user_id: string
          event_name: string
          payload: Json
          status: "pending" | "processing" | "sent" | "dead"
          attempts: number
          next_attempt_at: string
          last_attempt_at: string | null
          sent_at: string | null
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          meeting_id: string
          user_id: string
          event_name?: string
          payload: Json
          status?: "pending" | "processing" | "sent" | "dead"
          attempts?: number
          next_attempt_at?: string
          last_attempt_at?: string | null
          sent_at?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          meeting_id?: string
          user_id?: string
          event_name?: string
          payload?: Json
          status?: "pending" | "processing" | "sent" | "dead"
          attempts?: number
          next_attempt_at?: string
          last_attempt_at?: string | null
          sent_at?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_chat_outbox_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "meeting_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_chat_outbox_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          }
        ]
      }
      meeting_chat_ai_metrics: {
        Row: {
          id: string
          chat_id: string
          meeting_id: string
          user_id: string
          status: "processing" | "completed" | "failed"
          fallback_reason: string | null
          request_id: string | null
          stage: string
          error_message: string | null
          embedding_model: string
          answer_model: string
          retrieved_chunks_count: number
          max_similarity: number | null
          avg_similarity: number | null
          question_tokens_estimated: number
          context_tokens_estimated: number
          answer_tokens_estimated: number
          embedding_duration_ms: number | null
          retrieval_duration_ms: number | null
          generation_duration_ms: number | null
          total_duration_ms: number
          estimated_cost_usd: number
          started_at: string | null
          completed_at: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          meeting_id: string
          user_id: string
          status: "processing" | "completed" | "failed"
          fallback_reason?: string | null
          request_id?: string | null
          stage?: string
          error_message?: string | null
          embedding_model: string
          answer_model: string
          retrieved_chunks_count?: number
          max_similarity?: number | null
          avg_similarity?: number | null
          question_tokens_estimated?: number
          context_tokens_estimated?: number
          answer_tokens_estimated?: number
          embedding_duration_ms?: number | null
          retrieval_duration_ms?: number | null
          generation_duration_ms?: number | null
          total_duration_ms: number
          estimated_cost_usd?: number
          started_at?: string | null
          completed_at?: string | null
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          meeting_id?: string
          user_id?: string
          status?: "processing" | "completed" | "failed"
          fallback_reason?: string | null
          request_id?: string | null
          stage?: string
          error_message?: string | null
          embedding_model?: string
          answer_model?: string
          retrieved_chunks_count?: number
          max_similarity?: number | null
          avg_similarity?: number | null
          question_tokens_estimated?: number
          context_tokens_estimated?: number
          answer_tokens_estimated?: number
          embedding_duration_ms?: number | null
          retrieval_duration_ms?: number | null
          generation_duration_ms?: number | null
          total_duration_ms?: number
          estimated_cost_usd?: number
          started_at?: string | null
          completed_at?: string | null
          updated_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_chat_ai_metrics_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "meeting_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_chat_ai_metrics_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          }
        ]
      }
      ai_usage_daily: {
        Row: {
          user_id: string
          usage_date: string
          feature: string
          used_count: number
          quota_limit: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          usage_date: string
          feature: string
          used_count?: number
          quota_limit: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          usage_date?: string
          feature?: string
          used_count?: number
          quota_limit?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_refunds: {
        Row: {
          id: string
          chat_id: string
          user_id: string
          usage_date: string
          feature: string
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          user_id: string
          usage_date: string
          feature: string
          reason: string
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          user_id?: string
          usage_date?: string
          feature?: string
          reason?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_refunds_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "meeting_chats"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_total_completed_meeting_seconds: {
        Args: {
          p_user_id: string
        }
        Returns: number
      }
      increment_billing_meetings_this_month: {
        Args: {
          p_user_id: string
          p_increment?: number
        }
        Returns: number
      }
      consume_meeting_quota: {
        Args: {
          p_user_id: string
        }
        Returns: {
          meetings_used: number
          plan: string
          current_period_start: string | null
          current_period_end: string | null
        }[]
      }
      refund_meeting_quota: {
        Args: {
          p_user_id: string
        }
        Returns: number
      }
      match_meeting_transcript_chunks: {
        Args: {
          p_user_id: string
          p_meeting_id: string
          p_query_embedding: number[]
          p_limit?: number
          p_similarity_threshold?: number
          p_embedding_model?: string
          p_embedding_dimensions?: number
          p_chunking_version?: string
        }
        Returns: {
          id: string
          meeting_id: string
          chunk_index: number
          text: string
          speaker: string | null
          start_ms: number | null
          end_ms: number | null
          metadata: Json
          similarity: number
        }[]
      }
      upsert_meeting_transcript_chunks_with_lock: {
        Args: {
          p_user_id: string
          p_meeting_id: string
          p_chunks: Json
          p_embedding_model?: string
          p_embedding_dimensions?: number
          p_chunking_version?: string
        }
        Returns: undefined
      }
      create_meeting_chat_with_outbox: {
        Args: {
          p_user_id: string
          p_meeting_id: string
          p_question: string
          p_ai_feature?: string
          p_ai_daily_quota_limit?: number
        }
        Returns: {
          chat_id: string
          status: "processing"
          ai_daily_quota_used: number
          ai_daily_quota_limit: number
        }[]
      }
      refund_meeting_chat_ai_usage: {
        Args: {
          p_user_id: string
          p_chat_id: string
          p_ai_feature?: string
          p_reason?: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// ── Domain union types ────────────────────────────────────────────────────────

export type Plan = "free" | "pro" | "team"
export type MeetingStatus = "pending" | "processing" | "completed" | "failed"
export type MeetingSource = "upload" | "zoom_webhook" | "chrome_extension"
export type WhatsAppStatus = "pending" | "sent" | "failed"
export type Priority = "alta" | "média" | "baixa"
export type Confidence = "alta" | "média"

// ── Row shorthand aliases ─────────────────────────────────────────────────────

export type Meeting = Database["public"]["Tables"]["meetings"]["Row"]
export type MeetingGroup = Database["public"]["Tables"]["meeting_groups"]["Row"]
export type Task = Database["public"]["Tables"]["tasks"]["Row"]
export type Decision = Database["public"]["Tables"]["decisions"]["Row"]
export type OpenItem = Database["public"]["Tables"]["open_items"]["Row"]
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type BillingAccount = Database["public"]["Tables"]["billing_accounts"]["Row"]
export type MeetingTranscriptChunk =
  Database["public"]["Tables"]["meeting_transcript_chunks"]["Row"]
export type MeetingChat = Database["public"]["Tables"]["meeting_chats"]["Row"]
export type MeetingChatAiMetric =
  Database["public"]["Tables"]["meeting_chat_ai_metrics"]["Row"]

// ── Dashboard view types ──────────────────────────────────────────────────────

export interface DashboardStats {
  meetings_this_month: number
  tasks_generated: number
  hours_saved: number
  whatsapp_connected: boolean
}

// ── Compound / join types ────────────────────────────────────────────────────

export type MeetingWithRelations =
  Database["public"]["Tables"]["meetings"]["Row"] & {
    tasks: Database["public"]["Tables"]["tasks"]["Row"][]
    decisions: Database["public"]["Tables"]["decisions"]["Row"][]
    open_items: Database["public"]["Tables"]["open_items"]["Row"][]
  }

// ── MeetingJSON — shape of summary_json as returned by Gemini ─────────────────

export interface MeetingJSON {
  version?: string
  meeting?: {
    title?: string | null
    date_mentioned?: string | null
    duration_minutes?: number | null
    participants?: string[]
    participant_count?: number | null
  } | null
  decisions: Array<{
    description: string
    decided_by: string | null
    confidence: Confidence
  }>
  tasks: Array<{
    description: string
    owner: string
    due_date: string | null
    priority: Priority
    status?: string
  }>
  open_items: Array<{
    description: string
    context: string | null
  }>
  next_meeting?: {
    datetime: string | null
    location_or_link: string | null
  } | null
  summary_one_line?: string | null
  metadata?: {
    prompt_version?: string
    total_decisions?: number
    total_tasks?: number
    total_open_items?: number
    [key: string]: unknown
  }
}
