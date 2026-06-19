import { Check, Clock, PackageCheck, PackageOpen, Truck, Home, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";

const STEPS: { key: OrderStatus; label: string; icon: typeof Clock; est: string }[] = [
  { key: "pending",    label: "Pending",    icon: Clock,         est: "5–7 business days" },
  { key: "confirmed",  label: "Confirmed",  icon: PackageCheck,  est: "4–6 business days" },
  { key: "processing", label: "Processing", icon: PackageOpen,   est: "3–5 business days" },
  { key: "shipped",    label: "Shipped",    icon: Truck,         est: "1–3 business days" },
  { key: "delivered",  label: "Delivered",  icon: Home,          est: "" },
];

export const OrderStatusTimeline = ({ status }: { status: OrderStatus }) => {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
        <div className="h-10 w-10 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shrink-0">
          <XCircle className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold text-destructive">Order Cancelled</div>
          <div className="text-xs text-muted-foreground">This order has been cancelled.</div>
        </div>
      </div>
    );
  }

  const currentIdx = STEPS.findIndex((s) => s.key === status);
  const safeIdx = currentIdx === -1 ? 0 : currentIdx;
  const currentStep = STEPS[safeIdx];

  return (
    <div className="py-3">
      {/* Desktop: horizontal */}
      <div className="hidden sm:flex items-center justify-between relative mb-3">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isDone = idx < safeIdx;
          const isCurrent = idx === safeIdx;
          const isActive = isDone || isCurrent;

          return (
            <div key={step.key} className="flex flex-col items-center flex-1 relative z-10">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border",
                  isCurrent && "ring-4 ring-primary/20 animate-pulse"
                )}
              >
                {isDone ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className={cn("text-xs mt-2 font-medium text-center", isActive ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    "absolute top-5 left-1/2 w-full h-0.5 -z-10 transition-all duration-500",
                    idx < safeIdx ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical */}
      <div className="sm:hidden space-y-2 mb-3">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isDone = idx < safeIdx;
          const isCurrent = idx === safeIdx;
          const isActive = isDone || isCurrent;
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border",
                  isCurrent && "ring-4 ring-primary/20"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className={cn("text-sm font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
                {isCurrent && <span className="ml-2 text-xs text-primary font-normal">(current)</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Estimated delivery */}
      {status !== "delivered" && currentStep.est && (
        <div className="text-xs text-muted-foreground text-center sm:text-left flex items-center gap-1">
          <span>📅</span>
          <span>Estimated delivery: <span className="font-medium text-foreground">{currentStep.est}</span></span>
        </div>
      )}
      {status === "delivered" && (
        <div className="text-xs text-green-600 text-center sm:text-left flex items-center gap-1">
          <Check className="h-3 w-3" />
          <span className="font-medium">Your order has been delivered!</span>
        </div>
      )}
    </div>
  );
};
