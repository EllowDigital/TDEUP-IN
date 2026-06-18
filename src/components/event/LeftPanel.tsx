import { Calendar, MapPin, Phone, type LucideIcon } from "lucide-react";
import Image from "next/image";

// Single source of truth for the event details shown in this panel —
// keeps copy out of JSX and makes future date/venue/phone updates a
// one-line change instead of a markup hunt.
const EVENT_DETAILS = {
  dates: "30 Aug, 31 Aug & 1 Sep, 2026",
  venueName: "Sanskar Lawn",
  venueAddress: "Kidwai Nagar, Kanpur",
  phones: [
    { display: "7905881922", href: "tel:+917905881922" },
    { display: "9953903330", href: "tel:+919953903330" },
  ],
} as const;

const VENUE_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${EVENT_DETAILS.venueName}, ${EVENT_DETAILS.venueAddress}`
)}`;

interface InfoItemProps {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}

// Shared layout for each icon + label + value row, so the three details
// below stay visually and structurally consistent without repeating the
// same wrapper markup three times.
function InfoItem({ icon: Icon, title, children, className = "" }: InfoItemProps) {
  return (
    <div className={`flex items-start gap-3 md:gap-4 ${className}`}>
      <Icon className="text-amber-400 w-5 h-5 md:w-6 md:h-6 mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        <h2 className="font-bold text-sm md:text-lg">{title}</h2>
        <div className="text-blue-200 text-xs md:text-base leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function LeftPanel() {
  return (
    <div className="w-full lg:w-[40%] bg-[#0B1B2B] text-white p-6 md:p-12 flex flex-col justify-center lg:h-screen lg:overflow-hidden shrink-0">
      <div className="w-full max-w-md mx-auto">
        {/* Branding Section */}
        <div className="mb-6 md:mb-8 text-center md:text-left">
          <div className="flex justify-center md:justify-start">
            <Image
              src="/logo-banner.png"
              alt="Tent Decor Expo"
              width={300}
              height={82}
              priority
              sizes="(min-width: 768px) 300px, 220px"
              className="mb-4 md:mb-6 w-[220px] md:w-[300px] h-auto object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-serif font-bold leading-tight mb-2 md:mb-4 text-white">
            TENT DECOR EXPO UP <br className="hidden md:block" /> 2026
          </h1>
          <p className="text-blue-100 text-xs sm:text-sm md:text-base leading-relaxed max-w-sm mx-auto md:mx-0">
            Join industry leaders and innovators at the premier expo for tents, decorators,
            caterers, and event management.
          </p>
        </div>

        <div className="w-full h-px bg-slate-700 mb-6 md:mb-8" />

        {/* Details Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:space-y-6 md:gap-0 text-left">
          <InfoItem icon={Calendar} title="Dates">
            <p>{EVENT_DETAILS.dates}</p>
          </InfoItem>

          <InfoItem icon={MapPin} title="Venue">
            <p>
              <a
                href={VENUE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                {EVENT_DETAILS.venueName},
                <span className="md:hidden"> </span>
                <br className="hidden md:block" />
                {EVENT_DETAILS.venueAddress}
              </a>
            </p>
          </InfoItem>

          <InfoItem icon={Phone} title="Enquiries" className="sm:col-span-2 lg:col-span-1">
            <p>
              <a
                href={EVENT_DETAILS.phones[0].href}
                className="hover:text-white transition-colors"
              >
                {EVENT_DETAILS.phones[0].display}
              </a>
              <span className="md:hidden"> | </span>
              <br className="hidden md:block" />
              <a
                href={EVENT_DETAILS.phones[1].href}
                className="hover:text-white transition-colors"
              >
                {EVENT_DETAILS.phones[1].display}
              </a>
            </p>
          </InfoItem>
        </div>
      </div>
    </div>
  );
}