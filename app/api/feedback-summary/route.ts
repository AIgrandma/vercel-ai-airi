import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== process.env.FEEDBACK_ADMIN_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = getSupabase();

  const { data: all } = await sb
    .from("improvement_feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const { count: newCount } = await sb
    .from("improvement_feedback")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 3600 * 1000
  ).toISOString();
  const { count: recentCount } = await sb
    .from("improvement_feedback")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo);

  return NextResponse.json({
    total: all?.length ?? 0,
    new_count: newCount ?? 0,
    recent_7days: recentCount ?? 0,
    feedback: all ?? [],
  });
}
