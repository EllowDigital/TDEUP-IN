import { Calendar, MapPin, Phone } from "lucide-react";
import Image from "next/image";

export function LeftPanel() {
  return (
    <div className="w-full lg:w-[40%] bg-[#0B1B2B] text-white p-8 md:p-12 flex flex-col justify-between">
      <div>
        <div className="mb-8">
        <Image
            src="/logo-banner.jpeg"
            alt="Tent Decor Expo"
            width={300}
            height={80}
            priority
            className="mb-6 object-contain"
          />
          <h1 className="text-4xl md:text-5xl font-serif font-bold leading-tight mb-4 text-white">
            TENT DECOR EXPO UP <br /> 2026
          </h1>
          <p className="text-blue-100 text-sm md:text-base leading-relaxed">
            Join industry leaders and innovators at the premier expo for tents, decorators, caterers, and event management.
          </p>
        </div>

        <div className="w-full h-px bg-slate-700 mb-8"></div>

        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <Calendar className="text-amber-400 w-6 h-6 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg">Dates</h3>
              <p className="text-blue-200">30 Aug, 31 Aug & 1 Sep, 2026</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <MapPin className="text-amber-400 w-6 h-6 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg">Venue</h3>
              <p className="text-blue-200">Sanskar Lawn,<br />Kidwai Nagar, Kanpur</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Phone className="text-amber-400 w-6 h-6 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg">Enquiries</h3>
              <p className="text-blue-200">7905881922<br />9953903330</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}