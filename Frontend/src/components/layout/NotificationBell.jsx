import { Link } from "react-router-dom";
import { Bell, Megaphone, CheckCheck, DollarSign, Wallet, MessageSquare, Calendar, Laptop } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useNotifications } from "../../contexts/NotificationContext";

function formatWhen(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function ItemIcon({ item, unread }) {
  const cls = `w-4 h-4 mt-0.5 shrink-0 ${
    unread ? "text-amber-600" : "text-muted-foreground"
  }`;
  if (item.kind === "salary_advance") return <Wallet className={cls} />;
  if (
    item.kind === "payroll_created" ||
    item.kind === "payslip_ready" ||
    item.kind === "payroll_rejected" ||
    item.kind === "payroll_paid" ||
    item.kind === "payroll_reminder"
  )
    return <DollarSign className={cls} />;
  if (item.kind === "chat_message") return <MessageSquare className={cls} />;
  if (item.kind === "leave_reviewed" || item.kind === "leave_submitted")
    return <Calendar className={cls} />;
  if (item.kind === "device_assignment" || item.kind === "device_return_due")
    return <Laptop className={cls} />;
  return <Megaphone className={cls} />;
}

export default function NotificationBell({
  className = "",
  align = "end",
  side = "bottom",
}) {
  const { items, unreadCount, markRead, markAllRead, connected } =
    useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`relative ${className}`}
          title={connected ? "Notifications (live)" : "Notifications"}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={8}
        className="w-80 max-h-[70vh] overflow-y-auto"
      >
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            Notifications
            {connected && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Live" />
            )}
          </span>
          {unreadCount > 0 && (
            <button
              type="button"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                markAllRead();
              }}
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground text-center">
            No new notifications
          </div>
        ) : (
          items.slice(0, 15).map((item) => {
            return (
              <DropdownMenuItem
                key={item.id}
                asChild
                className="cursor-pointer"
                onSelect={() => markRead(item.id)}
              >
                <Link
                  to={item.href || "/calendar"}
                  className="flex flex-col items-start gap-1 py-2.5 px-2 bg-primary/5"
                >
                  <div className="flex items-start gap-2 w-full">
                    <ItemIcon item={item} unread />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug line-clamp-2">
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {item.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {item.audienceLabel}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatWhen(item.createdAt)}
                        </span>
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                  </div>
                </Link>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
