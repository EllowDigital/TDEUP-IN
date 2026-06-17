"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PHOTO_DIMENSION = 800;
const PHOTO_JPEG_QUALITY = 0.6;

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

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Delhi", "Jammu and Kashmir",
  "Ladakh",
];

interface RegFormProps {
  onSuccess: (data: FormValues) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Downscales + re-encodes an image client-side so uploads stay small.
 * Always revokes the temporary object URL it creates, on both success and failure.
 */
function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        let { width, height } = img;

        if (width > height) {
          if (width > MAX_PHOTO_DIMENSION) {
            height = Math.round((height * MAX_PHOTO_DIMENSION) / width);
            width = MAX_PHOTO_DIMENSION;
          }
        } else if (height > MAX_PHOTO_DIMENSION) {
          width = Math.round((width * MAX_PHOTO_DIMENSION) / height);
          height = MAX_PHOTO_DIMENSION;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas is not supported on this device."));
          return;
        }

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegForm({ onSuccess }: RegFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photoPreview, setPhotoPreview] = useState("");
  const [compressedPhoto, setCompressedPhoto] = useState<File | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");

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

  const watchAttendeeType = form.watch("attendeeType");
  const watchBusinessCategory = form.watch("businessCategory");

  // Revoke the current preview URL whenever it's replaced or the component
  // unmounts, so we never leak blob URLs.
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handlePhotoUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset the input so choosing the same file again still fires onChange.
      event.target.value = "";

