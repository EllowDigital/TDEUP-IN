import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const supabase = getSupabase();

    // Get total count
    const { count: totalCount, error: totalError } = await supabase
      .from("attendees")
      .select("*", { count: "exact", head: true });

    // Get pending sync count
    const { count: pendingCount, error: pendingError } = await supabase
      .from("attendees")
      .select("*", { count: "exact", head: true })
      .eq("needs_sync", true);

    if (totalError || pendingError) throw new Error("Failed to fetch counts");

    return NextResponse.json({
      total: totalCount || 0,
      pendingSync: pendingCount || 0,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
