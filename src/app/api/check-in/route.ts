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

    // Verify they exist and check if already checked in
    const { data: user, error: fetchError } = await supabase
      .from("attendees")
      .select("checked_in, full_name")
      .eq("attendee_id", attendee_id)
      .maybeSingle();

    if (fetchError || !user) {
      return NextResponse.json(
        { success: false, message: "Invalid Pass. Attendee not found." },
        { status: 404 }
      );
    }

    if (user.checked_in) {
      return NextResponse.json(
        { success: false, message: `${user.full_name} is already checked in.` },
        { status: 409 }
      );
    }

    // Update check-in status
    const { error: updateError } = await supabase
      .from("attendees")
      .update({ checked_in: true }) // <-- Removed updated_at here too!
      .eq("attendee_id", attendee_id);
    if (updateError) throw updateError;

    return NextResponse.json(
      { success: true, message: `Successfully checked in ${user.full_name}!` },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Check-in Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
