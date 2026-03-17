"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";
import { fetchLogsheetData, fetchMaintenanceData, LogsheetData, MaintenanceData } from "../services";
import {
  Download, QrCode,
  BarChart3, History, Settings, Pencil, Loader2,
  FileText, ExternalLink, UploadCloud,
  Package, MapPin
} from "lucide-react";
import { Image as ImageIcon } from "lucide-react";

// Import Auth Context
import { useAuth } from "@/context/AuthContext";

const FRAPPE_BASE_URL = "http://103.219.3.169:2223";
const API_BASE_URL = `${FRAPPE_BASE_URL}/api/resource`;

interface AssetData {
  name: string;
  asset_name: string;
  location: string;
  status: string;
  asset_category?: string;
  custom_pump_status?: string;
  gross_purchase_amount?: number;
  custom_lis_name?: string;
  custom_stage_no?: string;
  custom_condition?: string;
  custom_current_hours?: number;
  custom_equipement_make?: string;
  custom_equipement_model?: string;
  custom_asset_specifications?: Array<{
    specification_type: string;
    details: string;
  }>;
  custom_drawing_attachment?: Array<{
    name_of_document?: string;
    attachment?: string;
  }>;
  modified: string;
}

const isImage = (url?: string) => {
  if (!url) return false;
  const extension = url.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '');
};

