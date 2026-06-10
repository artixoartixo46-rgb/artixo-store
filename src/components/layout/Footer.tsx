import { Link } from "react-router-dom";
import artixoLogo from "@/assets/artixo-logo.png";

export const Footer = () => (
  <footer className="border-t border-white/20 mt-20 glass-secondary text-secondary-foreground">
    <div className="container py-12 grid gap-8 md:grid-cols-4">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="font-display font-bold text-xl">ARTI<span className="text-primary">XO</span></span>
        </div>
        <p className="text-sm opacity-80">Sri Lanka's trusted multi-vendor marketplace. Island-wide delivery.</p>
      </div>
      <div>
        <h4 className="font-semibold mb-3">Customer Care</h4>
        <ul className="space-y-2 text-sm opacity-80">
          <li><Link to="/help" className="hover:text-primary transition-smooth">Help Center</Link></li>
          <li><Link to="/orders" className="hover:text-primary transition-smooth">Track Order</Link></li>
          <li><Link to="/refund-policy" className="hover:text-primary transition-smooth">Refund Policy</Link></li>
          <li><Link to="/privacy" className="hover:text-primary transition-smooth">Privacy Policy</Link></li>
        </ul>
      </div>
      <div>
        <h4 className="font-semibold mb-3">Sell on ARTIXO</h4>
        <ul className="space-y-2 text-sm opacity-80">
          <li><Link to="/become-seller" className="hover:text-primary transition-smooth">Become a Seller</Link></li>
          <li><Link to="/seller" className="hover:text-primary transition-smooth">Seller Center</Link></li>
        </ul>
      </div>
      <div>
        <h4 className="font-semibold mb-3">Payment Methods</h4>
        <ul className="space-y-2 text-sm opacity-80">
          <li>💵 Cash on Delivery</li>
          <li>🏦 Bank Transfer</li>
          <li className="text-xs italic opacity-60">PayHere coming soon</li>
        </ul>
      </div>
    </div>
    <div className="border-t border-secondary-foreground/10 py-4">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-3 text-xs opacity-80">
        <p>© {new Date().getFullYear()} ARTIXO — Made with ❤️ in Sri Lanka. All prices in LKR (Rs.).</p>
        <a
          href="https://artixo.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 hover:opacity-100 transition-smooth"
        >
          <span>Designed & Developed by</span>
          <img src={artixoLogo} alt="Artixo" className="h-6 w-auto" />
        </a>
      </div>
    </div>
  </footer>
);
