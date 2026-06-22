import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function PushNotificationBell() {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  if (!supported || permission === "denied") return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={subscribed ? unsubscribe : subscribe}
            disabled={loading}
            className="relative"
            aria-label={subscribed ? "Disable push notifications" : "Enable push notifications"}
          >
            {loading ? (
              <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : subscribed ? (
              <>
                <BellRing className="h-5 w-5 text-primary" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
              </>
            ) : (
              <Bell className="h-5 w-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {subscribed ? "Push notifications on — click to disable" : "Enable push notifications"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
