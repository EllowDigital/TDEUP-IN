"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Briefcase, Camera, Loader2, MapPin, Search, User } from "lucide-react";

import { formSchema, type FormValues } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { State, City } from "country-state-city";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB, before client-side compression
const MAX_PHOTO_DIMENSION = 800;
const PHOTO_JPEG_QUALITY = 0.6;
// Photos already at/under this size, already JPEG, and already small enough
// dimension-wise skip re-encoding entirely — re-running a JPEG through
// canvas + toBlob again only adds generational compression loss for files
// that don't need it.
const SKIP_COMPRESSION_BYTES = 400 * 1024; // 400KB
const SUBMIT_TIMEOUT_MS = 30_000;

const EVENT_DAYS = [
  { id: "30 August", title: "Day 1", date: "Aug 30" },
  { id: "31 August", title: "Day 2", date: "Aug 31" },
  { id: "1 September", title: "Day 3", date: "Sep 1" },
] as const;

const BUSINESS_CATEGORIES = [
  { value: "TENT", label: "Tent / टेंट" },
  { value: "CATERING", label: "Caterers / कैटरर्स" },
  { value: "DECORATOR", label: "Decorator / डेकोरेटर" },
  { value: "FLOWER", label: "Flower Decoration / फूल सजावट" },
  { value: "DJ", label: "DJ / डीजे" },
  { value: "LIGHT", label: "Light & Sound / लाइट एवं साउंड" },
  { value: "PHOTOGRAPHY", label: "Photography / फोटोग्राफी" },
  { value: "VIDEOGRAPHY", label: "Videography / वीडियोग्राफी" },
  { value: "EVENT_PLANNER", label: "Event Planner / इवेंट प्लानर" },
  { value: "STAGE", label: "Stage Setup / स्टेज सजावट" },
  { value: "BAND", label: "Band / बैंड" },
  { value: "MAKEUP", label: "Makeup Artist / मेकअप आर्टिस्ट" },
  { value: "HOTEL", label: "Hotel & Banquet / होटल एवं बैंक्वेट" },
  { value: "TRANSPORT", label: "Transport / परिवहन" },
  { value: "OTHER", label: "Other (Please Specify) / अन्य" },
] as const;

// India's state list never changes at runtime — compute it once at module
// scope instead of on every render (or even via a hook).
const INDIAN_STATES = State.getStatesOfCountry("IN");

interface RegFormProps {
  // Expects both the validated data and the server-generated attendee ID.
  onSuccess: (data: FormValues, attendeeId: string) => void | Promise<void>;
}

interface RegisterResponse {
  attendeeId?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Downscales + re-encodes an image client-side so uploads stay small.
 * Skips re-encoding if the file is already a small JPEG within bounds.
 * Always revokes the temporary object URL it creates, on both success and failure.
 */
function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        let { width, height } = img;
        const needsResize = width > MAX_PHOTO_DIMENSION || height > MAX_PHOTO_DIMENSION;

        if (!needsResize && file.type === "image/jpeg" && file.size <= SKIP_COMPRESSION_BYTES) {
          resolve(file);
          return;
        }

        if (needsResize) {
          if (width > height) {
            height = Math.round((height * MAX_PHOTO_DIMENSION) / width);
            width = MAX_PHOTO_DIMENSION;
          } else {
            width = Math.round((width * MAX_PHOTO_DIMENSION) / height);
            height = MAX_PHOTO_DIMENSION;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas is not supported on this device."));
          return;
        }

        // JPEG has no alpha channel — fill white first so transparent
        // source images (e.g. PNGs) don't turn black after re-encoding.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Could not process this image."));
              return;
            }
            resolve(new File([blob], `${Date.now()}.jpg`, { type: "image/jpeg" }));
          },
          "image/jpeg",
          PHOTO_JPEG_QUALITY
        );
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This file could not be read as an image."));
    };

    img.src = objectUrl;
  });
}

/** Builds the multipart payload sent to /api/register. */
function buildRegistrationFormData(data: FormValues, photo: File | null): FormData {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value));
    } else if (typeof value === "string" && value.length > 0) {
      formData.append(key, value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      formData.append(key, String(value));
    }
  });

  if (photo) {
    formData.append("photo", photo);
  }

  return formData;
}

