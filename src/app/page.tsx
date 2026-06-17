"use client";

import { useState } from "react";
import { FormValues } from "@/lib/schema";
import { LeftPanel } from "@/components/event/LeftPanel";
import { RegForm } from "@/components/event/RegForm";
import { SuccessPass } from "@/components/event/SuccessPass";

export default function Home() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [attendeeData, setAttendeeData] = useState<FormValues | null>(null);
  const [attendeeId, setAttendeeId] = useState("");

  const handleRegistrationSuccess = (data: FormValues, newId: string) => {
    setAttendeeData(data);
    setAttendeeId(newId);
    setIsRegistered(true);
  };

  const resetForm = () => {
    setIsRegistered(false);
    setAttendeeData(null);
    setAttendeeId("");
  };

  return (
    // Main container locks the screen height on PC
    <main className="flex flex-col lg:flex-row min-h-screen lg:h-screen lg:overflow-hidden bg-slate-50">
      {/* Frozen Left Panel */}
      <LeftPanel />

      {/* Scrollable Right Panel 
        FIXED: Added pb-24 and lg:pb-32 to stop the bottom from cutting off.
        FIXED: Added lg:px-12 for better side breathing room on PC.
      */}
      <div className="w-full lg:w-[60%] lg:h-screen lg:overflow-y-auto pt-8 pb-24 lg:pt-10 lg:pb-32 px-4 sm:px-8 lg:px-12 flex justify-center items-start">
        {/* Form wrapper with max-width so it stays perfectly proportioned */}
        <div className="w-full max-w-3xl">
          {!isRegistered || !attendeeData ? (
            <RegForm onSuccess={handleRegistrationSuccess} />
          ) : (
            <div className="mt-8 lg:mt-16">
              <SuccessPass
                attendeeData={attendeeData}
                attendeeId={attendeeId}
                onReset={resetForm}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
