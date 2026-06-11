import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Sparkles } from "lucide-react";
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
      <div
        className="relative overflow-hidden rounded-3xl p-8 md:p-12"
        style={{
          background: "linear-gradient(135deg, hsl(343 73% 26%) 0%, hsl(343 73% 36%) 50%, hsl(35 100% 42%) 100%)",
        }}
      >
        {/* Decorative blobs */}
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-20 blur-3xl bg-yellow-300" />
        <div className="absolute -left-8 -bottom-8 h-40 w-40 rounded-full opacity-15 blur-2xl bg-white" />

        <div className="relative grid md:grid-cols-2 gap-8 items-center">
          {/* Left: text */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/25 text-sm font-semibold text-white mb-4">
              <Sparkles className="h-4 w-4 text-yellow-300" />
              Newsletter
            </div>
            <h3 className="text-2xl md:text-3xl font-extrabold text-white mb-2 leading-tight">
              Get exclusive deals &<br />flash sale alerts
            </h3>
            <p className="text-white/75 text-sm">
              Join 10,000+ Sri Lankan shoppers. No spam — only the good stuff.
            </p>
          </div>

          {/* Right: form */}
          <form onSubmit={submit} className="flex gap-2 max-w-md md:ml-auto w-full">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.lk"
                className="w-full h-11 pl-10 pr-4 rounded-full bg-white/15 border border-white/25 text-white placeholder:text-white/50 text-sm outline-none focus:bg-white/20 focus:border-white/40 transition-all"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 px-6 rounded-full font-bold shrink-0"
              style={{ background: "hsl(49 100% 50%)", color: "hsl(343 73% 22%)" }}
            >
              {submitting ? "..." : "Subscribe"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};
