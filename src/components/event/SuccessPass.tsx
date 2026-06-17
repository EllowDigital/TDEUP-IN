"use client";

import { useRef } from "react";
import html2canvas from "html2canvas";
import { Download, User, MapPin } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { FormValues } from "@/lib/schema";

interface SuccessPassProps {
  attendeeData: FormValues;
  attendeeId: string;
  onReset: () => void;
}

export function SuccessPass({ attendeeData, attendeeId, onReset }: SuccessPassProps) {
  const passRef = useRef<HTMLDivElement>(null);

  // --- HIGH RESOLUTION PNG DOWNLOADER ---
  const downloadPass = async () => {
    const element = passRef.current;
    if (!element) return;
    
    try {
      // Scale 4 forces a 4x retina rendering for maximum DPI and no blur
      const canvas = await html2canvas(element, { 
        scale: 4, 
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: "#ffffff",
        width: 350,
        height: 600
      });
      
      // Convert canvas directly to a high-quality PNG image
      const imgData = canvas.toDataURL("image/png", 1.0);
      
      // Create a temporary link to trigger the image download seamlessly
      const link = document.createElement("a");
      link.href = imgData;
      link.download = `${attendeeId}-EPass.png`; // Saves perfectly as PNG
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
      case "BUSINESS":  return { bg: "bg-[#F5B415]", text: "text-[#D97706]", label: "BUSINESS PASS" };
      case "EXHIBITOR": return { bg: "bg-[#10B981]", text: "text-[#059669]", label: "EXHIBITOR PASS" }; 
      case "MEDIA":     return { bg: "bg-[#A855F7]", text: "text-[#7300ffd4]", label: "MEDIA PASS" };
      case "GENERAL":   return { bg: "bg-[#3B82F6]", text: "text-[#2563EB]", label: "GENERAL PASS" };
      default:          return { bg: "bg-[#F5B415]", text: "text-[#D97706]", label: "ATTENDEE PASS" };
    }
  };
  const theme = getTheme();

  // --- SMART ATTENDANCE DAYS LOGIC ---
  const displayDays = attendeeData.attendance.length === 3 
    ? "All Days" 
    : attendeeData.attendance.join(", ");

  // --- DYNAMIC QR CODE PAYLOAD ---
  const qrData: Record<string, string> = {
    Name: attendeeData.fullName,
    ID: attendeeId,
    Type: attendeeData.attendeeType,
    Days: displayDays,
  };

  const showOrgDetails = ["BUSINESS", "EXHIBITOR", "MEDIA"].includes(attendeeData.attendeeType);

  if (showOrgDetails) {
    qrData.Organization = attendeeData.businessName || "N/A";
    
    // Media category defaults to Media/Press, Business/Exhibitors use their specific selection
    if (attendeeData.attendeeType === "MEDIA") {
      qrData.Category = "Media/Press";
    } else {
      qrData.Category = attendeeData.businessCategory === "OTHER" 
        ? (attendeeData.otherCategory || "N/A") 
        : (attendeeData.businessCategory || "N/A");
    }
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
        className="bg-white overflow-hidden flex flex-col relative border-2 border-slate-200"
        style={{ 
          width: "350px", 
          height: "600px", 
          borderRadius: "16px",
          // Force strict anti-aliasing for maximum canvas text clarity
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          textRendering: "geometricPrecision"
        }}
      >
        {/* Header Strip */}
        <div className="h-[140px] bg-[#0B1B2B] text-white flex flex-col items-center justify-start pt-6 px-4 relative">
          <h2 className="font-serif font-bold text-[22px] tracking-wider uppercase text-center leading-snug">
            TENT DECOR EXPO UP<br />2026
          </h2>
        </div>

        {/* Overlapping Profile Picture - Positioned to prevent text collision */}
        <div className="absolute top-[95px] left-1/2 -translate-x-1/2 z-10">
          <div className="w-[90px] h-[90px] bg-[#EEF2F6] rounded-full border-[4px] border-white flex items-center justify-center overflow-hidden">
            <User className="text-[#8B9DB1] w-10 h-10 mt-1" strokeWidth={1.5} />
          </div>
        </div>

        {/* Main Body Area */}
        <div className="flex-1 px-6 pt-[55px] flex flex-col items-center w-full">
          
          {/* Identity & Status Section */}
          <div className="text-center w-full">
            <h3 className="font-serif font-bold text-[22px] text-[#0B1B2B] uppercase tracking-wide line-clamp-1">
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
          <div className="flex flex-row w-full mt-5 mb-3 items-center border-y border-slate-100 py-4">
            
            {/* Left Column: Fast-Scan QR Code */}
            <div className="w-[45%] flex flex-col items-center justify-center border-r border-slate-200 pr-3">
              <div className="p-1 bg-white border border-slate-200 rounded-lg">
                <QRCodeCanvas 
                  value={qrPayload} 
                  size={110} 
                  level={"L"} // Low error correction prevents tiny/dense dots, maximizing scan speed
                  includeMargin={false}
                />
              </div>
              <p className="text-[8px] text-slate-400 mt-2 font-bold tracking-widest uppercase">
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
          <div className="mt-auto mb-4 flex flex-col items-center text-center px-4 w-full">
            <MapPin className="w-4 h-4 text-slate-400 mb-1" />
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
              Event Venue
            </p>
            <p className="text-[11px] font-bold text-slate-700 mt-0.5">
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
          <Download className="w-5 h-5 mr-2" /> Download Image Pass (PNG)
        </Button>
        <Button onClick={onReset} variant="outline" className="w-full border-slate-300 text-slate-600 font-medium py-6 rounded-xl hover:bg-slate-50 transition-all">
          Register Another Person
        </Button>
      </div>
    </div>
  );
}