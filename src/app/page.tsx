"use client";

import { useState } from "react";
import { LeftPanel } from "@/components/event/LeftPanel";
import { RegForm } from "@/components/event/RegForm";
import { SuccessPass } from "@/components/event/SuccessPass";
import type { FormValues } from "@/lib/schema";

export default function Home() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [attendeeData, setAttendeeData] = useState<FormValues | null>(null);
  const [attendeeId, setAttendeeId] = useState("");

  const handleRegistrationSuccess = (data: FormValues, generatedAttendeeId: string) => {
    setAttendeeData(data);
    setAttendeeId(generatedAttendeeId);
    setIsRegistered(true);
  };

  const handleReset = () => {
    setIsRegistered(false);
    setAttendeeData(null);
    setAttendeeId("");
  };

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 lg:block">
      {/* LEFT PANEL - PINNED TO SCREEN ON DESKTOP */}
      <aside className="w-full bg-[#0B1B2B] lg:fixed lg:inset-y-0 lg:left-0 lg:w-[40%] xl:w-[35%] lg:overflow-y-auto">
        <LeftPanel />
      </aside>

      {/* RIGHT PANEL - NORMAL NATIVE BROWSER SCROLL */}
      <section className="w-full flex-1 lg:ml-[40%] lg:w-[60%] xl:ml-[35%] xl:w-[65%]">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {!isRegistered || !attendeeData ? (
            <RegForm onSuccess={handleRegistrationSuccess} />
          ) : (
            <SuccessPass
              attendeeData={attendeeData}
              attendeeId={attendeeId}
              onReset={handleReset}
            />
          )}
        </div>
      </section>
    </main>
  );
}
