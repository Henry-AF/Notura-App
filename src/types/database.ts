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
          plan: string
          meetings_this_month: number
          stripe_customer_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          name?: string | null
          role?: string | null
          company?: string | null
          whatsapp_number?: string | null
          plan?: string
          meetings_this_month?: number
          stripe_customer_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          role?: string | null
          company?: string | null
          whatsapp_number?: string | null
          plan?: string
          meetings_this_month?: number
          stripe_customer_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          id: string
          user_id: string
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
          prompt_version: string | null
          error_message: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
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
          prompt_version?: string | null
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
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
          prompt_version?: string | null
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          meeting_id: string
          user_id: string
          description: string
          owner: string | null
          due_date: string | null
          priority: string
          completed: boolean
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          user_id: string
          description: string
          owner?: string | null
          due_date?: string | null
          priority?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          user_id?: string
          description?: string
          owner?: string | null
          due_date?: string | null
          priority?: string
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
          description: string
          decided_by: string | null
          confidence: string
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          user_id: string
          description: string
          decided_by?: string | null
          confidence?: string
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          user_id?: string
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
          description: string
          context: string | null
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          user_id: string
          description: string
          context?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
export type Task = Database["public"]["Tables"]["tasks"]["Row"]
export type Decision = Database["public"]["Tables"]["decisions"]["Row"]
export type OpenItem = Database["public"]["Tables"]["open_items"]["Row"]
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]

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

// ── MeetingJSON — shape of summary_json as returned by Claude ────────────────

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