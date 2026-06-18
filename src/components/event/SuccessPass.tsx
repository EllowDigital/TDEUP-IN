"use client";

import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import Image from "next/image";
import { toPng } from "html-to-image";
import { Download, User, MapPin, CheckCircle2, Loader2 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { FormValues } from "@/lib/schema";
import { Cinzel } from "next/font/google";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

// Browsers/canvas APIs render at an implicit baseline of 96 CSS px per inch.
// To export at a true 300 DPI we scale the capture by 300/96 and then embed
// the same value into the PNG's physical-dimension (pHYs) chunk, so the
// pixel density we render at matches what the file claims when opened in
// any image/print tool.
const TARGET_DPI = 300;
const BASE_CSS_DPI = 96;
const EXPORT_PIXEL_RATIO = TARGET_DPI / BASE_CSS_DPI;

// ---- PNG 300 DPI metadata embedding -------------------------------------
// Canvas-generated PNGs carry no resolution metadata, so most print/export
// pipelines fall back to 72 or 96 DPI and the card prints at the wrong
// physical size. We inject a pHYs chunk (the PNG spec's resolution field)
// right after IHDR, which always sits at a fixed offset.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000; // avoid call-stack limits on String.fromCharCode spread
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Returns a new PNG data URL with a pHYs chunk declaring `dpi` resolution. */
function embedPngDpi(dataUrl: string, dpi: number): string {
  const base64 = dataUrl.split(",")[1];
  if (!base64) return dataUrl;

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  // 8-byte signature + IHDR chunk (4 length + 4 "IHDR" + 13 data + 4 crc)
  const IHDR_END = 8 + 25;
  const pixelsPerMeter = Math.round(dpi / 0.0254);

  const typeBytes = new Uint8Array([0x70, 0x48, 0x59, 0x73]); // "pHYs"
  const physData = new Uint8Array(9);
  const physView = new DataView(physData.buffer);
  physView.setUint32(0, pixelsPerMeter, false); // X pixels per unit
  physView.setUint32(4, pixelsPerMeter, false); // Y pixels per unit
  physData[8] = 1; // unit specifier: 1 = meters

  const crcInput = new Uint8Array(typeBytes.length + physData.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(physData, typeBytes.length);
  const crc = crc32(crcInput);

  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const chunkView = new DataView(chunk.buffer);
  chunkView.setUint32(0, 9, false); // chunk data length
  chunk.set(typeBytes, 4);
  chunk.set(physData, 8);
  chunkView.setUint32(17, crc, false);

  const result = new Uint8Array(bytes.length + chunk.length);
  result.set(bytes.subarray(0, IHDR_END), 0);
  result.set(chunk, IHDR_END);
  result.set(bytes.subarray(IHDR_END), IHDR_END + chunk.length);

  return `data:image/png;base64,${bytesToBase64(result)}`;
}

/** Resolves once every <img> inside the container has finished loading. */
function waitForImagesToLoad(container: HTMLElement): Promise<void[]> {
  const imgs = Array.from(container.querySelectorAll("img"));
  return Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    })
  );
}

interface SuccessPassProps {
  attendeeData: FormValues;
  attendeeId: string;
  onReset: () => void;
}

