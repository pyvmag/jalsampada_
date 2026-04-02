"use client";

import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area
} from "recharts";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, UserCheck, Droplets, CheckCircle2,
  Clock, Server, Wrench, ChevronRight, Lock
} from "lucide-react";

// Update the IP or abstract it via your config
const API_BASE_URL = "http://103.219.3.169:2223";

export default function Home() {
  const { apiKey, apiSecret, isInitialized, isAuthenticated } = useAuth();
  
  // Data stores
  const [logbooks, setLogbooks] = React.useState<any[]>([]);
  const [incidents, setIncidents] = React.useState<any[]>([]);
  const [logSheets, setLogSheets] = React.useState<any[]>([]);
  
  // UI state
  const [loading, setLoading] = React.useState(true);
  const [lastRefreshed, setLastRefreshed] = React.useState<Date | null>(null);

  React.useEffect(() => {
    const fetchDashboardData = async (isBackground = false) => {
      if (!isInitialized) return;
      if (!isAuthenticated || !apiKey || !apiSecret) {
        if (!isBackground) setLoading(false);
        return;
      }

      try {
        if (!isBackground) setLoading(true);
        const headers = { Authorization: `token ${apiKey}:${apiSecret}` };

        // 1. Fetch Logbook Ledger Report (For Metrics, Top Operators, and Activity Feed)
        const logbookParams = new URLSearchParams({ report_name: "Logbook Ledger", filters: "{}" });
        const reqLogbook = axios.get(`${API_BASE_URL}/api/method/frappe.desk.query_report.run?${logbookParams.toString()}`, { headers, withCredentials: true }).catch(err => {
          console.error("Logbook Report Fetch Error", err);
          return { data: { message: { result: [] } } };
        });

        // 2. Fetch Active Incidents (Note: the backend Frappe Doctype is 'Issue')
        const incidentFilters = JSON.stringify([["status", "in", ["Open", "Replied", "On Hold"]]]);
        const incidentFields = JSON.stringify(["name", "status", "custom_incident_subject", "description", "custom_lis", "creation"]);
        const reqIncidents = axios.get(`${API_BASE_URL}/api/resource/Issue?fields=${incidentFields}&filters=${incidentFilters}&limit_page_length=5&order_by=creation desc`, { headers, withCredentials: true }).catch(err => { console.error("Incidents Fetch Error", err); return { data: { data: [] } }; });

        // 3. Fetch Log Sheets (for Environmental Data like Water Level)
        const sheetFields = JSON.stringify(["name", "date", "time", "water_level", "lis"]);
        const reqSheets = axios.get(`${API_BASE_URL}/api/resource/Log Sheet?fields=${sheetFields}&limit_page_length=15&order_by=creation desc`, { headers, withCredentials: true }).catch(err => ({ data: { data: [] } }));

        const [resLogbook, resIncidents, resSheets] = await Promise.all([reqLogbook, reqIncidents, reqSheets]);

        setLogbooks(resLogbook.data?.message?.result || []);
        
        // Ensure that data falls back gracefully
        setIncidents(resIncidents.data?.data || []);
        setLogSheets(resSheets.data?.data || []);
        
        setLastRefreshed(new Date());
      } catch (err: any) {
        console.error("Dashboard DB fetch error", err);
        if (!isBackground) toast.error("Failed to sync live dashboard data.", { duration: Infinity });
      } finally {
        if (!isBackground) setLoading(false);
      }
    };

    fetchDashboardData(false);

    // Auto-refresh silently every 15 seconds
    const intervalId = setInterval(() => fetchDashboardData(true), 15000);
    return () => clearInterval(intervalId);
  }, [apiKey, apiSecret, isAuthenticated, isInitialized]);

  // Aggregate and Transform data for the components
  const { pumpStatusData, systemMetrics, activityFeed, topOperators, waterLevelData } = React.useMemo(() => {
    // A. Deduplicate Logbooks for CURRENT pump state
    const latestStatusPerAsset: Record<string, any> = {};
    const feed = [...logbooks]; // Already sorted by ERPNext, top is newest
    
    // Group Operator Leaderboard
    const operatorCounts: Record<string, number> = {};

    logbooks.forEach(row => {
      // Leaderboard tally
      const op = row.operator_name || "System Actor";
      operatorCounts[op] = (operatorCounts[op] || 0) + 1;

      // Pump State Tracking
      const assetKey = row.asset_no || row.pump || `Unknown-${row.name}`;
      if (!latestStatusPerAsset[assetKey]) {
        latestStatusPerAsset[assetKey] = row;
      } else {
        if (String(row.name).localeCompare(String(latestStatusPerAsset[assetKey].name)) > 0) {
          latestStatusPerAsset[assetKey] = row;
        }
      }
    });

    const activePumps = Object.values(latestStatusPerAsset);
    const groups: Record<string, any> = {};
    const metrics = { running: 0, stopped: 0, maintenance: 0, total: logbooks.length };
    
    // Aggregate Active Pump Groupings
    activePumps.forEach(p => {
      const status = (p.status || "").toLowerCase();
      let statusKey = "inactive";
      
      if (status.includes("running") || status.includes("start") || status.includes("active")) {
        metrics.running++;
        statusKey = "active";
      } else if (status.includes("maintenance") || status.includes("repair") || status.includes("breakdown")) {
        metrics.maintenance++;
        statusKey = "maintenance";
      } else {
        metrics.stopped++;
      }

      const lis = p.lis_name || "Unassigned";
      const stage = p.stage || "Stage Unk.";
      const key = `${lis} • ${stage}`;

      if (!groups[key]) {
        groups[key] = { name: key, active: 0, maintenance: 0, inactive: 0, total: 0 };
      }
      
      groups[key][statusKey] += 1;
      groups[key].total += 1;
    });

    // Extract Top Operators
    const ops = Object.entries(operatorCounts)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    // Extract Water Level Data (Reverse sorting to plot chronological left-to-right)
    const validSheets = logSheets.filter(s => typeof s.water_level === "number" && s.water_level > 0);
    const chartWaterLevel = validSheets.reverse().map(s => ({
      time: typeof s.time === "string" ? s.time.substring(0, 5) : s.date,
      level: s.water_level,
      name: s.lis || "Site"
    }));

    return { 
      pumpStatusData: Object.values(groups).sort((a, b) => b.total - a.total),
      systemMetrics: metrics,
      activityFeed: feed.slice(0, 5), // Only need top 5
      topOperators: ops,
      waterLevelData: chartWaterLevel
    };
  }, [logbooks, logSheets]);

  // Transform metrics into Pie Chart series
  const pieData = [
    { name: "Running", value: systemMetrics.running, color: "#10b981" },
    { name: "Stopped", value: systemMetrics.stopped, color: "#9ca3af" },
    { name: "Maintenance", value: systemMetrics.maintenance, color: "#f59e0b" }
  ].filter(d => d.value > 0);

  // Layout Renders
  if (!isInitialized || loading) {
    return (
      <div className="module active p-8 flex justify-center items-center h-[70vh]">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-500 font-medium">Syncing Command Center...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="module active p-8 flex flex-col justify-center items-center h-[70vh] bg-white rounded-xl shadow-sm border border-gray-100">
        <Lock className="text-4xl text-gray-300 mb-4 h-12 w-12" />
        <h2 className="text-xl font-bold text-gray-800">Authentication Required</h2>
        <p className="text-gray-500 mt-2 mb-6 text-center max-w-md">Please login to view live dashboard metrics.</p>
        <Link href="/lis-management" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm">
          Go to Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50/20 min-h-screen">
      
      {/* HEADER TRAY */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 tracking-tight">System Reliability Center</h2>
          <p className="text-gray-500 text-sm mt-1">Real-time pump telemetry and central operational insights</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Live Sync Active 
          <span className="text-gray-400 ml-1 ml-2 border-l pl-3">Updated: {lastRefreshed?.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* 🔴 MODULE 1: TOP METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Server size={20} /></div>
            <span className="text-xs font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded-full">Total Logs</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-800">{systemMetrics.total}</h3>
            <p className="text-gray-400 text-sm font-medium mt-1">Logged system actions</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 transition-all hover:shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10 opacity-50"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Activity size={20} /></div>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-800">{systemMetrics.running}</h3>
            <p className="text-gray-400 text-sm font-medium mt-1">Pumps Currenly Running</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-gray-100 text-gray-500 rounded-xl"><CheckCircle2 size={20} /></div>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-800">{systemMetrics.stopped}</h3>
            <p className="text-gray-400 text-sm font-medium mt-1">Pumps Stopped / Standby</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-100 transition-all hover:shadow-md flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-orange-50 text-orange-500 rounded-xl"><Wrench size={20} /></div>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-800">{systemMetrics.maintenance}</h3>
            <p className="text-gray-400 text-sm font-medium mt-1">Units In Maintenance</p>
          </div>
        </div>
      </div>

      {/* 🔴 MODULE 2: PRIMARY CHARTS LAYER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* PIE CHART */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-1 flex flex-col items-center justify-center">
          <div className="w-full mb-2">
            <h3 className="text-lg font-bold text-gray-800">Pump Status Ratio </h3>
            <p className="text-sm text-gray-400">Current operational breakdown</p>
          </div>
          <div className="h-64 w-full">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    animationDuration={1000}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ fontWeight: 600 }}
                  />
                  <Legend iconType="circle" verticalAlign="bottom" wrapperStyle={{ fontSize: '13px', paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <p>No operational data</p>
              </div>
            )}
          </div>
        </div>

        {/* STACKED BAR CHART */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-800">Operational Distribution</h3>
            <p className="text-sm text-gray-400">Pump status categorized by LIS Site and Stage hierarchy</p>
          </div>
          <div className="w-full h-80 flex-grow">
            {pumpStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pumpStatusData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '..' : val}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: '#f9fafb', opacity: 0.8 }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '13px' }} iconType="circle" />
                  <Bar dataKey="active" stackId="a" name="Running" fill="#10b981" radius={[0, 0, 4, 4]} animationDuration={1200} maxBarSize={50} />
                  <Bar dataKey="inactive" stackId="a" name="Stopped" fill="#9ca3af" animationDuration={1200} maxBarSize={50} />
                  <Bar dataKey="maintenance" stackId="a" name="Maintenance" fill="#f59e0b" radius={[4, 4, 0, 0]} animationDuration={1200} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                <i className="fas fa-inbox text-4xl mb-3 text-gray-300"></i>
                <p>No categorizable data present</p>
              </div>
            )}
          </div>
        </div>
      </div>

      

      </div>
    
  );
}
