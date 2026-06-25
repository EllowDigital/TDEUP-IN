import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const { attendee_id } = await req.json();

    if (!attendee_id) {
      return NextResponse.json(
        { success: false, message: "Attendee ID required." },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 1. Fetch user data including attendance_days and the new checkin_history
    const { data: user, error: fetchError } = await supabase
      .from("attendees")
      .select("full_name, attendance_days, checkin_history")
      .eq("attendee_id", attendee_id)
      .maybeSingle();

    if (fetchError || !user) {
      return NextResponse.json(
        { success: false, message: "Invalid Pass. Attendee not found." },
        { status: 404 }
      );
    }

    // 2. Determine "Today's Date" in Indian Standard Time (IST)
    const dateIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const day = dateIST.getDate();
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const month = monthNames[dateIST.getMonth()];

    // Format will perfectly match your frontend array: "30 August", "31 August", "1 September"
    const todayKey = `${day} ${month}`;

    // 3. VALIDATION: Did they register for today?
    const attendanceDays = user.attendance_days || [];
    if (!attendanceDays.includes(todayKey)) {
      return NextResponse.json(
        {
          success: false,
          message: `Access Denied: ${user.full_name} does not have a pass for today (${todayKey}).`,
        },
        { status: 403 }
      );
    }

    // 4. VALIDATION: Are they already checked in TODAY?
    const history = user.checkin_history || {};
    if (history[todayKey]) {
      return NextResponse.json(
        { success: false, message: `${user.full_name} is already checked in for today.` },
        { status: 409 }
      );
    }

    // 5. SUCCESS: Add today's timestamp to their history
    history[todayKey] = new Date().toISOString();

    // 6. Update database with new history AND flag for Sheet Sync
    const { error: updateError } = await supabase
      .from("attendees")
      .update({
        checkin_history: history,
        needs_sheet_sync: true, // <-- NEW: Tell the system this change needs to go to Google Sheets
      })
      .eq("attendee_id", attendee_id);

    if (updateError) throw updateError;

    return NextResponse.json(
      { success: true, message: `Day ${day} Access Granted! Welcome ${user.full_name}!` },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Check-in Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
