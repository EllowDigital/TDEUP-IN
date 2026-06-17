import { Calendar, MapPin, Phone } from "lucide-react";
import Image from "next/image";

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
              width={220}
              height={60}
              priority
              className="mb-4 md:mb-6 object-contain md:w-[300px]"
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

        <div className="w-full h-px bg-slate-700 mb-6 md:mb-8"></div>

        {/* Details Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:space-y-6 md:gap-0 text-left">
          <div className="flex items-start gap-3 md:gap-4">
            <Calendar className="text-amber-400 w-5 h-5 md:w-6 md:h-6 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-sm md:text-lg">Dates</h3>
              <p className="text-blue-200 text-xs md:text-base">30 Aug, 31 Aug & 1 Sep, 2026</p>
            </div>
          </div>

          <div className="flex items-start gap-3 md:gap-4">
            <MapPin className="text-amber-400 w-5 h-5 md:w-6 md:h-6 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-sm md:text-lg">Venue</h3>
              <p className="text-blue-200 text-xs md:text-base">
                Sanskar Lawn, <span className="md:hidden">Kidwai Nagar, Kanpur</span>
                <br className="hidden md:block" />
                <span className="hidden md:inline">Kidwai Nagar, Kanpur</span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 md:gap-4 sm:col-span-2 lg:col-span-1">
            <Phone className="text-amber-400 w-5 h-5 md:w-6 md:h-6 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-sm md:text-lg">Enquiries</h3>
              <p className="text-blue-200 text-xs md:text-base">
                7905881922 <span className="md:hidden">|</span>
                <br className="hidden md:block" />
                <span className="md:hidden"> </span>9953903330
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
