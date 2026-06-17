import * as z from "zod";

// Allows English and Devanagari letters, spaces, dots, hyphens and apostrophes
// (covers initials like "A. K. Sharma" and hyphenated/Hindi names).
const NAME_PATTERN = /^[a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s.'-]{1,99}$/;
const MOBILE_PATTERN = /^[6-9]\d{9}$/;
const PINCODE_PATTERN = /^\d{6}$/;

export const formSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Name is required / नाम आवश्यक है")
      .regex(NAME_PATTERN, "Enter a valid name / वैध नाम दर्ज करें"),
    mobile: z
      .string()
      .trim()
      .regex(MOBILE_PATTERN, "Enter valid mobile number / वैध मोबाइल नंबर आवश्यक है"),
    email: z.string().trim().email("Invalid email / अमान्य ईमेल").optional().or(z.literal("")),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]),
    // Removed Sponsor, Speaker, VIP, Organizer as requested
    attendeeType: z.enum(["BUSINESS", "GENERAL", "MEDIA", "EXHIBITOR"]),
    businessCategory: z.string().trim().optional(),
    otherCategory: z.string().trim().optional(),
    businessName: z.string().trim().optional(),
    address: z.string().trim().min(5, "Address is required / पता आवश्यक है"),
    state: z.string().trim().min(2, "State is required / राज्य आवश्यक है"),
    city: z.string().trim().min(2, "City is required / शहर आवश्यक है"),
    pincode: z.string().trim().regex(PINCODE_PATTERN, "Enter valid pincode / पिनकोड आवश्यक है"),
    attendance: z.array(z.string()).min(1, "Select at least one day / कम से कम एक दिन चुनें"),
  })
  .superRefine((data, ctx) => {
    // Business, Exhibitor, and Media all require a "Name"
    if (["BUSINESS", "EXHIBITOR", "MEDIA"].includes(data.attendeeType)) {
      if (!data.businessName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["businessName"],
          message:
            data.attendeeType === "MEDIA"
              ? "Media Name is required / मीडिया नाम आवश्यक है"
              : "Firm/Company Name is required / फर्म/कंपनी का नाम आवश्यक है",
        });
      }
    }

    // Only Business and Exhibitor require the Category dropdown to be filled
    if (["BUSINESS", "EXHIBITOR"].includes(data.attendeeType)) {
      if (!data.businessCategory) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["businessCategory"],
          message: "Category is required / श्रेणी आवश्यक है",
        });
      }

      if (data.businessCategory === "OTHER" && !data.otherCategory) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["otherCategory"],
          message: "Please specify your category / कृपया श्रेणी बताएं",
        });
      }
    }
  });

/**
 * `photo` is intentionally outside the zod object: it isn't a field the
 * resolver validates, it's an attachment we carry alongside the validated
 * data. It can be:
 *  - a `File`  → fresh, not-yet-uploaded photo straight from RegForm
 *  - a `string` → a hosted URL, once your API has stored the file and
 *    handed back a permanent address (use this shape after the round trip
 *    to your backend, before passing data into SuccessPass)
 *  - `null` / `undefined` → no photo was provided
 */
export type FormValues = z.infer<typeof formSchema> & {
  photo?: File | string | null;
};
