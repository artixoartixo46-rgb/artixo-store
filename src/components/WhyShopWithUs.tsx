import { Card } from "@/components/ui/card";
import { ShieldCheck, Truck, RotateCcw, Headphones } from "lucide-react";

const items = [
  { icon: ShieldCheck, title: "100% Secure Payment", desc: "SSL-protected checkout & verified sellers" },
  { icon: Truck, title: "Island-wide Fast Delivery", desc: "All 25 districts covered, 2-5 days" },
  { icon: RotateCcw, title: "7-Day Easy Returns", desc: "Hassle-free returns if damaged" },
  { icon: Headphones, title: "24/7 Customer Support", desc: "We're here whenever you need us" },
];

export const WhyShopWithUs = () => (
  <section className="container py-12">
    <div className="text-center mb-8">
      <h2 className="font-display text-2xl md:text-3xl font-bold">Why Shop With Us</h2>
      <p className="text-muted-foreground text-sm mt-1">Sri Lanka's most trusted online marketplace</p>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((b) => (
        <Card key={b.title} className="p-5 text-center hover:shadow-glow hover:-translate-y-1 transition-bounce border-border/60">
          <div className="h-12 w-12 mx-auto rounded-xl gradient-saffron flex items-center justify-center text-primary-foreground mb-3">
            <b.icon className="h-6 w-6" />
          </div>
          <div className="font-display font-bold text-sm md:text-base">{b.title}</div>
          <div className="text-xs text-muted-foreground mt-1">{b.desc}</div>
        </Card>
      ))}
    </div>
  </section>
);
