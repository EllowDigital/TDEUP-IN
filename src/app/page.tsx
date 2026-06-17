"use client";

import { useState } from "react";
import { FormValues } from "@/lib/schema";
import { LeftPanel } from "@/components/event/LeftPanel";
import { RegForm } from "@/components/event/RegForm";
import { SuccessPass } from "@/components/event/SuccessPass";

export default function Home() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [attendeeData, setAttendeeData] = useState<FormValues | null>(null);
  // Renamed from mockId to attendeeId for clarity
  const [attendeeId, setAttendeeId] = useState("");

  // CRITICAL FIX: The function now expects BOTH the data and the real ID from RegForm
  const handleRegistrationSuccess = (data: FormValues, newId: string) => {
    setAttendeeData(data);
    setAttendeeId(newId); // Save the real ID (e.g., TDE26-G-4587) from the backend
    setIsRegistered(true);
  };

  const resetForm = () => {
    setIsRegistered(false);
    setAttendeeData(null);
    setAttendeeId("");
  };

  return (
    <div className="min-h-screen bg-slate-100 md:p-6 lg:p-8 flex items-center justify-center">
      <div className="w-full max-w-6xl bg-white shadow-2xl md:rounded-2xl flex flex-col lg:flex-row overflow-hidden min-h-[90vh]">
        
        {/* Left Branding Panel */}
        <LeftPanel />

        {/* Right Dynamic Content Area */}
        <div className="w-full lg:w-[60%] p-6 md:p-12 overflow-y-auto max-h-[100vh] lg:max-h-[90vh]">
          {!isRegistered || !attendeeData ? (
            <RegForm onSuccess={handleRegistrationSuccess} />
          ) : (
            <SuccessPass 
              attendeeData={attendeeData} 
              attendeeId={attendeeId} // Pass the real ID to the E-Pass
              onReset={resetForm} 
            />
          )}
        </div>
        
      </div>
    </div>
  );
}