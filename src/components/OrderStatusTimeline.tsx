import { Check, Clock, PackageCheck, Truck, Home, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

const STEPS: { key: OrderStatus; label: string; icon: typeof Clock }[] = [
  { key: "pending", label: "Pending", icon: Clock },
  { key: "confirmed", label: "Confirmed", icon: PackageCheck },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Home },
];

export const OrderStatusTimeline = ({ status }: { status: OrderStatus }) => {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
        <div className="h-10 w-10 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
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

  return (
    <div className="py-4">
      {/* Desktop: horizontal */}
      <div className="hidden sm:flex items-center justify-between relative">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isActive = isDone || isCurrent;

          return (
            <div key={step.key} className="flex flex-col items-center flex-1 relative z-10">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-smooth",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border",
                  isCurrent && "ring-4 ring-primary/20 animate-pulse"
                )}
              >
                {isDone ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div
                className={cn(
                  "text-xs mt-2 font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    "absolute top-5 left-1/2 w-full h-0.5 -z-10",
                    idx < currentIdx ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical */}
      <div className="sm:hidden space-y-3">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isActive = isDone || isCurrent;
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center border-2 shrink-0",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border",
                  isCurrent && "ring-4 ring-primary/20"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div
                className={cn(
                  "text-sm font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
                {isCurrent && <span className="ml-2 text-xs text-primary">(current)</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
