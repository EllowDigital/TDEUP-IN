import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helper function to safely initialize Supabase
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    // 1. Safely parse the JSON body to prevent crashes on bad requests
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON payload." },
        { status: 400 }
      );
    }

    const { mobile } = body;

    // 2. Strict Validation: Ensure mobile exists and is a string
    if (!mobile || typeof mobile !== "string" || mobile.trim() === "") {
      return NextResponse.json(
        { success: false, message: "A valid mobile number is required." },
        { status: 400 }
      );
    }

    // Optional: Strip out any non-numeric characters (like spaces, dashes, or +91)
    // if your database only stores raw 10-digit numbers.
    // const cleanMobile = mobile.replace(/\D/g, "").slice(-10);
    const cleanMobile = mobile.trim();

    const supabase = getSupabase();

    // 3. Fetch user by mobile
    const { data: attendee, error } = await supabase
      .from("attendees")
      .select("*")
      .eq("mobile", cleanMobile)
      .maybeSingle();

    // 4. Handle database errors gracefully
    if (error) {
      console.error("Supabase Error [Find Pass]:", error);
      throw new Error("Database query failed.");
    }

    // 5. Handle "Not Found" state
    if (!attendee) {
      return NextResponse.json(
        { success: false, message: "No pass found for this mobile number." },
        { status: 404 }
      );
    }

    // 6. Return successful response
    return NextResponse.json({ success: true, attendee }, { status: 200 });
  } catch (error: any) {
    console.error("Find Pass Error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}
