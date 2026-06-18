import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { google } from "googleapis";
import { v2 as cloudinary } from "cloudinary";

// ---------------------------------------------------------
// Configuration & Global Caching (For Speed)
// ---------------------------------------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Initialize Google Auth OUTSIDE the handler so Vercel caches the connection
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Helper: Generate Alphanumeric Code
function generateCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

// Helper: Check if photo already exists in Cloudinary
async function getExistingPhotoUrl(mobile: string): Promise<string | null> {
  try {
    const publicId = `TDEUP_Visitors/${mobile}`;
    const result = await cloudinary.api.resource(publicId);
    return result.secure_url;
  } catch (error) {
    return null;
  }
}

// Helper: Cloudinary Upload
async function uploadToCloudinary(buffer: Buffer, mobile: string, retries = 2): Promise<string> {
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
      if (attempt === retries) throw new Error("Image upload failed due to poor network.");
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return "Upload Failed";
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const mobile = formData.get("mobile") as string;

    if (!mobile) {
      return NextResponse.json(
        { success: false, message: "Mobile number is required." },
        { status: 400 }
      );
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // ---------------------------------------------------------
    // 1. FAST PARALLEL FETCH: Check Sheets & Cloudinary simultaneously
    // ---------------------------------------------------------
    // Note the ranges: Column C is Mobile, Column A is UID
    const sheetsPromise = sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: ["Sheet1!C:C", "Sheet1!A:A"],
    });
    const photoPromise = getExistingPhotoUrl(mobile);

    // Wait for both network requests to finish at the same time
    const [sheetsResponse, existingPhotoUrl] = await Promise.all([sheetsPromise, photoPromise]);

    const existingMobiles = sheetsResponse.data.valueRanges?.[0].values?.flat() || [];
    const existingUids = sheetsResponse.data.valueRanges?.[1].values?.flat() || [];

    // Reject Duplicate Mobile Numbers immediately
    if (existingMobiles.includes(mobile.trim())) {
      return NextResponse.json(
        { success: false, message: "User with this mobile number is already registered." },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------
    // 2. Generate Guaranteed Unique UID
    // ---------------------------------------------------------
    const attendeeType = (formData.get("attendeeType") as string) || "GENERAL";
    const typeInitial = attendeeType.charAt(0).toUpperCase();

    let uid;
    let safetyCounter = 0;
    do {
      uid = `TDE26-${typeInitial}-${generateCode(6)}`;
      safetyCounter++;
      if (safetyCounter > 10) throw new Error("Could not generate a unique UID");
    } while (existingUids.includes(uid));

    // ---------------------------------------------------------
    // 3. Handle Photo Upload (Skip if existing was found)
    // ---------------------------------------------------------
    let photoUrl = existingPhotoUrl;

    if (!photoUrl) {
      const photoFile = formData.get("photo") as File | null;
      if (photoFile) {
        const buffer = Buffer.from(await photoFile.arrayBuffer());
        photoUrl = await uploadToCloudinary(buffer, mobile);
      } else {
        photoUrl = "NULL";
      }
    }

    // ---------------------------------------------------------
    // 4. Parse Data & Apply "NULL" Logic
    // ---------------------------------------------------------
    let businessName = formData.get("businessName") as string;
    if (!businessName || businessName.trim() === "" || attendeeType === "GENERAL") {
      businessName = "NULL";
    }

    let businessCategory =
      (formData.get("businessCategory") as string) || (formData.get("otherCategory") as string);
    if (!businessCategory || businessCategory.trim() === "") {
      businessCategory = "NULL";
    }

    // ---------------------------------------------------------
    // 5. Append Data to Google Sheets (IN EXACT COLUMN ORDER)
    // ---------------------------------------------------------
    const rowData = [
      uid, // A: UID
      formData.get("fullName"), // B: Full Name
      mobile, // C: Mobile
      formData.get("email") || "NULL", // D: Email
      formData.get("gender"), // E: Gender
      attendeeType, // F: Visitor Type
      businessName, // G: Business Name
      businessCategory, // H: Business Category
      formData.get("city"), // I: City
      formData.get("state"), // J: State
      formData.get("attendance"), // K: Attending Days
      photoUrl, // L: Photo Link
      new Date().toISOString(), // M: Timestamp
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Sheet1!A:M",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [rowData],
      },
    });

    // ---------------------------------------------------------
    // 6. Return Success
    // ---------------------------------------------------------
    return NextResponse.json({
      success: true,
      attendeeId: uid,
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
