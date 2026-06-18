import { Calendar, MapPin, Phone, type LucideIcon } from "lucide-react";
import Image from "next/image";

const EVENT_DETAILS = {
  dates: "30 Aug, 31 Aug & 1 Sep, 2026",
  venueName: "Sanskar Lawn",
  venueAddress: "Kidwai Nagar, Kanpur",
  phones: [
    {
      display: "9953903330",
      href: "tel:+919953903330",
    },
    {
      display: "9415079434",
      href: "tel:+919415079434",
    },
  ],
} as const;

const VENUE_MAPS_URL = `https://maps.google.com/?q=${encodeURIComponent(
  `${EVENT_DETAILS.venueName}, ${EVENT_DETAILS.venueAddress}`
)}`;

interface InfoItemProps {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function InfoItem({ icon: Icon, title, children, className = "" }: InfoItemProps) {
  return (
    <div className={`flex items-start gap-4 ${className}`}>
      <Icon className="mt-1 h-5 w-5 shrink-0 text-amber-400 md:h-6 md:w-6" aria-hidden="true" />
      <div>
        <h3 className="text-sm font-bold text-white md:text-lg">{title}</h3>
        <div className="mt-1 text-xs leading-relaxed text-blue-200 md:text-base">{children}</div>
      </div>
    </div>
  );
}

export function LeftPanel() {
  return (
    <div
      className="
        flex 
        min-h-full 
        w-full 
        flex-col 
        bg-[#0B1B2B] 
        p-6 
        text-white 
        md:p-10 
        lg:p-12
        lg:justify-center
      "
    >
      <div className="mx-auto w-full max-w-md py-4">
        {/* Logo */}
        <div className="mb-8 text-center lg:text-left">
          <div className="flex justify-center lg:justify-start">
            <Image
              src="/logo-banner.png"
              alt="Tent Decor Expo UP 2026"
              width={320}
              height={90}
              priority
              className="mb-5 h-auto w-[220px] object-contain md:w-[280px] lg:w-[320px]"
            />
          </div>

          <h1 className="mb-4 font-serif text-3xl font-bold leading-tight text-white md:text-4xl lg:text-5xl">
            TENT DECOR
            <br />
            EXPO UP 2026
          </h1>

          <p className="mx-auto max-w-sm text-sm leading-relaxed text-blue-100 md:text-base lg:mx-0">
            Join industry leaders, exhibitors, decorators, caterers and event professionals at Uttar
            Pradesh&apos;s premier event industry expo.
          </p>
        </div>

        <div className="mb-8 h-px w-full bg-slate-700" />

        {/* Event Details */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-1">
          <InfoItem icon={Calendar} title="Event Dates">
            <p>{EVENT_DETAILS.dates}</p>
          </InfoItem>

          <InfoItem icon={MapPin} title="Venue">
            <a
              href={VENUE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              {EVENT_DETAILS.venueName}
              <br />
              {EVENT_DETAILS.venueAddress}
            </a>
          </InfoItem>

          <InfoItem icon={Phone} title="Enquiries" className="sm:col-span-2 lg:col-span-1">
            <div className="space-y-1">
              <a
                href={EVENT_DETAILS.phones[0].href}
                className="block transition-colors hover:text-white"
              >
                {EVENT_DETAILS.phones[0].display}
              </a>

              <a
                href={EVENT_DETAILS.phones[1].href}
                className="block transition-colors hover:text-white"
              >
                {EVENT_DETAILS.phones[1].display}
              </a>
            </div>
          </InfoItem>
        </div>
      </div>
    </div>
  );
}
