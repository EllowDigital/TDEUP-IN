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

    // 1. Get total registered attendees count
    const { count: totalCount, error: totalError } = await supabase
      .from("attendees")
      .select("*", { count: "exact", head: true });

    // 2. Get pending Google Sheets sync count
    const { count: pendingCount, error: pendingError } = await supabase
      .from("attendees")
      .select("*", { count: "exact", head: true })
      .eq("needs_sheet_sync", true);

    // 3. Get total checked-in count (NEW MULTI-DAY LOGIC)
    // यह उन सभी यूज़र्स को गिनेगा जिनका checkin_history खाली JSON '{}' नहीं है
    const { count: checkedInCount, error: checkedInError } = await supabase
      .from("attendees")
      .select("*", { count: "exact", head: true })
      .neq("checkin_history", "{}");

    if (totalError || pendingError || checkedInError) {
      console.error("Supabase count error:", { totalError, pendingError, checkedInError });
      throw new Error("Failed to fetch database counts");
    }

    return NextResponse.json({
      success: true,
      total: totalCount || 0,
      pendingSync: pendingCount || 0,
      checkedIn: checkedInCount || 0,
    });
  } catch (error) {
    console.error("Admin Stats API Error:", error);
    return NextResponse.json(
      { success: false, message: "Server error while fetching stats" },
      { status: 500 }
    );
  }
}
