import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

export async function POST(req: Request) {
  try {
    // SECURITY NOTE: In a real app, ensure you verify an admin session/token here
    // so public users cannot trigger this sync randomly.

    const supabase = getSupabase();

    // 1. Fetch all unsynced rows
    const { data: unsyncedUsers, error: fetchError } = await supabase
      .from("attendees")
      .select("*")
      .eq("needs_sync", true);

    if (fetchError) throw fetchError;

    if (!unsyncedUsers || unsyncedUsers.length === 0) {
      return NextResponse.json(
        { success: true, message: "Everything is already synced up!" },
        { status: 200 }
      );
    }

    // 2. Format data for Google Sheets
    const rowsData = unsyncedUsers.map((user) => [
      user.attendee_id,
      user.full_name,
      user.mobile,
      user.email || "N/A",
      user.gender,
      user.attendee_type,
      user.business_name || "N/A",
      user.business_category || "N/A",
      user.address,
      user.city,
      user.state,
      user.pincode,
      Array.isArray(user.attendance_days) ? user.attendance_days.join(", ") : user.attendance_days,
      user.photo_url || "N/A",
      user.created_at,
    ]);

    // 3. Bulk append to Google Sheets
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Sheet1!A:O",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rowsData },
    });

    // 4. Update Supabase: Mark these exact users as synced
    const syncedMobiles = unsyncedUsers.map((u) => u.mobile);
    const { error: updateError } = await supabase
      .from("attendees")
      .update({ needs_sync: false })
      .in("mobile", syncedMobiles);

    if (updateError) throw updateError;

    return NextResponse.json(
      {
        success: true,
        message: `Successfully synced ${unsyncedUsers.length} missing records to Google Sheets!`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Admin Sync Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to sync records." },
      { status: 500 }
    );
  }
}
