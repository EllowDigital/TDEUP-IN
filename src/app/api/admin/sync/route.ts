import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Initialize Google Auth
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

export async function POST() {
  try {
    const supabase = getSupabase();

    // 1. Fetch all attendees that need syncing
    const { data: unsynced, error: fetchError } = await supabase
      .from("attendees")
      .select("*")
      .eq("needs_sync", true);

    if (fetchError) throw fetchError;

    if (!unsynced || unsynced.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Google Sheets is already completely up to date!",
      });
    }

    // 2. Format the rows to exactly match your 17 Google Sheet Columns
    const rowsToAppend = unsynced.map((row) => {
      const days = Array.isArray(row.attendance_days)
        ? row.attendance_days.join(", ")
        : row.attendance_days;

      return [
        row.attendee_id,
        row.full_name,
        row.mobile,
        row.email || "N/A",
        row.gender,
        row.attendee_type,
        row.business_name || "N/A",
        row.business_category || "N/A",
        row.other_category || "N/A",
        row.address,
        row.city,
        row.state,
        row.pincode,
        days,
        row.photo_url || "N/A",
        row.checked_in ? "TRUE" : "FALSE",
        row.created_at,
      ];
    });

    // 3. Batch Append to Google Sheets
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Sheet1!A:Q",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rowsToAppend },
    });

    // 4. If Google Sheets succeeds, update Supabase `needs_sync` to false
    const syncedIds = unsynced.map((u) => u.id);
    const { error: updateError } = await supabase
      .from("attendees")
      .update({ needs_sync: false })
      .in("id", syncedIds);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${unsynced.length} records to Google Sheets!`,
    });
  } catch (error: any) {
    console.error("Sync Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to communicate with Google Sheets." },
      { status: 500 }
    );
  }
}
