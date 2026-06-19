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
    const { mobile } = await req.json();

    if (!mobile) {
      return NextResponse.json(
        { success: false, message: "Mobile number required." },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Fetch user by mobile
    const { data, error } = await supabase
      .from("attendees")
      .select("*")
      .eq("mobile", mobile.trim())
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { success: false, message: "No pass found for this mobile number." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, attendee: data }, { status: 200 });
  } catch (error: any) {
    console.error("Find Pass Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
