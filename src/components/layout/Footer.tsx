import { Link } from "react-router-dom";
import artixoLogo from "@/assets/artixo-logo.png";
import { MapPin, Mail, Phone } from "lucide-react";

export const Footer = () => (
  <footer className="mt-20 relative overflow-hidden" style={{
    background: "linear-gradient(135deg, hsl(343 73% 22%) 0%, hsl(343 73% 30%) 40%, hsl(35 100% 45%) 100%)"
  }}>
    {/* Decorative blobs */}
    <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl"
         style={{ background: "hsl(49 100% 50%)", transform: "translate(30%, -30%)" }} />
    <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl"
         style={{ background: "hsl(343 73% 50%)", transform: "translate(-30%, 30%)" }} />

    {/* Main grid */}
    <div className="relative container py-14 grid gap-10 md:grid-cols-4">
      {/* Brand */}
      <div className="md:col-span-1">
        <div className="flex items-center gap-3 mb-4">
          <img src={artixoLogo} alt="Artixo" className="h-12 w-12 object-contain drop-shadow-lg" />
          <span className="font-bold text-2xl text-white tracking-tight">
            ARTI<span className="text-yellow-300">XO</span>
          </span>
        </div>
        <p className="text-sm text-white/75 leading-relaxed mb-5">
          Sri Lanka's trusted multi-vendor marketplace. Island-wide delivery from Colombo to Jaffna.
        </p>
        <div className="space-y-2 text-sm text-white/65">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-yellow-300" />
            <span>Colombo, Sri Lanka 🇱🇰</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 shrink-0 text-yellow-300" />
            <span>support@artixo.lk</span>
          </div>
        </div>
      </div>

      {/* Customer Care */}
      <div>
        <h4 className="font-bold text-white mb-4 text-base tracking-wide uppercase text-xs text-yellow-300">
          Customer Care
        </h4>
        <ul className="space-y-2.5 text-sm">
          {[
            { to: "/help", label: "Help Center" },
            { to: "/orders", label: "Track Order" },
            { to: "/refund-policy", label: "Refund Policy" },
            { to: "/privacy", label: "Privacy Policy" },
          ].map(({ to, label }) => (
            <li key={label}>
              <Link
                to={to}
                className="text-white/70 hover:text-yellow-300 transition-all duration-200 hover:translate-x-1 inline-block"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Sell */}
      <div>
        <h4 className="font-bold mb-4 text-xs text-yellow-300 uppercase tracking-wide">
          Sell on ARTIXO
        </h4>
        <ul className="space-y-2.5 text-sm">
          {[
            { to: "/become-seller", label: "Become a Seller" },
            { to: "/seller", label: "Seller Center" },
            { to: "/seller-guide", label: "Seller Guide" },
          ].map(({ to, label }) => (
            <li key={label}>
              <Link
                to={to}
                className="text-white/70 hover:text-yellow-300 transition-all duration-200 hover:translate-x-1 inline-block"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Payment */}
      <div>
        <h4 className="font-bold mb-4 text-xs text-yellow-300 uppercase tracking-wide">
          Payment Methods
        </h4>
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 bg-white/10 rounded-xl px-3 py-2.5 backdrop-blur-sm border border-white/15">
            <span className="text-lg">💵</span>
            <div>
              <p className="text-sm font-semibold text-white">Cash on Delivery</p>
              <p className="text-xs text-white/55">Pay when you receive</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-white/10 rounded-xl px-3 py-2.5 backdrop-blur-sm border border-white/15">
            <span className="text-lg">🏦</span>
            <div>
              <p className="text-sm font-semibold text-white">Bank Transfer</p>
              <p className="text-xs text-white/55">All major banks accepted</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10">
            <span className="text-lg opacity-50">💳</span>
            <div>
              <p className="text-sm font-medium text-white/40">PayHere</p>
              <p className="text-xs text-white/30 italic">Coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Bottom bar */}
    <div className="relative border-t border-white/15">
      <div className="container py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/55">
        <p>© {new Date().getFullYear()} ARTIXO — Made with ❤️ in Sri Lanka &nbsp;|&nbsp; All prices in LKR (Rs.)</p>
        <a
          href="https://artixo.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 hover:text-white transition-colors"
        >
          <span>Designed & Developed by</span>
          <img src={artixoLogo} alt="Artixo" className="h-5 w-auto brightness-[5]" />
          <span className="font-semibold text-yellow-300">ARTIXO</span>
        </a>
      </div>
    </div>
  </footer>
);
