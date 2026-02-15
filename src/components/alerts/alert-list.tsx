"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Bell, CheckCircle, XCircle, AlertCircle, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Alert {
  id: string;
  sourceName: string;
  title: string;
  content: string;
  url: string;
  keywords: string[];
  relevance: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "new" | "read" | "dismissed";
  createdAt: string;
}

export function AlertList() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [filterStatus, filterPriority]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterPriority !== "all") params.append("priority", filterPriority);

      const res = await fetch(`/api/alerts?${params.toString()}`, {
        signal: abortControllerRef.current.signal
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch alerts:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'read' })
      });

      if (res.ok) {
        setAlerts(alerts.map(alert =>
          alert.id === id ? { ...alert, status: 'read' } : alert
        ));
      }
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
    }
  }, [alerts]);

  const dismissAlert = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' })
      });

      if (res.ok) {
        setAlerts(alerts.filter(alert => alert.id !== id));
      }
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    }
  }, []);

  const getPriorityBadge = (priority: string) => {
    const variants = {
      HIGH: "destructive",
      MEDIUM: "default",
      LOW: "secondary"
    } as const;

    return (
      <Badge variant={variants[priority as keyof typeof variants]}>
        {priority}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "new":
        return <Bell className="h-4 w-4 text-blue-500" />;
      case "read":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "dismissed":
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return "border-l-red-500";
      case "MEDIUM":
        return "border-l-yellow-500";
      case "LOW":
        return "border-l-green-500";
      default:
        return "border-l-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading alerts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Regulatory Alerts</h1>
          <p className="text-muted-foreground mt-1">
            Monitor regulatory updates affecting AI in banking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {alerts.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No alerts found</h3>
            <p className="text-muted-foreground">
              {filterStatus === "new" && filterPriority === "all"
                ? "You're all caught up! No new regulatory alerts."
                : "No alerts match your current filters."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className={`p-6 border-l-4 ${getPriorityColor(alert.priority)} ${
                alert.status === "new" ? "bg-blue-50 dark:bg-blue-950/20" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(alert.status)}
                    <span className="text-xs text-muted-foreground uppercase">
                      {alert.sourceName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      •
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </span>
                    {getPriorityBadge(alert.priority)}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{alert.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {alert.content}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {alert.keywords.map((keyword, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={alert.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Source
                  </a>
                  {alert.status === "new" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markAsRead(alert.id)}
                    >
                      Mark Read
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissAlert(alert.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}