import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail } from "lucide-react";
import { toast } from "sonner";

export const Newsletter = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    setTimeout(() => {
      toast.success("Subscribed! 🎉 Look out for deals in your inbox.");
      setEmail("");
      setSubmitting(false);
    }, 600);
  };

  return (
    <section className="container py-8">
      <Card className="gradient-royal text-secondary-foreground p-6 md:p-10 border border-white/20 shadow-glass-elevated overflow-hidden relative glass-specular">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative grid md:grid-cols-2 gap-6 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-sm font-medium mb-3">
              <Mail className="h-4 w-4" /> Newsletter
            </div>
            <h3 className="font-display text-2xl md:text-3xl font-bold mb-2">
              Get exclusive deals & flash sale alerts
            </h3>
            <p className="opacity-90 text-sm">
              Join 10,000+ Sri Lankan shoppers. No spam — only the good stuff.
            </p>
          </div>
          <form onSubmit={submit} className="flex gap-2 max-w-md md:ml-auto w-full">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.lk"
              className="input-glass text-foreground border-white/30 h-11"
            />
            <Button type="submit" variant="hero" size="lg" disabled={submitting}>
              {submitting ? "..." : "Subscribe"}
            </Button>
          </form>
        </div>
      </Card>
    </section>
  );
};
