"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Database,
  FileSpreadsheet,
  RefreshCcw,
  Download,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, pendingSync: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState<"csv" | "sql" | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/stats");
        const data = await res.json();
        if (res.ok) setStats(data);
      } catch (error) {
        console.error("Failed to fetch stats");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: data.message, type: "success" });
        // Refresh numbers
        try {
          const res = await fetch("/api/admin/stats");
          const data = await res.json();
          if (res.ok) setStats(data);
        } catch (error) {
          console.error("Failed to fetch stats");
        }
      } else {
        setMessage({ text: data.message || "Sync failed", type: "error" });
      }
    } catch (error) {
      setMessage({ text: "Network error during sync", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = async (format: "csv" | "sql") => {
    setIsExporting(format);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/export?format=${format}`);
      if (!res.ok) throw new Error("Export failed");

      // Handle file download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tdeup_attendees_${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage({ text: "Failed to download export", type: "error" });
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Manage attendees, export data, and sync to Google Sheets.
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                Total Registrations
              </p>
              <h2 className="text-4xl font-black text-slate-900">
                {isLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400 mt-2" />
                ) : (
                  stats.total
                )}
              </h2>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="p-4 bg-amber-50 text-amber-600 rounded-xl">
              <RefreshCcw className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                Pending Sheets Sync
              </p>
              <h2 className="text-4xl font-black text-slate-900">
                {isLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400 mt-2" />
                ) : (
                  stats.pendingSync
                )}
              </h2>
            </div>
          </div>
        </div>

        {/* Alert Messages */}
        {message && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 border font-semibold text-sm ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            <AlertCircle className="w-5 h-5" /> {message.text}
          </div>
        )}

        {/* Actions Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-lg text-slate-800">System Actions</h3>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sync Button */}
            <Button
              onClick={handleSync}
              disabled={isSyncing || stats.pendingSync === 0}
              className="h-14 bg-amber-500 hover:bg-amber-600 text-white font-bold text-base rounded-xl shadow-sm"
            >
              {isSyncing ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <RefreshCcw className="w-5 h-5 mr-2" />
              )}
              Force Sheets Sync
            </Button>

            {/* CSV Export */}
            <Button
              onClick={() => handleExport("csv")}
              disabled={isExporting !== null}
              variant="outline"
              className="h-14 border-slate-300 font-bold text-slate-700 hover:bg-slate-50 rounded-xl"
            >
              {isExporting === "csv" ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <FileSpreadsheet className="w-5 h-5 mr-2 text-green-600" />
              )}
              Export as CSV
            </Button>

            {/* SQLite Export */}
            <Button
              onClick={() => handleExport("sql")}
              disabled={isExporting !== null}
              variant="outline"
              className="h-14 border-slate-300 font-bold text-slate-700 hover:bg-slate-50 rounded-xl"
            >
              {isExporting === "sql" ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Database className="w-5 h-5 mr-2 text-blue-600" />
              )}
              Export as SQLite (.sql)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