/** Turns an HTML id-unsafe label (e.g. "30 August") into a safe id fragment. */
function toSafeId(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegForm({ onSuccess }: RegFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Guards against concurrent submissions (e.g. pressing Enter rapidly),
  // which can race ahead of React state updates from isSubmitting.
  const isSubmittingRef = useRef(false);

  const [photoPreview, setPhotoPreview] = useState("");
  const [compressedPhoto, setCompressedPhoto] = useState<File | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      fullName: "",
      mobile: "",
      gender: "MALE",
      email: "",
      businessName: "",
      businessCategory: "",
      otherCategory: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      attendeeType: "GENERAL",
      attendance: [],
    },
  });

  const selectedState = form.watch("state");
  const watchAttendeeType = form.watch("attendeeType");
  const watchBusinessCategory = form.watch("businessCategory");

  // Both lookups below were previously recomputed on every render (form.watch
  // re-renders on every keystroke across the whole form). Memoizing keeps
  // these tied only to the state that actually selects a different state.
  const selectedStateObj = useMemo(
    () => INDIAN_STATES.find((s) => s.name === selectedState),
    [selectedState]
  );

  const cities = useMemo(
    () => (selectedStateObj ? City.getCitiesOfState("IN", selectedStateObj.isoCode) : []),
    [selectedStateObj]
  );

  // Revoke the current preview URL whenever it's replaced or the component
  // unmounts, so we never leak blob URLs.
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handlePhotoUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so choosing the same file again still fires onChange.
    event.target.value = "";

    if (!file) return;
    if (isSubmittingRef.current) return; // don't swap photo mid-submission

    setPhotoError("");

    if (!file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file / कृपया एक इमेज फ़ाइल चुनें");
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      setPhotoError("Maximum allowed image size is 10MB / अधिकतम आकार 10MB है");
      return;
    }

    setIsProcessingPhoto(true);

    try {
      const compressed = await compressImage(file);
      setCompressedPhoto(compressed);
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(compressed);
      });
    } catch (error) {
      console.error("Photo processing failed:", error);
      setPhotoError(
        "Couldn't process this image. Please try another photo / फ़ोटो प्रोसेस नहीं हो सकी"
      );
    } finally {
      setIsProcessingPhoto(false);
    }
  }, []);

  // Centralizes the side-effects of switching visitor type so the Select's
  // onValueChange stays readable.
  const handleAttendeeTypeChange = useCallback(
    (value: string) => {
      form.setValue("attendeeType", value as FormValues["attendeeType"]);

      if (value === "MEDIA") {
        // businessCategory is a required field in the schema but the
        // category picker is hidden for MEDIA — store a sentinel value so
        // validation still passes.
        form.setValue("businessCategory", "Media/Press");
        form.setValue("otherCategory", "");
      } else if (value === "GENERAL") {
        form.setValue("businessName", "");
        form.setValue("businessCategory", "");
        form.setValue("otherCategory", "");
      } else {
        form.setValue("businessCategory", "");
        form.setValue("otherCategory", "");
      }
    },
    [form]
  );

  const onSubmit = async (data: FormValues) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitError("");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

    try {
      const formData = buildRegistrationFormData(data, compressedPhoto);

      let response: Response;
      try {
        response = await fetch("/api/register", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
      } catch (networkError) {
        if (networkError instanceof DOMException && networkError.name === "AbortError") {
          setSubmitError(
            "The request timed out. Please check your connection and try again / समय सीमा समाप्त, कृपया पुनः प्रयास करें।"
          );
        } else {
          setSubmitError(
            "Network error. Please check your connection and try again / नेटवर्क त्रुटि, कृपया पुनः प्रयास करें।"
          );
        }
        return;
      }

      // The server might fail before producing valid JSON (e.g. a gateway
      // timeout returning an HTML page) — don't let that throw past us.
      let result: RegisterResponse = {};
      try {
        result = await response.json();
      } catch {
        // fall through; handled by the !response.ok / missing attendeeId checks below
      }

      if (!response.ok) {
        // Surfaces server-side validation issues, e.g. a duplicate mobile number.
        setSubmitError(
          result.message || `Registration failed (${response.status}). Please try again.`
        );
        return;
      }

      if (!result.attendeeId) {
        setSubmitError(
          "Registration could not be confirmed. Please try again or contact the help desk."
        );
        return;
      }

      // Registration is confirmed on the server at this point — reset local
      // state unconditionally so the visitor can't accidentally double-submit,
      // regardless of whether the onSuccess callback below succeeds.
      const submittedPhoto = compressedPhoto;
      form.reset();
      setPhotoPreview("");
      setCompressedPhoto(null);

      try {
        await onSuccess({ ...data, photo: submittedPhoto } as FormValues, result.attendeeId);
      } catch (callbackError) {
        console.error("onSuccess callback failed:", callbackError);
        setSubmitError(
          "You're registered! We couldn't load your E-Pass screen — please refresh, your registration is saved."
        );
      }
    } catch (error) {
      console.error("Submission failed:", error);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      clearTimeout(timeoutId);
      isSubmittingRef.current = false;
    }
  };

  const showOrgSection = ["BUSINESS", "EXHIBITOR", "MEDIA"].includes(watchAttendeeType);
  const isBusy = form.formState.isSubmitting || isProcessingPhoto;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Help Banner */}
      <div className="bg-blue-50/80 border border-blue-200 text-blue-900 p-4 rounded-2xl text-sm mb-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:shadow-md">
        <div className="flex flex-col">
          <span className="font-bold text-base mb-0.5">
            विज़िटर पास खो गया है? (Lost your pass?)
          </span>
          <span className="text-blue-700 font-medium">अपना पुराना पास तुरंत वापस पाएं।</span>
        </div>
        <Button
          variant="outline"
          type="button"
          className="bg-white text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800 whitespace-nowrap w-full sm:w-auto rounded-xl h-11 font-semibold shadow-sm"
        >
          <Search className="w-4 h-4 mr-2" /> Find Pass
        </Button>
      </div>

      <div className="mb-8 sm:mb-10 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
          Visitor Registration
        </h2>
        <p className="mt-3 text-slate-500 font-medium max-w-2xl mx-auto text-sm sm:text-base">
          Complete your registration and instantly receive your digital E-Pass.
        </p>
      </div>

      {/* Photo Upload */}
      <div className="flex flex-col items-center mb-8">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload profile photo / प्रोफ़ाइल फ़ोटो अपलोड करें"
          disabled={isBusy}
          className="relative w-32 h-32 sm:w-40 sm:h-40 cursor-pointer group appearance-none bg-transparent border-0 p-0 rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 disabled:cursor-wait transition-transform hover:scale-[1.02]"
        >
          {photoPreview ? (
            <Image
              src={photoPreview}
              alt="Uploaded profile preview"
              width={160}
              height={160}
              className="w-full h-full rounded-full object-cover border-4 border-white shadow-lg"
            />
          ) : (
            <div className="w-full h-full rounded-full border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center group-hover:border-blue-500 group-hover:bg-blue-50/50 transition-all shadow-sm">
              <User className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400 group-hover:text-blue-500 mb-2 transition-colors" />
              <span className="text-xs font-bold text-slate-600 group-hover:text-blue-600">
                Upload Photo
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium mt-0.5">
                JPG • PNG • Max 10MB
              </span>
            </div>
          )}

          <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 bg-[#0B1B2B] text-white p-2.5 sm:p-3 rounded-full border-2 border-white shadow-lg transition-transform group-hover:scale-110">
            {isProcessingPhoto ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
            ) : (
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </div>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={handlePhotoUpload}
        />

        {photoError && (
          <p
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 mt-4 bg-red-50 py-2 px-3 rounded-lg"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {photoError}
          </p>
        )}
      </div>

      <Form {...form}>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8">
          {/* SECTION 1: Personal Details */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <div className="p-2.5 bg-blue-50 rounded-xl">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-800 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                Personal Details
                <span className="text-xs sm:text-sm font-medium text-slate-400">
                  / व्यक्तिगत विवरण
                </span>
              </h3>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">
                        Full Name / पूरा नाम *
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="h-12 bg-slate-50 border-slate-200 shadow-sm transition-colors hover:border-slate-300 focus-visible:ring-blue-500/20"
                          placeholder="John Doe"
                          autoComplete="name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">
                        Mobile Number / मोबाइल नंबर *
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="h-12 bg-slate-50 border-slate-200 shadow-sm transition-colors hover:border-slate-300 focus-visible:ring-blue-500/20"
                          placeholder="9876543210"
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          autoComplete="tel"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">
                        Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="h-12 bg-slate-50 border-slate-200 shadow-sm transition-colors hover:border-slate-300 focus-visible:ring-blue-500/20"
                          placeholder="john@example.com"
                          type="email"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">
                        Gender / लिंग *
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 bg-slate-50 border-slate-200 shadow-sm transition-colors hover:border-slate-300 focus:ring-blue-500/20">
                            <SelectValue placeholder="Select Gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MALE">Male / पुरुष</SelectItem>
                          <SelectItem value="FEMALE">Female / महिला</SelectItem>
                          <SelectItem value="OTHER">Other / अन्य</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Visitor Profile */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <Briefcase className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-800 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                Visitor Profile
                <span className="text-xs sm:text-sm font-medium text-slate-400">
                  / दर्शक प्रोफ़ाइल
                </span>
              </h3>
            </div>

            <div className="space-y-5">
              <FormField
                control={form.control}
                name="attendeeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700">
                      Visitor Type / दर्शक का प्रकार *
                    </FormLabel>
                    <Select onValueChange={handleAttendeeTypeChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 bg-slate-50 border-slate-200 shadow-sm transition-colors hover:border-slate-300 focus:ring-amber-500/20">
                          <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="GENERAL">General Attendee / सामान्य</SelectItem>
                        <SelectItem value="BUSINESS">Business Owner / व्यापार</SelectItem>
                        <SelectItem value="EXHIBITOR">Exhibitor / प्रदर्शक</SelectItem>
                        <SelectItem value="MEDIA">Media / मीडिया</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Dynamic Organization Fields */}
              {showOrgSection && (
                <div className="pt-3 pb-1 space-y-5 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <FormField
                      control={form.control}
                      name="businessName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-slate-700">
                            {watchAttendeeType === "MEDIA"
                              ? "Media/Press Name / मीडिया का नाम *"
                              : "Firm/Company Name / फर्म का नाम *"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="h-12 bg-amber-50/30 border-amber-200 shadow-sm transition-colors hover:border-amber-300 focus-visible:ring-amber-500/20"
                              placeholder={
                                watchAttendeeType === "MEDIA" ? "News Network..." : "Company Ltd."
                              }
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {watchAttendeeType !== "MEDIA" && (
                      <FormField
                        control={form.control}
                        name="businessCategory"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-slate-700">
                              Business Category / श्रेणी *
                            </FormLabel>
                            <Select
                              onValueChange={(val) => {
                                field.onChange(val);
                                if (val !== "OTHER") form.setValue("otherCategory", "");
                              }}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-12 bg-amber-50/30 border-amber-200 shadow-sm transition-colors hover:border-amber-300 focus:ring-amber-500/20">
                                  <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {BUSINESS_CATEGORIES.map((cat) => (
                                  <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  {watchBusinessCategory === "OTHER" && watchAttendeeType !== "MEDIA" && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                      <FormField
                        control={form.control}
                        name="otherCategory"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-slate-700">
                              Please Specify Category / कृपया श्रेणी निर्दिष्ट करें *
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="h-12 bg-amber-50/30 border-amber-200 shadow-sm transition-colors hover:border-amber-300 focus-visible:ring-amber-500/20"
                                placeholder="e.g. Lighting, Security, Sound..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: Location & Days */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <div className="p-2.5 bg-emerald-50 rounded-xl">
                <MapPin className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-800 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                Location & Attendance
                <span className="text-xs sm:text-sm font-medium text-slate-400">
                  / स्थान और उपस्थिति
                </span>
              </h3>
            </div>

            <div className="space-y-5">
              {/* Address */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700">
                      Full Address / पूरा पता *
                    </FormLabel>

                    <FormControl>
                      <Input
                        {...field}
                        className="h-12 bg-slate-50 border-slate-200 shadow-sm transition-colors hover:border-slate-300 focus-visible:ring-emerald-500/20"
                        placeholder="123 Street Name, Area"
                        autoComplete="street-address"
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* City / State / Pincode */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">
                        City / शहर *
                      </FormLabel>

                      <FormControl>
                        <Input
                          {...field}
                          className="h-12 bg-slate-50 border-slate-200 shadow-sm transition-colors hover:border-slate-300 focus-visible:ring-emerald-500/20"
                          placeholder="Type or select city"
                          list="indian-cities"
                          autoComplete="address-level2"
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">
                        State / राज्य *
                      </FormLabel>

                      <FormControl>
                        <Input
                          {...field}
                          className="h-12 bg-slate-50 border-slate-200 shadow-sm transition-colors hover:border-slate-300 focus-visible:ring-emerald-500/20"
                          placeholder="Type or select state"
                          list="indian-states"
                          autoComplete="address-level1"
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">
                        Pincode *
                      </FormLabel>

                      <FormControl>
                        <Input
                          {...field}
                          className="h-12 bg-slate-50 border-slate-200 shadow-sm transition-colors hover:border-slate-300 focus-visible:ring-emerald-500/20"
                          placeholder="226001"
                          inputMode="numeric"
                          maxLength={6}
                          autoComplete="postal-code"
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* City Suggestions */}
              <datalist id="indian-cities">
                {cities.map((city) => (
                  <option key={`${city.name}-${city.stateCode}`} value={city.name} />
                ))}
              </datalist>

              {/* State Suggestions */}
              <datalist id="indian-states">
                {INDIAN_STATES.map((state) => (
                  <option key={state.isoCode} value={state.name} />
                ))}
              </datalist>

              {/* Attendance Days */}
              <FormField
                control={form.control}
                name="attendance"
                render={() => (
                  <FormItem className="pt-4">
                    <FormLabel className="text-sm font-bold text-slate-800 block mb-3">
                      Select Attending Days / उपस्थिति के दिन *
                    </FormLabel>

                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      {EVENT_DAYS.map((item) => (
                        <FormField
                          key={item.id}
                          control={form.control}
                          name="attendance"
                          render={({ field }) => {
                            const isChecked = field.value?.includes(item.id);
                            const dayInputId = `attendance-${toSafeId(item.id)}`;

                            return (
                              <FormItem className="flex-1 m-0">
                                <Checkbox
                                  id={dayInputId}
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...(field.value ?? []), item.id]);
                                    } else {
                                      field.onChange(
                                        field.value?.filter((value) => value !== item.id)
                                      );
                                    }
                                  }}
                                  className="peer sr-only"
                                />
                                <FormLabel
                                  htmlFor={dayInputId}
                                  className={`flex flex-col items-center justify-center p-3 sm:p-5 border-2 rounded-xl cursor-pointer transition-all w-full select-none peer-focus-visible:ring-4 peer-focus-visible:ring-blue-500/40 peer-focus-visible:ring-offset-2 ${
                                    isChecked
                                      ? "border-[#0B1B2B] bg-[#0B1B2B] text-white shadow-md sm:scale-[1.02]"
                                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
                                  }`}
                                >
                                  <span className="font-extrabold text-sm sm:text-lg">
                                    {item.title}
                                  </span>

                                  <span
                                    className={`text-[10px] sm:text-xs mt-1 sm:mt-1.5 font-semibold tracking-wide uppercase ${
                                      isChecked ? "text-slate-300" : "text-slate-500"
                                    }`}
                                  >
                                    {item.date}
                                  </span>
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>

                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="pt-4 pb-8">
            {submitError && (
              <p
                className="flex items-center gap-1.5 text-sm font-semibold text-red-600 mb-4 bg-red-50 py-2.5 px-3.5 rounded-lg"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {submitError}
              </p>
            )}

            <Button
              type="submit"
              disabled={isBusy}
              className="w-full h-16 sm:h-18 rounded-2xl bg-[#F5B415] hover:bg-[#E0A30E] text-[#0B1B2B] font-extrabold text-lg sm:text-xl shadow-[0_8px_30px_rgba(245,180,21,0.3)] hover:shadow-[0_10px_40px_rgba(245,180,21,0.4)] hover:-translate-y-1 transition-all duration-300"
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin mr-2" /> Submitting...
                </>
              ) : isProcessingPhoto ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin mr-2" /> Processing Photo...
                </>
              ) : (
                "Submit & Get E-Pass"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
