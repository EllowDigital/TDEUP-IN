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
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // 1. Fetch all attendees that need syncing
    const { data: unsynced, error: fetchError } = await supabase
      .from("attendees")
      .select("*")
      .eq("needs_sheet_sync", true);

    if (fetchError) throw fetchError;

    if (!unsynced || unsynced.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Google Sheets is already completely up to date!",
      });
    }

    // 2. READ THE GOOGLE SHEET to find existing attendees
    // We only fetch Column A (attendee_id) to map which row each person is on
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1!A:A", // Assuming Column A is attendee_id
    });

    const existingIds = sheetData.data.values || [];

    // Create a map of attendee_id -> Row Number (1-indexed for Google Sheets)
    const rowMap = new Map<string, number>();
    existingIds.forEach((row, index) => {
      if (row[0]) rowMap.set(row[0], index + 1);
    });

    // Arrays to hold our two different types of operations
    const rowsToAppend: any[][] = [];
    const rowsToUpdate: any[] = [];

    // 3. Sort data into Appends (new) and Updates (existing)
    unsynced.forEach((row) => {
      // Format attendance days
      const days = Array.isArray(row.attendance_days)
        ? row.attendance_days.join(", ")
        : row.attendance_days;

      // --- NEW MULTI-DAY CHECK-IN LOGIC ---
      // Get the keys (days) from checkin_history JSON object
      const checkinHistoryStr = Object.keys(row.checkin_history || {}).join(", ");
      const finalCheckinStatus = checkinHistoryStr ? checkinHistoryStr : "Not Checked In";

      const rowData = [
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
        finalCheckinStatus, // <-- UPDATED COLUMN: Will show "30 August, 31 August" or "Not Checked In"
        row.created_at,
      ];

      if (rowMap.has(row.attendee_id)) {
        // Person exists! Add to update queue for their specific row
        const rowNum = rowMap.get(row.attendee_id);
        rowsToUpdate.push({
          range: `Sheet1!A${rowNum}:Q${rowNum}`,
          values: [rowData],
        });
      } else {
        // Person is new! Add to append queue
        rowsToAppend.push(rowData);
      }
    });

    // 4. Execute API Calls

    // A. Batch Update existing rows (e.g., updating checkin_history status)
    if (rowsToUpdate.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: rowsToUpdate,
        },
      });
    }

    // B. Append new rows (e.g., offline walk-ins)
    if (rowsToAppend.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Sheet1!A:Q",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rowsToAppend },
      });
    }

    // 5. Update Supabase `needs_sheet_sync` to false
    const syncedIds = unsynced.map((u) => u.id);
    const { error: updateError } = await supabase
      .from("attendees")
      .update({ needs_sheet_sync: false })
      .in("id", syncedIds);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: `Sync Complete! Updated ${rowsToUpdate.length} rows and Appended ${rowsToAppend.length} new rows.`,
    });
  } catch (error: any) {
    console.error("Sync Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to communicate with Google Sheets." },
      { status: 500 }
    );
  }
}