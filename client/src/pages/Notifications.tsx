import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bell, ChevronLeft, Loader2, CheckCheck } from "lucide-react";
import { toast } from "sonner";

export default function Notifications() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  // Always call hooks unconditionally (Rules of Hooks)
  const { data: notifications, isLoading } = trpc.notifications.list.useQuery(
    { limit: 50 },
    { enabled: isAuthenticated }
  );

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      toast.success("All notifications marked as read");
    },
  });

  const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <Bell className="w-16 h-16 text-purple-700 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">Sign in to view notifications</h2>
          <Button onClick={() => (window.location.href = "/login")} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
            Sign In
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-2 w-fit">
              <ChevronLeft className="w-4 h-4" />
              {t("common.backToHome")}
            </Link>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Bell className="w-6 h-6" />
              Notifications
              {unreadCount > 0 && (
                <span className="text-sm bg-[#F59E0B] text-black px-2 py-0.5 rounded-full font-semibold">
                  {unreadCount}
                </span>
              )}
            </h1>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-gray-400 hover:text-white text-xs"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-12 text-center">
            <Bell className="w-12 h-12 text-purple-700 mx-auto mb-3" />
            <p className="text-gray-400">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(notif => (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.isRead) markRead.mutate({ id: notif.id });
                }}
                className={cn(
                  "bg-[#1A1033] border rounded-xl p-4 cursor-pointer transition-all hover:border-purple-500/50",
                  notif.isRead ? "border-purple-900/20 opacity-70" : "border-purple-500/30"
                )}
              >
                <div className="flex items-start gap-3">
                  {!notif.isRead && (
                    <div className="w-2 h-2 rounded-full bg-[#F59E0B] mt-2 flex-shrink-0" />
                  )}
                  <div className={cn("flex-1", notif.isRead && "ml-5")}>
                    <p className="text-sm font-medium text-white">{notif.title}</p>
                    <p className="text-sm text-gray-400 mt-0.5">{notif.message}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(notif.createdAt).toLocaleDateString()} at{" "}
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
