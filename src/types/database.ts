// ─────────────────────────────────────────────────────────────────────────────
// Notura — Database types (mirrors Supabase schema)
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = "rh" | "juridico" | "administrativo" | "outro";
export type Plan = "free" | "pro" | "team";
export type MeetingStatus = "pending" | "processing" | "completed" | "failed";
export type MeetingSource = "upload" | "zoom_webhook" | "chrome_extension";
export type WhatsAppStatus = "pending" | "sent" | "failed";
export type Priority = "alta" | "média" | "baixa";
export type Confidence = "alta" | "média";
export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface Profile {
  id: string;
  name: string | null;
  role: UserRole | null;
  company: string | null;
  whatsapp_number: string | null;
  plan: Plan;
  meetings_this_month: number;
  stripe_customer_id: string | null;
  created_at: string;
}

export interface Meeting {
  id: string;
  user_id: string;
  title: string | null;
  client_name: string | null;
  meeting_date: string | null;
  audio_r2_key: string | null;
  transcript: string | null;
  summary_whatsapp: string | null;
  summary_json: MeetingJSON | null;
  whatsapp_number: string;
  whatsapp_status: WhatsAppStatus;
  status: MeetingStatus;
  source: MeetingSource;
  duration_seconds: number | null;
  cost_usd: number | null;
  prompt_version: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Task {
  id: string;
  meeting_id: string;
  user_id: string;
  description: string;
  owner: string | null;
  due_date: string | null;
  priority: Priority;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface Decision {
  id: string;
  meeting_id: string;
  user_id: string;
  description: string;
  decided_by: string | null;
  confidence: Confidence;
  created_at: string;
}

export interface OpenItem {
  id: string;
  meeting_id: string;
  user_id: string;
  description: string;
  context: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  meeting_id: string;
  status: JobStatus;
  current_step: string | null;
  error_message: string | null;
  attempts: number;
  created_at: string;
  completed_at: string | null;
}

// ─── Meeting JSON (from Claude summarization) ───────────────────────────────

export interface MeetingJSON {
  version: string;
  meeting: {
    title: string;
    date_mentioned: string | null;
    duration_minutes: number | null;
    participants: string[];
    participant_count: number;
  };
  decisions: Array<{
    description: string;
    decided_by: string | null;
    confidence: Confidence;
  }>;
  tasks: Array<{
    description: string;
    owner: string;
    due_date: string | null;
    priority: Priority;
    status: "pendente";
  }>;
  open_items: Array<{
    description: string;
    context: string | null;
  }>;
  next_meeting: {
    datetime: string | null;
    location_or_link: string | null;
  };
  summary_one_line: string;
  metadata: {
    prompt_version: string;
    total_decisions: number;
    total_tasks: number;
    total_open_items: number;
  };
}

// ─── Meeting with relations (for detail page) ───────────────────────────────

export interface MeetingWithRelations extends Meeting {
  tasks: Task[];
  decisions: Decision[];
  open_items: OpenItem[];
}

// ─── Dashboard stats ────────────────────────────────────────────────────────

export interface DashboardStats {
  meetings_this_month: number;
  tasks_generated: number;
  hours_saved: number;
  whatsapp_connected: boolean;
}

// ─── Plan limits ────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<Plan, { meetings_per_month: number; whatsapp: boolean }> = {
  free: { meetings_per_month: 3, whatsapp: false },
  pro: { meetings_per_month: 30, whatsapp: true },
  team: { meetings_per_month: 999, whatsapp: true },
};
