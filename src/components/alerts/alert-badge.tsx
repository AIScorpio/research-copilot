"use client";

import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AlertBadgeProps {
  className?: string;
}

export function AlertBadge({ className: _className }: AlertBadgeProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts?status=new&limit=1');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleClick = () => {
    router.push('/alerts');
  };

  return (
    <button
      onClick={handleClick}
      className="relative p-2 rounded-md hover:bg-accent transition-colors"
      aria-label={`View ${unreadCount} unread alerts`}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </button>
  );
}