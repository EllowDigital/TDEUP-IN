import { NextResponse } from "next/server";
import { google } from "googleapis";
import { v2 as cloudinary } from "cloudinary";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------
// Configuration & Global Caching
// ---------------------------------------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to initialize Supabase ONLY when needed (fixes Vercel build error)
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseKey);
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

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

async function getExistingPhotoUrl(mobile: string): Promise<string | null> {
  try {
    const publicId = `TDEUP_Visitors/${mobile}`;
    const result = await cloudinary.api.resource(publicId);
    return result.secure_url;
  } catch (error) {
    return null;
  }
}

async function uploadToCloudinary(
  buffer: Buffer,
  mobile: string,
  retries = 2
): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "TDEUP_Visitors",
            public_id: mobile,
            overwrite: true,
            timeout: 20000,
          },
          (error, result) => {
            if (result) resolve(result.secure_url);
            else reject(error);
          }
        );
        uploadStream.end(buffer);
      });
    } catch (error) {
      if (attempt === retries) return null;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    // Initialize Supabase inside the handler so it bypasses the build phase
    const supabase = getSupabase();

    const formData = await req.formData();
    const mobile = formData.get("mobile") as string;

    if (!mobile) {
      return NextResponse.json(
        { success: false, message: "Mobile number is required." },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 1. FAST DUPLICATE CHECK (Supabase)
    // ---------------------------------------------------------
    const { data: existingUser, error: checkError } = await supabase
      .from("attendees")
      .select("mobile")
      .eq("mobile", mobile.trim())
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "User with this mobile number is already registered." },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------
    // 2. Generate Unique attendee_id
    // ---------------------------------------------------------
    const attendeeType = (formData.get("attendeeType") as string) || "GENERAL";
    const typeInitial = attendeeType.charAt(0).toUpperCase();

    let attendee_id = `TDE26-${typeInitial}-${generateCode(6)}`;
    const { data: existingUid } = await supabase
      .from("attendees")
      .select("attendee_id")
      .eq("attendee_id", attendee_id)
      .maybeSingle();

    if (existingUid) {
      attendee_id = `TDE26-${typeInitial}-${generateCode(6)}`;
    }

    // ---------------------------------------------------------
    // 3. Handle Photo Upload
    // ---------------------------------------------------------
    let photoUrl = await getExistingPhotoUrl(mobile);

    if (!photoUrl) {
      const photoFile = formData.get("photo") as File | null;
      if (photoFile) {
        const buffer = Buffer.from(await photoFile.arrayBuffer());
        photoUrl = await uploadToCloudinary(buffer, mobile);
      }
    }

    // ---------------------------------------------------------
    // 4. Parse & Format Data for DB Schema Constraints
    // ---------------------------------------------------------
    // Use actual DB nulls instead of string "NULL"
    let businessName: string | null = formData.get("businessName") as string;
    if (!businessName || businessName.trim() === "" || attendeeType === "GENERAL") {
      businessName = null;
    }

    let businessCategory: string | null =
      (formData.get("businessCategory") as string) || (formData.get("otherCategory") as string);
    if (!businessCategory || businessCategory.trim() === "") {
      businessCategory = null;
    }

    const fullName = formData.get("fullName") as string;
    const email = (formData.get("email") as string) || null;
    const gender = formData.get("gender") as string;
    const address = formData.get("address") as string;
    const city = formData.get("city") as string;
    const state = formData.get("state") as string;
    const pincode = formData.get("pincode") as string;

    // Parse the JSON string from frontend into a native array for the TEXT[] column
    const rawAttendance = formData.get("attendance") as string;
    let attendanceArray: string[] = [];
    try {
      attendanceArray = JSON.parse(rawAttendance);
    } catch {
      attendanceArray = rawAttendance ? [rawAttendance] : [];
    }

    // ---------------------------------------------------------
    // 5. Save to Supabase (Primary Database)
    // ---------------------------------------------------------
    const { error: insertError } = await supabase.from("attendees").insert([
      {
        attendee_id: attendee_id,
        full_name: fullName,
        mobile,
        email,
        gender,
        attendee_type: attendeeType,
        business_name: businessName,
        business_category: businessCategory,
        address,
        city,
        state,
        pincode,
        attendance_days: attendanceArray,
        photo_url: photoUrl,
      },
    ]);

    if (insertError) {
      console.error("Supabase Insert Error:", insertError);
      throw new Error("Failed to save registration data.");
    }

    // ---------------------------------------------------------
    // 6. Save to Google Sheets (Secondary Backup)
    // ---------------------------------------------------------
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Updated array to match the new 15-column layout
    const rowData = [
      attendee_id,
      fullName,
      mobile,
      email || "N/A",
      gender,
      attendeeType,
      businessName || "N/A",
      businessCategory || "N/A",
      address,
      city,
      state,
      pincode,
      rawAttendance,
      photoUrl || "N/A",
      new Date().toISOString(),
    ];

    // Fire and forget sheets backup
    await sheets.spreadsheets.values
      .append({
        spreadsheetId,
        range: "Sheet1!A:O", // Extended to column O to fit address & pincode
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [rowData] },
      })
      .catch((err) => console.error("Sheets Backup Error:", err));

    return NextResponse.json({
      success: true,
      attendeeId: attendee_id,
      message: "Registration successful",
    });
  } catch (error: any) {
    console.error("Submission Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to submit registration." },
      { status: 500 }
    );
  }
}