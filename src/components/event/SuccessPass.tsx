"use client";

import { useRef } from "react";
import { toPng } from "html-to-image";
import { Download, User, MapPin } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { FormValues } from "@/lib/schema";
import { Cinzel } from "next/font/google";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

interface SuccessPassProps {
  attendeeData: FormValues;
  attendeeId: string;
  onReset: () => void;
}

export function SuccessPass({ attendeeData, attendeeId, onReset }: SuccessPassProps) {
  const passRef = useRef<HTMLDivElement>(null);

  const downloadPass = async () => {
    if (!passRef.current) return;

    try {
      await document.fonts.ready;

      const dataUrl = await toPng(passRef.current, {
        cacheBust: true,
        pixelRatio: 8,
        backgroundColor: "#ffffff",

        width: 350,
        height: 560,

        canvasWidth: 2800,
        canvasHeight: 4800,
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${attendeeId}-EPass.png`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download pass:", error);
    }
  };
  // --- DYNAMIC PASS THEME COLORS ---
  const getTheme = () => {
    switch (attendeeData.attendeeType) {
      case "BUSINESS": return { bg: "bg-[#F5B415]", text: "text-[#D97706]", label: "BUSINESS PASS" };
      case "EXHIBITOR": return { bg: "bg-[#006a47]", text: "text-[#00593d]", label: "EXHIBITOR PASS" };
      case "MEDIA": return { bg: "bg-[#ff0000]", text: "text-[#ff0000ff]", label: "MEDIA PASS" };
      case "GENERAL": return { bg: "bg-[#0062ff]", text: "text-[#0051ff]", label: "GENERAL PASS" };
      default: return { bg: "bg-[#F5B415]", text: "text-[#D97706]", label: "ATTENDEE PASS" };
    }
  };
  const theme = getTheme();

  // --- SMART ATTENDANCE DAYS LOGIC ---
  const displayDays = attendeeData.attendance.length === 3
    ? "All Days"
    : attendeeData.attendance.join(", ");

  // --- DYNAMIC QR CODE PAYLOAD ---

  const showOrgDetails = ["BUSINESS", "EXHIBITOR", "MEDIA"].includes(attendeeData.attendeeType);

  const qrData = {
    attendeeId,
    fullName: attendeeData.fullName,
    attendeeType: attendeeData.attendeeType,
  };

  if (showOrgDetails) {
    Object.assign(qrData, {
      organization: attendeeData.businessName || "N/A",
      category:
        attendeeData.attendeeType === "MEDIA"
          ? "Media/Press"
          : attendeeData.businessCategory === "OTHER"
            ? attendeeData.otherCategory || "N/A"
            : attendeeData.businessCategory || "N/A",
    });
  }

  const qrPayload = JSON.stringify(qrData);

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 animate-in fade-in zoom-in duration-500">

      {/* --- STRICT E-PASS LAYOUT FOR PNG DOWNLOAD --- */}
      {/* This is the container attached to `passRef`. 
        Everything inside here gets downloaded. Everything outside (like buttons) is ignored. 
      */}
      <div
        ref={passRef}
        className="overflow-hidden flex flex-col relative border-2 border-slate-200"
        style={{
          width: "350px",
          height: "560px",
          borderRadius: "16px",
          backgroundColor: "#ffffff",
          color: "#000000",
          WebkitFontSmoothing: "antialiased",
          textRendering: "geometricPrecision",
        }}
      >
        {/* Header Strip */}
        <div className="h-[130px] bg-[#0B1B2B] flex flex-col items-center justify-center px-4 relative">
          <h2
            className={`${cinzel.className} text-[30px] font-bold uppercase text-center text-[#D4AF37]`}
          >
            TENT DECOR EXPO
          </h2>

          <p
            className={`${cinzel.className} -mt-2 text-[16px] font-semibold uppercase tracking-[0.15em] text-[#ffffff] text-center leading-none`}
          >
            UTTAR PRADESH 2026
          </p>
        </div>

        {/* Overlapping Profile Picture - Positioned to prevent text collision */}
        <div className="absolute top-[95px] left-1/2 -translate-x-1/2 z-10">
          <div className="w-[90px] h-[90px] bg-[#EEF2F6] rounded-full border-[4px] border-white flex items-center justify-center overflow-hidden">
            <User className="text-[#8B9DB1] w-10 h-10 mt-1" strokeWidth={1.5} />
          </div>
        </div>

        {/* Main Body Area */}
        <div className="px-6 pt-[55px] pb-4 flex flex-col items-center w-full">

          {/* Identity & Status Section */}
          <div className="text-center w-full">
            <h3 className="font-serif font-bold text-[24px] text-[#000000] uppercase tracking-wide line-clamp-1">
              {attendeeData.fullName}
            </h3>
            <p className={`mt-1 text-[11px] font-bold tracking-[0.2em] uppercase ${theme.text}`}>
              {theme.label}
            </p>
            {/* Conditional Firm/Media Name */}
            {showOrgDetails && (
              <p className="mt-1 text-[13px] text-slate-600 font-semibold uppercase line-clamp-1">
                {attendeeData.businessName}
              </p>
            )}
          </div>

          {/* Core Info Grid: QR Code (Left) & Access Info (Right) */}
          <div className="flex flex-row w-full mt-4 mb-2 items-center border-y border-slate-100 py-3">

            {/* Left Column: Fast-Scan QR Code */}
            <div className="w-[45%] flex flex-col items-center justify-center border-r border-slate-200 pr-3">
              <div className="p-3 bg-white border-2 border-slate-200 rounded-xl">
                <QRCodeSVG
                  value={qrPayload}
                  size={110}
                  level="M"
                  includeMargin={true}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                />
              </div>
              <p className="text-[8px] text-slate-600 mt-2 font-bold tracking-widest uppercase">
                SCAN AT ENTRY
              </p>
            </div>

            {/* Right Column: Key Details */}
            <div className="w-[55%] flex flex-col pl-4 space-y-4">
              <div>
                <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase mb-0.5">
                  Attendee ID
                </p>
                <p className="text-[17px] font-bold text-slate-800 font-mono">
                  {attendeeId}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase mb-0.5">
                  Valid Days
                </p>
                <p className="text-[12px] font-semibold text-[#0B1B2B] leading-tight">
                  {displayDays}
                </p>
              </div>
            </div>
          </div>

          {/* Venue Information (Bottom Area) */}
          <div className="mt-6 mb-4 flex flex-col items-center text-center px-4 w-full">
            <MapPin className="w-4 h-4 text-slate-400 mb-1" />
            <p className="text-[12px] text-slate-400 font-bold uppercase tracking-widest">
              Event Venue
            </p>
            <p className="text-[16px] font-bold text-slate-900 mt-0.5">
              Sanskar Lawn, Kidwai Nagar, Kanpur
            </p>
          </div>
        </div>

        {/* Dynamic Footer Theme Strip */}
        <div className={`h-[16px] w-full mt-auto ${theme.bg}`}></div>
      </div>

      {/* --- EXTERNAL CONTROLS (Hidden from PNG) --- */}
      {/* Because these buttons are OUTSIDE the div with `ref={passRef}`, 
        they will not be included in the downloaded PNG. 
      */}
      <div className="flex flex-col gap-3 w-[350px]">
        <Button onClick={downloadPass} className="w-full bg-[#0B1B2B] hover:bg-[#15304B] py-6 text-[15px] font-semibold rounded-xl transition-all shadow-md hover:shadow-lg">
          <Download className="w-5 h-5 mr-2" /> Download E-Pass
        </Button>
        <Button onClick={onReset} variant="outline" className="w-full border-slate-400 text-slate-900 font-medium py-6 rounded-xl hover:bg-slate-50 transition-all">
          Register Another Person
        </Button>
      </div>
    </div>
  );
}