"use client";

import { useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  CheckCircle2,
  XCircle,
  QrCode,
  Keyboard,
  User,
  Briefcase,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// The shape of the data we expect from the SuccessPass QR code
interface ParsedQRData {
  attendeeId: string;
  fullName?: string;
  attendeeType?: string;
  organization?: string;
  category?: string;
}

export default function CheckInPage() {
  const [activeTab, setActiveTab] = useState<"SCAN" | "MANUAL">("SCAN");
  const [manualId, setManualId] = useState("");

  const [scannedUser, setScannedUser] = useState<ParsedQRData | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Status: null (waiting), 'success', or 'error'
  const [apiStatus, setApiStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  // Handle successful QR scan
  const handleScan = (text: string) => {
    try {
      // Try to parse the JSON embedded in the QR Code
      const data: ParsedQRData = JSON.parse(text);
      if (data.attendeeId) {
        setScannedUser(data);
      } else {
        setApiStatus({ type: "error", message: "Invalid QR format. No Attendee ID found." });
      }
    } catch (e) {
      // Fallback: If it's just a raw text ID (e.g. TDE26-G-XXXXXX) instead of JSON
      if (text.startsWith("TDE26-")) {
        setScannedUser({ attendeeId: text, fullName: "Unknown (Legacy QR)" });
      } else {
        setApiStatus({ type: "error", message: "Unrecognized QR Code." });
      }
    }
  };

  // Handle Manual Entry Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId || manualId.trim() === "") return;

    // For manual, we don't have the Name/Type natively, so we just set the ID.
    // The backend Check-In API will still verify and return the actual name.
    setScannedUser({ attendeeId: manualId.trim().toUpperCase() });
  };

  // Call the API to mark them as Checked In
  const processCheckIn = async () => {
    if (!scannedUser?.attendeeId) return;

    setIsCheckingIn(true);
    setApiStatus(null);

    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendee_id: scannedUser.attendeeId }),
      });

      const result = await res.json();

      if (res.ok) {
        setApiStatus({ type: "success", message: result.message });
      } else {
        setApiStatus({ type: "error", message: result.message });
      }
    } catch (error) {
      setApiStatus({ type: "error", message: "Network error. Please check your connection." });
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Reset the screen for the next person
  const resetScanner = () => {
    setScannedUser(null);
    setApiStatus(null);
    setManualId("");
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 flex flex-col items-center">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Event Check-In</h1>
          <p className="text-slate-500 font-medium mt-2">Scan pass or enter ID to grant entry.</p>
        </div>

        {/* STEP 1: Scanning / Input Mode (Hidden if a user is currently scanned) */}
        {!scannedUser && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-slate-100">
              <button
                onClick={() => setActiveTab("SCAN")}
                className={`flex-1 py-4 font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
                  activeTab === "SCAN"
                    ? "text-blue-600 bg-blue-50/50 border-b-2 border-blue-600"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <QrCode className="w-4 h-4" /> Scan QR
              </button>
              <button
                onClick={() => setActiveTab("MANUAL")}
                className={`flex-1 py-4 font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
                  activeTab === "MANUAL"
                    ? "text-blue-600 bg-blue-50/50 border-b-2 border-blue-600"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Keyboard className="w-4 h-4" /> Manual Entry
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {activeTab === "SCAN" ? (
                <div className="space-y-4">
                  <div className="aspect-square rounded-2xl overflow-hidden bg-black relative border-4 border-slate-100 shadow-inner">
                    <Scanner
                      onScan={(detectedCodes) => {
                        if (detectedCodes.length > 0) {
                          handleScan(detectedCodes[0].rawValue);
                        }
                      }}
                    />
                    {/* Scanner Overlay UI */}
                    <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none z-10" />
                  </div>
                  <p className="text-center text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    Position QR inside the frame
                  </p>
                </div>
              ) : (
                <form onSubmit={handleManualSubmit} className="space-y-4 py-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Attendee ID
                    </label>
                    <Input
                      placeholder="e.g. TDE26-G-ABCDEF"
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      className="h-14 text-center text-lg tracking-widest font-mono uppercase bg-slate-50"
                      autoFocus
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#0B1B2B] hover:bg-[#15304B] text-white"
                  >
                    Search ID
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Global Errors (e.g. Bad QR code parsed before API hit) */}
        {!scannedUser && apiStatus?.type === "error" && (
          <div className="mt-4 bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100">
            <XCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold">{apiStatus.message}</span>
          </div>
        )}

        {/* STEP 2: Scanned User Details & Check-In Action */}
        {scannedUser && (
          <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
            {/* User Info Card */}
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                    {scannedUser.attendeeType || "Attendee"}
                  </p>
                  <h3 className="text-xl font-bold text-slate-900 line-clamp-1">
                    {scannedUser.fullName || "ID Search"}
                  </h3>
                </div>
              </div>

              <div className="mt-4 space-y-2 bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Pass ID</span>
                  <span className="font-mono font-bold text-slate-800">
                    {scannedUser.attendeeId}
                  </span>
                </div>
                {scannedUser.organization && scannedUser.organization !== "N/A" && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Company</span>
                    <span className="font-semibold text-slate-800 line-clamp-1 max-w-[150px] text-right">
                      {scannedUser.organization}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions & Status */}
            <div className="p-6">
              {apiStatus ? (
                // Show Result of Check-In API
                <div className="space-y-6">
                  <div
                    className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 text-center ${
                      apiStatus.type === "success"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}
                  >
                    {apiStatus.type === "success" ? (
                      <CheckCircle2 className="w-12 h-12 mb-3 text-emerald-500" />
                    ) : (
                      <XCircle className="w-12 h-12 mb-3 text-red-500" />
                    )}
                    <h4 className="text-lg font-bold mb-1">
                      {apiStatus.type === "success" ? "Access Granted" : "Access Denied"}
                    </h4>
                    <p className="text-sm font-medium opacity-90">{apiStatus.message}</p>
                  </div>

                  <Button
                    onClick={resetScanner}
                    variant="outline"
                    className="w-full h-14 border-slate-300 font-bold text-slate-700 hover:bg-slate-100 rounded-xl"
                  >
                    <RefreshCcw className="w-4 h-4 mr-2" /> Scan Next Attendee
                  </Button>
                </div>
              ) : (
                // Show Confirmation Button
                <div className="space-y-4">
                  <Button
                    onClick={processCheckIn}
                    disabled={isCheckingIn}
                    className="w-full h-14 text-lg font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-transform hover:scale-[1.02]"
                  >
                    {isCheckingIn ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verifying...
                      </>
                    ) : (
                      "Confirm Check-In"
                    )}
                  </Button>
                  <Button
                    onClick={resetScanner}
                    variant="ghost"
                    className="w-full text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