export function SuccessPass({ attendeeData, attendeeId, onReset }: SuccessPassProps) {
  const passRef = useRef<HTMLDivElement>(null);
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const file = attendeeData.photo;
  const photoUrl =
    typeof file === "string" && file.length > 0 ? file : file == null ? null : localPhotoUrl;

  useEffect(() => {
    if (file instanceof File) {
      const reader = new FileReader();
      reader.onloadend = () => setLocalPhotoUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, [file]);

  const downloadPass = useCallback(async () => {
    if (!passRef.current || isExporting) return;

    setIsExporting(true);
    try {
      await document.fonts.ready;
      await waitForImagesToLoad(passRef.current);
      // Let layout settle for a couple of frames after fonts/images resolve.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );

      const rawDataUrl = await toPng(passRef.current, {
        cacheBust: true,
        pixelRatio: EXPORT_PIXEL_RATIO,
        backgroundColor: "#ffffff",
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          margin: "0",
        },
      });

      const dataUrl = embedPngDpi(rawDataUrl, TARGET_DPI);

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${attendeeId}-EPass.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download pass:", error);
      alert("Failed to save the E-Pass. Please check your network and try again.");
    } finally {
      setIsExporting(false);
    }
  }, [attendeeId, isExporting]);

  const theme = useMemo(() => {
    switch (attendeeData.attendeeType) {
      case "BUSINESS":
        return { bg: "bg-[#F5B415]", text: "text-[#D97706]", label: "BUSINESS PASS" };
      case "EXHIBITOR":
        return { bg: "bg-[#006a47]", text: "text-[#00593d]", label: "EXHIBITOR PASS" };
      case "MEDIA":
        return { bg: "bg-[#ff0000]", text: "text-[#CC0000]", label: "MEDIA PASS" };
      case "GENERAL":
        return { bg: "bg-[#0062ff]", text: "text-[#0051ff]", label: "GENERAL PASS" };
      default:
        return { bg: "bg-[#F5B415]", text: "text-[#D97706]", label: "ATTENDEE PASS" };
    }
  }, [attendeeData.attendeeType]);

  const displayDays = useMemo(
    () => (attendeeData.attendance.length === 3 ? "All Days" : attendeeData.attendance.join(", ")),
    [attendeeData.attendance]
  );

  const showOrgDetails = useMemo(
    () => ["BUSINESS", "EXHIBITOR", "MEDIA"].includes(attendeeData.attendeeType),
    [attendeeData.attendeeType]
  );

  const qrPayload = useMemo(() => {
    const qrData: Record<string, string> = {
      attendeeId,
      fullName: attendeeData.fullName,
      attendeeType: attendeeData.attendeeType,
    };

    if (showOrgDetails) {
      qrData.organization = attendeeData.businessName || "N/A";
      qrData.category =
        attendeeData.attendeeType === "MEDIA"
          ? "Media/Press"
          : attendeeData.businessCategory === "OTHER"
            ? attendeeData.otherCategory || "N/A"
            : attendeeData.businessCategory || "N/A";
    }

    return JSON.stringify(qrData);
  }, [
    attendeeId,
    attendeeData.fullName,
    attendeeData.attendeeType,
    attendeeData.businessName,
    attendeeData.businessCategory,
    attendeeData.otherCategory,
    showOrgDetails,
  ]);

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-5 animate-in fade-in zoom-in duration-500 overflow-x-auto px-4 w-full py-6">
      {/* Success banner */}
      <div className="flex flex-col items-center shrink-0 w-[350px]">
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl w-full text-center shadow-sm flex flex-col items-center justify-center space-y-1">
          <div className="flex items-center space-x-1.5 justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-[15px]">Registration Successful!</span>
          </div>
          <p className="text-[13px] font-medium text-emerald-700/80 leading-tight">
            Please download your E-Pass below and keep it safe for entry.
          </p>
        </div>
      </div>

      {/* THE E-PASS CONTAINER */}
      <div
        ref={passRef}
        className="overflow-hidden flex flex-col relative border-2 border-slate-200 shadow-sm"
        style={{
          width: "400px",
          height: "650px",
          minWidth: "400px",
          maxWidth: "400px",
          minHeight: "650px",
          maxHeight: "650px",
          borderRadius: "16px",
          backgroundColor: "#ffffff",
          color: "#000000",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Header Strip */}
        <div className="h-[120px] bg-[#0B1B2B] flex flex-col items-center justify-center px-4 relative shrink-0">
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

        {/* Overlapping Profile Picture */}
        <div className="absolute top-[95px] left-1/2 -translate-x-1/2 z-10">
          <div className="w-[90px] h-[90px] bg-[#EEF2F6] rounded-full border-[4px] border-white flex items-center justify-center overflow-hidden shadow-sm shrink-0">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt="Attendee"
                width={90}
                height={90}
                crossOrigin="anonymous"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="text-[#8B9DB1] w-10 h-10 mt-1" strokeWidth={1.5} />
            )}
          </div>
        </div>

        {/* Main Body Area */}
        <div className="px-6 pt-[72px] pb-5 flex flex-col w-full flex-1">
          {/* Identity & Status Section */}
          <div className="text-center w-full min-h-[95px] flex flex-col justify-center">
            <h3 className="font-serif font-bold text-[24px] text-[#000000] uppercase tracking-wide line-clamp-1">
              {attendeeData.fullName}
            </h3>
            <p className={`mt-1 text-[11px] font-bold tracking-[0.2em] uppercase ${theme.text}`}>
              {theme.label}
            </p>
            {showOrgDetails && (
              <p className="mt-1 text-[13px] text-slate-600 font-semibold uppercase line-clamp-1">
                {attendeeData.businessName}
              </p>
            )}
          </div>

          {/* Core Info Grid: QR Code (Left) & Access Info (Right) */}
          <div className="flex flex-row w-full mt-3 items-center border-y border-slate-100 py-4 min-h-[185px]">
            {/* Left Column: Fast-Scan QR Code */}
            <div className="w-[45%] flex flex-col items-center justify-center border-r border-slate-200 pr-3">
              <div className="p-3 bg-white border-2 border-slate-200 rounded-xl shrink-0">
                <QRCodeCanvas
                  value={qrPayload}
                  size={440}
                  level="H"
                  includeMargin={true}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  style={{ width: "110px", height: "110px" }}
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
                <p className="text-[17px] font-bold text-slate-800 font-mono">{attendeeId}</p>
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
          <div className="mt-auto pt-6 border-t border-slate-100 flex flex-col items-center text-center px-4 w-full">
            <MapPin className="w-4 h-4 text-slate-400 mb-1" />
            <p className="text-[12px] text-slate-400 font-bold uppercase tracking-widest">
              Event Venue
            </p>
            <p className="text-[16px] font-bold text-slate-900 mt-1 leading-snug">
              Sanskar Lawn, Kidwai Nagar, Kanpur
            </p>
          </div>
        </div>

        {/* Dynamic Footer Theme Strip */}
        <div className={`h-[16px] w-full mt-auto shrink-0 ${theme.bg}`}></div>
      </div>

      {/* External Controls */}
      <div className="flex flex-col gap-3 w-[400px] shrink-0">
        <Button
          onClick={downloadPass}
          disabled={isExporting}
          aria-busy={isExporting}
          className="w-full bg-[#0B1B2B] hover:bg-[#15304B] py-6 text-[15px] font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Preparing E-Pass...
            </>
          ) : (
            <>
              <Download className="w-5 h-5 mr-2" /> Download E-Pass
            </>
          )}
        </Button>
        <Button
          onClick={onReset}
          variant="outline"
          disabled={isExporting}
          className="w-full border-slate-400 text-slate-900 font-medium py-6 rounded-xl hover:bg-slate-50 transition-all"
        >
          Register Another Person
        </Button>
      </div>
    </div>
  );
}
