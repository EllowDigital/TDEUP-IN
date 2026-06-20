import { NextResponse } from "next/server";
import { google } from "googleapis";
import { v2 as cloudinary } from "cloudinary";
import { createClient } from "@supabase/supabase-js";
import { formSchema } from "@/lib/schema";

// ---------------------------------------------------------
// Configuration & Global Settings
// ---------------------------------------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to initialize Supabase
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

// ---------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------
function generateCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
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

// ---------------------------------------------------------
// Main POST Handler
// ---------------------------------------------------------
export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const formData = await req.formData();
    const mobile = formData.get("mobile") as string;

    if (!mobile || mobile.trim() === "") {
      return NextResponse.json(
        { success: false, message: "Mobile number is required." },
        { status: 400 }
      );
    }

    const attendeeType = (formData.get("attendeeType") as string) || "GENERAL";
    const businessName = (formData.get("businessName") as string) || "";
    const businessCategory = (formData.get("businessCategory") as string) || "";
    const otherCategory = (formData.get("otherCategory") as string) || "";
    const fullName = (formData.get("fullName") as string) || "";
    const email = (formData.get("email") as string) || "";
    const gender = (formData.get("gender") as string) || "";
    const address = (formData.get("address") as string) || "";
    const city = (formData.get("city") as string) || "";
    const state = (formData.get("state") as string) || "";
    const pincode = (formData.get("pincode") as string) || "";

    const rawAttendance = formData.get("attendance") as string;
    let attendanceArray: string[] = [];
    try {
      attendanceArray = JSON.parse(rawAttendance);
    } catch {
      attendanceArray = rawAttendance ? [rawAttendance] : [];
    }

    const validationResult = formSchema.safeParse({
      fullName,
      mobile: mobile.trim(),
      email,
      gender,
      attendeeType,
      businessCategory,
      otherCategory,
      businessName,
      address,
      state,
      city,
      pincode,
      attendance: attendanceArray,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            validationResult.error.issues[0]?.message ||
            "Please complete all required fields before submitting.",
        },
        { status: 400 }
      );
    }

    const photoFile = formData.get("photo") as File | null;
    if (!photoFile || photoFile.size === 0) {
      return NextResponse.json(
        { success: false, message: "Profile photo is required before registration can be saved." },
        { status: 400 }
      );
    }

    // 1. PREPARE DATA
    const typeInitial = attendeeType.charAt(0).toUpperCase();
    const attendee_id = `TDE26-${typeInitial}-${generateCode(6)}`;

    const normalizedBusinessName = businessName.trim() || null;
    const normalizedBusinessCategory = businessCategory.trim() || null;

    // Capture otherCategory separately
    let normalizedOtherCategory: string | null = otherCategory.trim() || null;
    if (normalizedBusinessCategory !== "OTHER" || !normalizedOtherCategory) {
      normalizedOtherCategory = null;
    }

    // --- FIX: ALWAYS SORT ATTENDANCE DAYS IN CHRONOLOGICAL ORDER ---
    const chronologicalOrder: Record<string, number> = {
      "30 August": 1,
      "31 August": 2,
      "1 September": 3,
    };

    attendanceArray.sort((a, b) => {
      const orderA = chronologicalOrder[a] || 99;
      const orderB = chronologicalOrder[b] || 99;
      return orderA - orderB;
    });
    // ---------------------------------------------------------------

    // 2. UPLOAD PHOTO TO CLOUDINARY
    let photoUrl = null;
    if (photoFile && photoFile.size > 0) {
      const buffer = Buffer.from(await photoFile.arrayBuffer());
      photoUrl = await uploadToCloudinary(buffer, mobile.trim());

      if (!photoUrl) {
        return NextResponse.json(
          {
            success: false,
            message: "We could not upload your photo. Please try again with a clear image.",
          },
          { status: 502 }
        );
      }
    }

    // 3. ONE-SHOT SUPABASE INSERT
    // We insert with needs_sync set to TRUE by default.
    const { error: insertError } = await supabase.from("attendees").insert([
      {
        attendee_id: attendee_id,
        full_name: fullName,
        mobile: mobile.trim(),
        email: email?.trim() || null,
        gender,
        attendee_type: attendeeType,
        business_name: normalizedBusinessName,
        business_category: normalizedBusinessCategory,
        other_category: normalizedOtherCategory, // <-- Added into Supabase
        address,
        city,
        state,
        pincode,
        attendance_days: attendanceArray,
        photo_url: photoUrl,
        checked_in: null,
        needs_sync: true, // Start as true
      },
    ]);

    // Handle duplicate mobile numbers gracefully
    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { success: false, message: "You are already registered with this mobile number." },
          { status: 409 }
        );
      }
      console.error("Supabase Insert Error:", insertError);
      return NextResponse.json(
        { success: false, message: "Failed to save registration data to our servers." },
        { status: 500 }
      );
    }

    // 4. ATTEMPT GOOGLE SHEETS BACKUP
    try {
      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      const rowData = [
        attendee_id,
        fullName,
        mobile.trim(),
        email || "N/A",
        gender,
        attendeeType,
        normalizedBusinessName || "N/A",
        normalizedBusinessCategory || "N/A",
        normalizedOtherCategory || "N/A", // <-- Added otherCategory to Google Sheets
        address,
        city,
        state,
        pincode,
        attendanceArray.join(", "),
        photoUrl || "N/A",
        "FALSE", // <-- Added checked_in column default value to Google Sheets
        new Date().toISOString(),
      ];

      // We await this so Vercel doesn't kill the background process
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Sheet1!A:Q", // <-- Changed range to Q because we now have 17 columns!
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [rowData] },
      });

      // 5. IF SHEETS SUCCEEDS -> UPDATE SUPABASE needs_sync TO FALSE
      await supabase.from("attendees").update({ needs_sync: false }).eq("mobile", mobile.trim());
    } catch (sheetError) {
      // IF SHEETS FAILS -> We catch the error so the app DOES NOT crash.
      // Supabase still has needs_sync = true for this user.
      console.error(
        `Google Sheets sync failed for ${mobile}, but data is safe in Supabase.`,
        sheetError
      );
    }

    // 6. RETURN SUCCESS
    return NextResponse.json(
      {
        success: true,
        attendeeId: attendee_id,
        message: "Registration successful!",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Critical Submission Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "An unexpected system error occurred." },
      { status: 500 }
    );
  }
}
