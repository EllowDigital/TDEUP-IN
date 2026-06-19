import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Helper to escape single quotes for SQLite
const escapeSQL = (val: string | null | undefined) => {
  if (!val) return "NULL";
  return `'${val.replace(/'/g, "''")}'`;
};

// Helper for CSV escaping
const escapeCSV = (val: any) => {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "csv";

    const supabase = getSupabase();

    // Fetch ALL attendees
    const { data: attendees, error } = await supabase
      .from("attendees")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!attendees || attendees.length === 0) {
      return new NextResponse("No data found", { status: 404 });
    }

    if (format === "sql") {
      // Build SQLite compatible dump
      let sqlString = `-- TDEUP SQLite3 Database Dump\n`;
      sqlString += `CREATE TABLE IF NOT EXISTS attendees (\n`;
      sqlString += `  id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
      sqlString += `  attendee_id TEXT UNIQUE,\n`;
      sqlString += `  full_name TEXT,\n`;
      sqlString += `  mobile TEXT,\n`;
      sqlString += `  email TEXT,\n`;
      sqlString += `  gender TEXT,\n`;
      sqlString += `  attendee_type TEXT,\n`;
      sqlString += `  business_name TEXT,\n`;
      sqlString += `  business_category TEXT,\n`;
      sqlString += `  other_category TEXT,\n`;
      sqlString += `  address TEXT,\n`;
      sqlString += `  city TEXT,\n`;
      sqlString += `  state TEXT,\n`;
      sqlString += `  pincode TEXT,\n`;
      sqlString += `  attendance_days TEXT,\n`;
      sqlString += `  photo_url TEXT,\n`;
      sqlString += `  checked_in BOOLEAN,\n`;
      sqlString += `  created_at DATETIME\n`;
      sqlString += `);\n\n`;

      attendees.forEach((row) => {
        const days = Array.isArray(row.attendance_days)
          ? row.attendance_days.join(", ")
          : row.attendance_days;
        sqlString += `INSERT INTO attendees (attendee_id, full_name, mobile, email, gender, attendee_type, business_name, business_category, other_category, address, city, state, pincode, attendance_days, photo_url, checked_in, created_at) VALUES (`;
        sqlString += `${escapeSQL(row.attendee_id)}, ${escapeSQL(row.full_name)}, ${escapeSQL(row.mobile)}, ${escapeSQL(row.email)}, ${escapeSQL(row.gender)}, ${escapeSQL(row.attendee_type)}, ${escapeSQL(row.business_name)}, ${escapeSQL(row.business_category)}, ${escapeSQL(row.other_category)}, ${escapeSQL(row.address)}, ${escapeSQL(row.city)}, ${escapeSQL(row.state)}, ${escapeSQL(row.pincode)}, ${escapeSQL(days)}, ${escapeSQL(row.photo_url)}, ${row.checked_in ? 1 : 0}, ${escapeSQL(row.created_at)});\n`;
      });

      return new NextResponse(sqlString, {
        headers: {
          "Content-Type": "application/sql",
          "Content-Disposition": `attachment; filename="tdeup_export.sql"`,
        },
      });
    }

    // Default to CSV
    else {
      const headers = Object.keys(attendees[0]);
      let csvString = headers.join(",") + "\n";

      attendees.forEach((row) => {
        const values = headers.map((header) => {
          let val = row[header];
          if (Array.isArray(val)) val = val.join(", ");
          return escapeCSV(val);
        });
        csvString += values.join(",") + "\n";
      });

      return new NextResponse(csvString, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="tdeup_export.csv"`,
        },
      });
    }
  } catch (error: any) {
    console.error("Export Error:", error);
    return new NextResponse("Failed to generate export", { status: 500 });
  }
}
