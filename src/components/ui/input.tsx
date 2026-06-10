import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // iOS 26 glass input
          "flex h-11 w-full rounded-2xl px-4 py-2 text-base",
          "input-glass",
          "placeholder:text-muted-foreground/70",
          "ring-offset-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0",
          "focus-visible:bg-white/75 focus-visible:border-white/65",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-fluid md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
