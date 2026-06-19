import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BadgeCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ── Hook ─────────────────────────────────────────────────────────────────────
export const useSellerVerified = (sellerId: string | null | undefined) => {
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!sellerId) return;
    (supabase as any)
      .from("profiles")
      .select("is_verified")
      .eq("id", sellerId)
      .single()
      .then(({ data, error }: any) => {
        if (!error && data?.is_verified) setVerified(true);
      });
  }, [sellerId]);

  return verified;
};

// ── Badge ─────────────────────────────────────────────────────────────────────
interface Props {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const VerifiedBadge = ({ size = "md", className = "" }: Props) => {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-6 w-6" : "h-4 w-4";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center ${className}`}>
            <BadgeCheck className={`${iconSize} text-blue-500 fill-blue-500`} strokeWidth={1.5} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Verified Seller
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
