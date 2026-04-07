import { NextResponse } from "next/server";
import { getBillingStatus } from "@/lib/billing";
import {
  createServerSupabase,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import type { Plan } from "@/types/database";

function toUserName(name: string | null | undefined, email: string | null) {
  if (name?.trim()) return name.trim();
  if (email?.includes("@")) return email.split("@")[0] ?? "Usuário";
  return "Usuário";
}

export async function GET() {
  const supabaseAuth = createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).toISOString();

    const [
      profileResult,
      billingStatus,
      recentMeetingsResult,
      openTaskCountResult,
      openTasksResult,
      completedMeetingsResult,
      todayMeetingsResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle(),
      getBillingStatus(user.id),
      supabase
        .from("meetings")
        .select("id, title, client_name, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("completed", false),
      supabase
        .from("tasks")
        .select("id, description, completed, created_at")
        .eq("user_id", user.id)
        .eq("completed", false)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("meetings")
        .select("duration_seconds")
        .eq("user_id", user.id)
        .eq("status", "completed"),
      supabase
        .from("meetings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfDay)
        .eq("status", "completed"),
    ]);

    if (
      profileResult.error ||
      recentMeetingsResult.error ||
      openTaskCountResult.error ||
      openTasksResult.error ||
      completedMeetingsResult.error ||
      todayMeetingsResult.error
    ) {
      console.error("[dashboard/overview] query failure", {
        profileError: profileResult.error,
        recentMeetingsError: recentMeetingsResult.error,
        openTaskCountError: openTaskCountResult.error,
        openTasksError: openTasksResult.error,
        completedMeetingsError: completedMeetingsResult.error,
        todayMeetingsError: todayMeetingsResult.error,
      });
      return NextResponse.json(
        { error: "Erro ao carregar dashboard." },
        { status: 500 }
      );
    }

    const totalSeconds =
      completedMeetingsResult.data?.reduce(
        (sum, meeting) => sum + (meeting.duration_seconds ?? 0),
        0
      ) ?? 0;

    return NextResponse.json({
      userName: toUserName(profileResult.data?.name, user.email ?? null),
      plan: billingStatus.billingAccount.plan as Plan,
      meetingsThisMonth: billingStatus.meetingsThisMonth,
      monthlyLimit: billingStatus.monthlyLimit,
      recentMeetings: (recentMeetingsResult.data ?? []).map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        clientName: meeting.client_name,
        createdAt: meeting.created_at,
        status: meeting.status,
      })),
      openTasks: (openTasksResult.data ?? []).map((task) => ({
        id: task.id,
        text: task.description,
        completed: task.completed,
        createdAt: task.created_at,
      })),
      openTaskCount: openTaskCountResult.count ?? 0,
      hoursSaved: Math.round(totalSeconds / 3600 / 2),
      todayCount: todayMeetingsResult.count ?? 0,
    });
  } catch (error) {
    console.error("[dashboard/overview] unexpected failure:", error);
    return NextResponse.json(
      { error: "Erro ao carregar dashboard." },
      { status: 500 }
    );
  }
}