      if (!file) return;

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
        console.error(error);
        setPhotoError(
          "Couldn't process this image. Please try another photo / फ़ोटो प्रोसेस नहीं हो सकी"
        );
      } finally {
        setIsProcessingPhoto(false);
      }
    },
    []
  );

  const onSubmit = async (data: FormValues) => {
    await onSuccess({ ...data, photo: compressedPhoto });
  };

  const showOrgSection = ["BUSINESS", "EXHIBITOR", "MEDIA"].includes(watchAttendeeType);
  const isBusy = form.formState.isSubmitting || isProcessingPhoto;

  return (
    <div className="max-w-2xl mx-auto w-full">
      {/* Help Banner */}
      <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-xl text-sm mb-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="block font-medium mb-1">विज़िटर पास खो गया है? (Lost your pass?)</span>
          <span className="text-blue-600/80">अपना पुराना पास तुरंत वापस पाएं।</span>
        </div>
        <Button
          variant="outline"
          type="button"
          className="bg-white text-blue-700 border-blue-200 hover:bg-blue-100 whitespace-nowrap w-full sm:w-auto"
        >
          <Search className="w-4 h-4 mr-2" /> Find Pass
        </Button>
      </div>

      <div className="mb-8">
        <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-2 tracking-tight">
          Visitor Registration
        </h2>
        <p className="text-slate-500">
          Please provide your details below to secure your E-Pass. <br className="hidden sm:block" />
          (अपना ई-पास प्राप्त करने के लिए कृपया नीचे अपना विवरण भरें।)
        </p>
      </div>

      {/* Photo Upload */}
      <div className="flex flex-col items-center mb-6">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload profile photo / प्रोफ़ाइल फ़ोटो अपलोड करें"
          disabled={isProcessingPhoto}
          className="relative w-40 h-40 cursor-pointer group appearance-none bg-transparent border-0 p-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-wait"
        >
          {photoPreview ? (
            <img
              src={photoPreview}
              alt="Uploaded profile preview"
              className="w-full h-full rounded-full object-cover border-4 border-white shadow-xl"
            />
          ) : (
            <div className="w-full h-full rounded-full border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center group-hover:border-blue-500 group-hover:bg-slate-100 transition-all">
              <User className="w-12 h-12 text-slate-400" />
              <span className="text-xs font-semibold mt-2">Upload Photo</span>
              <span className="text-[10px] text-slate-500">JPG • PNG • WEBP</span>
              <span className="text-[10px] text-slate-500">Max 10MB (Auto Compressed)</span>
            </div>
          )}

          <div className="absolute bottom-1 right-1 bg-[#0B1B2B] text-white p-3 rounded-full border-2 border-white shadow-lg">
            {isProcessingPhoto ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
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
          <p className="flex items-center gap-1.5 text-xs text-red-600 mt-3" role="alert">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {photoError}
          </p>
        )}
      </div>

      <Form {...form}>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* SECTION 1: Personal Details */}
          <div className="space-y-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
              <User className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-800">
                Personal Details / व्यक्तिगत विवरण
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700">Full Name / पूरा नाम *</FormLabel>
                    <FormControl>
                      <Input
                        className="h-11 bg-slate-50"
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
                    <FormLabel className="text-slate-700">Mobile Number / मोबाइल नंबर *</FormLabel>
                    <FormControl>
                      <Input
                        className="h-11 bg-slate-50"
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
                    <FormLabel className="text-slate-700">Email Address (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        className="h-11 bg-slate-50"
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
                    <FormLabel className="text-slate-700">Gender / लिंग *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 bg-slate-50">
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

          {/* SECTION 2: Visitor Profile */}
          <div className="space-y-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
              <Briefcase className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-slate-800">
                Visitor Profile / दर्शक प्रोफ़ाइल
              </h3>
            </div>

            <FormField
              control={form.control}
              name="attendeeType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-700">Visitor Type / दर्शक का प्रकार *</FormLabel>
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      // Dynamic clearing and smart setting based on type
                      if (val === "MEDIA") {
                        form.setValue("businessCategory", "Media/Press");
                        form.setValue("otherCategory", "");
                      } else if (val === "GENERAL") {
                        form.setValue("businessName", "");
                        form.setValue("businessCategory", "");
                        form.setValue("otherCategory", "");
                      } else {
                        form.setValue("businessCategory", "");
                        form.setValue("otherCategory", "");
                      }
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="h-11 bg-slate-50">
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
              <div className="pt-2 pb-1 space-y-5 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700">
                          {watchAttendeeType === "MEDIA"
                            ? "Media/Press Name / मीडिया का नाम *"
                            : "Firm/Company Name / फर्म का नाम *"}
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="h-11 bg-amber-50/50 border-amber-200 focus-visible:ring-amber-500"
                            placeholder={watchAttendeeType === "MEDIA" ? "News Network..." : "Company Ltd."}
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
                          <FormLabel className="text-slate-700">Business Category / श्रेणी *</FormLabel>
                          <Select
                            onValueChange={(val) => {
                              field.onChange(val);
                              if (val !== "OTHER") form.setValue("otherCategory", "");
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11 bg-amber-50/50 border-amber-200 focus-visible:ring-amber-500">
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

                {/* 'OTHER' Category Input */}
                {watchBusinessCategory === "OTHER" && watchAttendeeType !== "MEDIA" && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <FormField
                      control={form.control}
                      name="otherCategory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700">
                            Please Specify Category / कृपया श्रेणी निर्दिष्ट करें *
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 bg-amber-50/50 border-amber-200"
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

          {/* SECTION 3: Location & Days */}
          <div className="space-y-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
              <MapPin className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-semibold text-slate-800">
                Location & Attendance / स्थान और उपस्थिति
              </h3>
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-700">Full Address / पूरा पता *</FormLabel>
                  <FormControl>
                    <Input
                      className="h-11 bg-slate-50"
                      placeholder="123 Street Name, Area"
                      autoComplete="street-address"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700">City / शहर *</FormLabel>
                    <FormControl>
                      <Input
                        className="h-11 bg-slate-50"
                        placeholder="Lucknow"
                        autoComplete="address-level2"
                        {...field}
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
                    <FormLabel className="text-slate-700">State / राज्य *</FormLabel>
                    <FormControl>
                      <Input
                        className="h-11 bg-slate-50"
                        placeholder="Uttar Pradesh"
                        list="indian-states"
                        autoComplete="address-level1"
                        {...field}
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
                    <FormLabel className="text-slate-700">Pincode *</FormLabel>
                    <FormControl>
                      <Input
                        className="h-11 bg-slate-50"
                        placeholder="226001"
                        inputMode="numeric"
                        maxLength={6}
                        autoComplete="postal-code"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Suggestions for the State field; doesn't restrict free typing */}
            <datalist id="indian-states">
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>

            <FormField
              control={form.control}
              name="attendance"
              render={() => (
                <FormItem className="pt-2">
                  <FormLabel className="font-bold text-slate-800 block mb-3">
                    Select Attending Days / उपस्थिति के दिन *
                  </FormLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {EVENT_DAYS.map((item) => (
                      <FormField
                        key={item.id}
                        control={form.control}
                        name="attendance"
                        render={({ field }) => {
                          const isChecked = field.value?.includes(item.id);
                          return (
                            <FormItem className="flex-1 m-0">
                              <FormLabel
                                className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all w-full ${isChecked
                                  ? "border-[#0B1B2B] bg-[#0B1B2B] text-white shadow-md scale-[1.02]"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                  }`}
                              >
                                <FormControl className="hidden">
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) =>
                                      checked
                                        ? field.onChange([...(field.value ?? []), item.id])
                                        : field.onChange(field.value?.filter((val) => val !== item.id))
                                    }
                                  />
                                </FormControl>
                                <span className="font-bold text-base">{item.title}</span>
                                <span
                                  className={`text-xs mt-1 font-medium ${isChecked ? "text-slate-300" : "text-slate-400"
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
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            type="submit"
            disabled={isBusy}
            className="w-full h-14 bg-[#F5B415] hover:bg-[#dca113] disabled:opacity-70 disabled:hover:bg-[#F5B415] text-black font-bold text-lg md:text-xl rounded-xl shadow-lg transition-all hover:scale-[1.01] disabled:scale-100 flex items-center justify-center gap-2"
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Submitting...
              </>
            ) : isProcessingPhoto ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Processing Photo...
              </>
            ) : (
              "Submit & Get E-Pass"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