export default function AssetDetailPage() {
  const params = useParams();
  const docname = params.id as string;

  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const [asset, setAsset] = useState<AssetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("drawings");
  const [showQR, setShowQR] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [logsheetData, setLogsheetData] = useState<LogsheetData[]>([]);
  const [logsheetLoading, setLogsheetLoading] = useState(false);
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceData[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  useEffect(() => {
    const fetchAsset = async () => {
      if (!isInitialized) return;
      if (!isAuthenticated || !apiKey || !apiSecret) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const resp = await axios.get(`${API_BASE_URL}/Asset/${docname}`, {
          headers: { Authorization: `token ${apiKey}:${apiSecret}` },
          withCredentials: true,
        });
        setAsset(resp.data.data);
      } catch (err: any) {
        console.error("API Error:", err);

        const messages = getApiMessages(
          null,
          err,
          "Asset loaded successfully!",
          "Failed to load asset details. Check connection.",
          (error) => {
            if (error.response?.status === 404) return "Asset not found";
            if (error.response?.status === 403) return "Unauthorized";
            return "Failed to load asset details";
          }
        );

        if (!messages.success) {
          setError(messages.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAsset();
  }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

  // Fetch Logsheet Data
  const fetchLogsheetDataHandler = async () => {
    if (!asset?.custom_lis_name || !asset?.custom_stage_no || !asset?.name || !apiKey || !apiSecret) return;

    try {
      setLogsheetLoading(true);
      const data = await fetchLogsheetData(
        asset.custom_lis_name,
        asset.custom_stage_no,
        asset.name,
        apiKey,
        apiSecret
      );
      setLogsheetData(data);
    } catch (err) {
      toast.error('Failed to load logsheet data');
    } finally {
      setLogsheetLoading(false);
    }
  };

  // Fetch Maintenance Data
  const fetchMaintenanceDataHandler = async () => {
    if (!asset?.custom_lis_name || !asset?.custom_stage_no || !asset?.name || !apiKey || !apiSecret) return;

    try {
      setMaintenanceLoading(true);
      const data = await fetchMaintenanceData(
        asset.custom_lis_name,
        asset.custom_stage_no,
        asset.name,
        apiKey,
        apiSecret
      );
      setMaintenanceData(data);
    } catch (err) {
      toast.error('Failed to load maintenance data');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'readings' && asset) {
      fetchLogsheetDataHandler();
    }
    if (activeTab === 'maintenance' && asset) {
      fetchMaintenanceDataHandler();
    }
  }, [activeTab, asset]);

  const handleDownloadReport = () => toast.success("Report downloading...");

  const handleOpenFile = (url?: string) => {
    if (!url) return;
    const fullUrl = url.startsWith("http") ? url : `${FRAPPE_BASE_URL}${url}`;
    window.open(fullUrl, "_blank");
  };

  // Optimized Fetch Function
  const handleQRClick = async () => {
    setShowQR(true);

    // If we already have the URL for this asset, don't call the API again
    if (qrUrl || !asset?.name) return;

    try {
      setIsGeneratingQr(true);

      // Call Frappe PDF generator
      const { data } = await axios.get(
        `${FRAPPE_BASE_URL}/api/method/quantlis_management.Asset_qr.generate_asset`,
        {
          params: { docname: asset.name },
          headers: { Authorization: `token ${apiKey}:${apiSecret}` }
        }
      );

      if (data.message) {
        // Build the final scannable link
        const pdfFullUrl = `${FRAPPE_BASE_URL}${data.message}`;
        const qrApiBase = "https://api.qrserver.com/v1/create-qr-code/";
        const optimizedQrUrl = `${qrApiBase}?size=300x300&data=${encodeURIComponent(pdfFullUrl)}&format=png`;

        setQrUrl(optimizedQrUrl);
      }
    } catch (err) {
      console.error(err);

      const messages = getApiMessages(
        null,
        err,
        "QR code generated successfully!",
        "QR Generation failed",
        (error) => {
          if (error.response?.status === 500) return "Server error during QR generation";
          return "Failed to generate QR code";
        }
      );

      if (!messages.success) {
        toast.error(messages.message, { description: messages.description, duration: Infinity });
      }
    } finally {
      setIsGeneratingQr(false);
    }
  };

  // Print Function - Opens PDF directly
  const handlePrintQR = async () => {
    if (!asset?.name) return;

    try {
      const { data } = await axios.get(
        `${FRAPPE_BASE_URL}/api/method/quantlis_management.Asset_qr.generate_asset`,
        {
          params: { docname: asset.name },
          headers: { Authorization: `token ${apiKey}:${apiSecret}` }
        }
      );

      if (data.message) {
        const pdfFullUrl = `${data.message}`;
        window.open(pdfFullUrl, '_blank');
      }
    } catch (err) {
      console.error(err);

      const messages = getApiMessages(
        null,
        err,
        "PDF opened successfully!",
        "Failed to open PDF",
        (error) => {
          if (error.response?.status === 404) return "PDF not found";
          if (error.response?.status === 403) return "Unauthorized to access PDF";
          return "Failed to open PDF";
        }
      );

      if (!messages.success) {
        toast.error(messages.message, { description: messages.description, duration: Infinity });
      }
    }
  };

  const tabs = [
    { id: "drawings", label: "Drawings", icon: ImageIcon },
    { id: "specs", label: "Specs", icon: Settings },
    { id: "readings", label: "Readings", icon: BarChart3 },
    { id: "maintenance", label: "Maintenance", icon: History },
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-red-600 font-bold mb-4">{error || "Asset Not Found"}</h2>
        <Link href="/lis-management/doctype/asset">
          <button className="btn btn--primary">Go Back</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="py-4 px-2 test-module-page">
      {/* Compact Header Section - Single Line */}
      <div className="test-module-header py-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">{asset.asset_name}</h1>
            <span className={`status-badge text-xs whitespace-nowrap status-badge-draft`}>
              {asset.status}
            </span>
            <span className="flex items-center gap-1 text-sm text-blue-100 whitespace-nowrap">
              <Package size={14} /> {asset.name}
            </span>
            <span className="flex items-center gap-1 text-sm text-blue-100 whitespace-nowrap">
              <MapPin size={14} /> {asset.location}
            </span>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2 flex-shrink-0 mt-2 sm:mt-0 w-full sm:w-auto">
            <Link href={`/lis-management/doctype/asset/edit/${docname}`} className="w-full sm:w-auto inline-block">
              <button className="btn-header-primary-asset bg-green-600 hover:bg-green-700 text-sm w-full h-10 flex items-center justify-center gap-2 px-4">
                <Pencil size={16} /> Edit
              </button>
            </Link>
            <button onClick={handleDownloadReport} className="btn-header-secondary-asset text-sm w-full sm:w-auto h-10 flex items-center justify-center gap-2 px-4">
              <Download size={16} /> Report
            </button>
            <button onClick={handleQRClick} className="btn-header-secondary-asset text-sm w-full sm:w-auto h-10 flex items-center justify-center gap-2 px-4">
              <QrCode size={16} /> QR
            </button>
          </div>
        </div>
      </div>

      {/* Compact Info Bar - Always Visible */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
        <div className="test-info-box !py-2">
          <p className="text-sm">Category</p>
          <span className="text-base font-bold">{asset.asset_category || "—"}</span>
        </div>
        <div className="test-info-box !py-2">
          <p className="text-sm">LIS Name</p>
          <span className="text-base font-bold">{asset.custom_lis_name || "—"}</span>
        </div>
        <div className="test-info-box !py-2">
          <p className="text-sm">Stage No</p>
          <span className="text-base font-bold">{asset.custom_stage_no || "N/A"}</span>
        </div>
        <div className="test-info-box !py-2">
          <p className="text-sm">Make</p>
          <span className="text-base font-bold">{asset.custom_equipement_make || "—"}</span>
        </div>
        <div className="test-info-box !py-2">
          <p className="text-sm">Model</p>
          <span className="text-base font-bold">{asset.custom_equipement_model || "—"}</span>
        </div>
        <div className="test-info-box !py-2">
          <p className="text-sm">Status</p>
          <span className={`text-base font-bold ${(asset.custom_pump_status || '') == 'Running' ? 'text-green-600' : 'text-red-600'}`}>
            {asset.custom_pump_status || "—"}</span>
        </div>
      </div>

      {/* Compact Tab Navigation */}
      <div className="test-module-tab-bar mb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`test-module-tab text-sm py-2 ${activeTab === tab.id ? "active" : ""}`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Single Column Content */}
      <div className="space-y-4">

        {/* DRAWINGS TAB */}
        {activeTab === "drawings" && (
          <div className="test-card !p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="test-card-title text-lg">Attached Drawings & Files</h2>
              <Link href={`/lis-management/doctype/asset/edit/${docname}`}>
                <button className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <UploadCloud size={12} /> Manage
                </button>
              </Link>
            </div>

            {asset.custom_drawing_attachment && asset.custom_drawing_attachment.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {asset.custom_drawing_attachment.map((file, idx) => {
                  const isImg = isImage(file.attachment);
                  const fullUrl = file.attachment?.startsWith("http")
                    ? file.attachment
                    : `${FRAPPE_BASE_URL}${file.attachment}`;

                  return (
                    <div
                      key={idx}
                      onClick={() => handleOpenFile(file.attachment)}
                      className="group border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-all bg-gray-50 dark:bg-gray-900"
                    >
                      <div className="h-24 w-full flex items-center justify-center bg-gray-200 dark:bg-gray-800 overflow-hidden relative">
                        {isImg ? (
                          <img
                            src={fullUrl}
                            alt={file.name_of_document || "Drawing"}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <FileText size={32} className="text-gray-400" />
                        )}

                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ExternalLink className="text-white drop-shadow-md" size={20} />
                        </div>
                      </div>

                      <div className="p-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                        <p className="font-medium text-xs truncate text-gray-800 dark:text-gray-200">
                          {file.name_of_document || "Unnamed"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                <ImageIcon size={36} className="mb-2 opacity-50" />
                <p className="text-sm font-medium">No drawings attached</p>
              </div>
            )}
          </div>
        )}

        {/* SPECIFICATIONS TAB */}
        {activeTab === "specs" && (
          <div className="test-card !p-4">
            <h2 className="test-card-title text-lg mb-3">Machine Specifications</h2>
            {asset.custom_asset_specifications && asset.custom_asset_specifications.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,18rem)] gap-8 justify-start">
                {asset.custom_asset_specifications.map((spec, idx) => (
                  <div
                    key={idx}
                    className="test-info-box !text-left !py-5 w-72 min-h-[100px]"
                  >
                    <p className="!text-lg !font-medium">
                      {spec.specification_type}
                    </p>
                    <strong className="!text-xl !font-semibold block mt-1">
                      {spec.details}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                <p className="text-sm">No specifications recorded.</p>
                <Link href={`/lis-management/doctype/asset/edit/${docname}`} className="text-blue-600 text-xs hover:underline mt-2 block">
                  Add Specifications
                </Link>
              </div>
            )}
          </div>
        )}

        {/* READINGS TAB */}
        {activeTab === "readings" && (
          <div className="test-card !p-4">
            <h2 className="test-card-title text-lg mb-3">Log Sheet Readings</h2>
            {logsheetLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin h-8 w-8 text-blue-600 mr-2" />
                <span className="text-sm text-gray-500">Loading readings...</span>
              </div>
            ) : logsheetData.length > 0 ? (
              <div className="stock-table-container">
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Water Level</th>
                      <th>Pressure Gauge</th>
                      <th>BR</th>
                      <th>RY</th>
                      <th>YB</th>
                      <th>R</th>
                      <th>Y</th>
                      <th>B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsheetData.map((reading, index) => (
                      <tr key={index}>
                        <td className="text-sm">{new Date(`${reading.date}T${reading.time}`).toLocaleString('en-IN', { hour12: false })}</td>
                        <td>{reading.water_level}</td>
                        <td>{reading.pressure_guage}</td>
                        <td>{reading.br}</td>
                        <td>{reading.ry}</td>
                        <td>{reading.yb}</td>
                        <td>{reading.r}</td>
                        <td>{reading.y}</td>
                        <td>{reading.b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                <p className="text-sm">No logsheet data available for this asset.</p>
              </div>
            )}
          </div>
        )}

        {/* MAINTENANCE TAB */}
        {activeTab === "maintenance" && (
          <div className="test-card !p-4">
            <h2 className="test-card-title text-lg mb-3">Maintenance Records</h2>
            {maintenanceLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin h-8 w-8 text-blue-600 mr-2" />
                <span className="text-sm text-gray-500">Loading maintenance data...</span>
              </div>
            ) : maintenanceData.length > 0 ? (
              <div className="stock-table-container">
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Next Due Date</th>
                      <th>Last Completion Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenanceData.map((record, index) => (
                      <tr key={index}>
                        <td className="text-sm">{record.maintenance_task}</td>
                        <td>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${record.maintenance_status === 'Completed' ? 'bg-green-100 text-green-800' :
                            record.maintenance_status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                            {record.maintenance_status}
                          </span>
                        </td>
                        <td className="text-sm">{new Date(record.start_date).toLocaleDateString('en-IN')}</td>
                        <td className="text-sm">{new Date(record.end_date).toLocaleDateString('en-IN')}</td>
                        <td className="text-sm">{new Date(record.next_due_date).toLocaleDateString('en-IN')}</td>
                        <td className="text-sm">{new Date(record.last_completion_date).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                <p className="text-sm">No maintenance data available for this asset.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Optimized Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowQR(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-gray-700 relative" onClick={(e) => e.stopPropagation()}>

            {/* View Document Button in Bottom Right Corner */}
            <button
              disabled={!qrUrl}
              onClick={handlePrintQR}
              className="absolute bottom-4 right-4 flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold text-sm shadow-md transition-all disabled:opacity-50"
            >
              <ExternalLink size={14} /> View Document
            </button>

            <div className="flex flex-col items-center justify-center mb-6 bg-white rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 min-h-[260px]">
              {isGeneratingQr ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
                  <span className="text-sm text-gray-400">Fetching asset data...</span>
                </div>
              ) : qrUrl ? (
                <img src={qrUrl} alt="QR" className="w-52 h-52 animate-in fade-in zoom-in duration-300" />
              ) : (
                <div className="text-center text-red-500">Failed to load</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}