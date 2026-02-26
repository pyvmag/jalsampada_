"use client";

import * as React from "react";
import axios from "axios";
import { useFormContext, useWatch } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { AlertCircle, Check, X, Minus } from "lucide-react"; // Icons for the toggle
import { cn } from "@/lib/utils";

const API_ENDPOINT = "http://103.219.3.169:2223/api/method/run_doc_method";

interface MatrixData {
  assets: { name: string }[];
  parameters: { name: string }[];
}

interface ChecklistItem {
  doctype: string;
  asset: string;
  parameter: string;
  checked: 0 | 1 | null; // 0=Closed(Fail), 1=Opened(Pass), null=Neutral
  description?: string;
}

// --- CUSTOM TOGGLE COMPONENT ---
interface TriStateToggleProps {
  value: 0 | 1 | null;
  onChange: (val: 0 | 1 | null) => void;
}

function TriStateToggle({ value, onChange }: TriStateToggleProps) {
  // Logic to cycle states on click if you wanted a single button, 
  // but a visual 3-part switch is clearer for "Open vs Closed".

  return (
    <div className="flex items-center justify-center">
      <div className="relative flex items-center bg-gray-200 rounded-full p-1 w-[100px] h-9 shadow-inner">
        {/* Sliding Pill Indicator */}
        <div
          className={cn(
            "absolute top-1 bottom-1 w-8 rounded-full shadow-sm transition-all duration-300 ease-out",
            value === 1 ? "left-1 bg-green-500" :
              value === 0 ? "right-1 bg-red-500" :
                "left-1/2 -translate-x-1/2 bg-gray-400"
          )}
        />

        {/* Option: Opened (Pass) */}
        <button
          type="button"
          onClick={() => onChange(1)}
          className="flex-1 z-10 flex justify-center items-center text-xs font-bold transition-colors focus:outline-none"
          title="Opened / Pass"
        >
          <Check className={cn("w-4 h-4", value === 1 ? "text-white" : "text-gray-500 hover:text-green-600")} />
        </button>

        {/* Option: Neutral */}
        <button
          type="button"
          onClick={() => onChange(null)} // Click middle to reset
          className="flex-1 z-10 flex justify-center items-center text-xs font-bold transition-colors focus:outline-none"
          title="Reset"
        >
          <Minus className={cn("w-4 h-4", value === null ? "text-white" : "text-gray-500")} />
        </button>

        {/* Option: Closed (Fail) */}
        <button
          type="button"
          onClick={() => onChange(0)}
          className="flex-1 z-10 flex justify-center items-center text-xs font-bold transition-colors focus:outline-none"
          title="Closed / Fail"
        >
          <X className={cn("w-4 h-4", value === 0 ? "text-white" : "text-gray-500 hover:text-red-600")} />
        </button>
      </div>
    </div>
  );
}


export function MaintenanceChecklistMatrix() {
  const { apiKey, apiSecret } = useAuth();
  const { control, setValue, getValues } = useFormContext();

  // 1. Watch dependencies
  const [lisName, stage, assetCategory, monitoringType] = useWatch({
    control,
    name: ["lis_name", "stage", "asset_category", "monitoring_type"],
  });

  const [matrix, setMatrix] = React.useState<MatrixData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [assetSearch, setAssetSearch] = React.useState("");

  // 2. Watch data
  const checklistData: ChecklistItem[] = useWatch({
    control,
    name: "checklist_data",
  }) || [];

  // 3. Fetch Matrix
  React.useEffect(() => {
    const fetchMatrix = async () => {
      if (!lisName || !stage || !assetCategory || !monitoringType || !apiKey || !apiSecret) {
        setMatrix(null);
        return;
      }

      setLoading(true);
      try {
        const docPayload = {
          name: "new-checklist-temp",
          owner: "administrator",
          docstatus: 0,
          doctype: "Maintenance Checklist",
          lis_name: lisName,
          stage: stage,
          asset_category: assetCategory,
          monitoring_type: monitoringType,
          checklist_data: [],
          __islocal: 1,
          __unsaved: 1
        };

        const params = new URLSearchParams();
        params.append("docs", JSON.stringify(docPayload));
        params.append("method", "get_matrix_data");

        const resp = await axios.post(API_ENDPOINT, params, {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          withCredentials: true,
        });

        if (resp.data.message) {
          setMatrix(resp.data.message);
        } else {
          setMatrix(null);
        }
      } catch (error) {
        console.error("Failed to fetch matrix data", error);
        toast.error("Failed to load checklist matrix");
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchMatrix, 500);
    return () => clearTimeout(timer);
  }, [lisName, stage, assetCategory, monitoringType, apiKey, apiSecret]);


  // 4. Update Logic
  const updateEntry = (asset: string, parameter: string, updates: Partial<ChecklistItem>) => {
    const currentData = getValues("checklist_data") || [];
    const index = currentData.findIndex((d: ChecklistItem) => d.asset === asset && d.parameter === parameter);

    let newData = [...currentData];

    if (index >= 0) {
      // Update existing
      newData[index] = { ...newData[index], ...updates };

      // If switched to OPEN (Pass) or Neutral, clear description
      if (updates.checked === 1 || updates.checked === null) {
        newData[index].description = "";
      }
    } else {
      // Create new
      newData.push({
        doctype: "Maintenance Checklist Item",
        asset,
        parameter,
        checked: null,
        description: "",
        ...updates
      });
    }

    setValue("checklist_data", newData, { shouldDirty: true, shouldValidate: true });
  };

  // 5. Render
  if (loading) return <div className="p-8 text-center text-sm text-gray-500 animate-pulse bg-gray-50 rounded border">Loading checklist configuration...</div>;
  if (!matrix || !matrix.assets || matrix.assets.length === 0) return null;

  const filteredAssets = matrix.assets.filter(a =>
    a.name.toLowerCase().includes(assetSearch.toLowerCase())
  );

  return (
    <div className="border rounded-md shadow-sm overflow-hidden bg-white">
      <div className="p-3 bg-gray-50 border-b flex items-center justify-between">
        <h4 className="font-medium text-sm text-gray-700">Checklist Matrix</h4>
        <input
          type="text"
          placeholder="Search Asset..."
          className="text-sm p-1.5 px-3 border rounded-md w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={assetSearch}
          onChange={(e) => setAssetSearch(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto max-h-[600px]">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-orange-100 text-gray-700 sticky top-0 z-20 shadow-sm">
            <tr>
              <th className="p-3 border-b border-r text-left min-w-[200px] font-semibold bg-orange-100">Asset</th>
              {matrix.parameters.map(p => (
                <th key={p.name} className="p-3 border-b border-r text-center min-w-[160px] font-semibold bg-orange-200/50">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredAssets.map(asset => (
              <tr key={asset.name} className="hover:bg-gray-50 transition-colors">
                <td className="p-3 border-r font-medium text-gray-900 bg-gray-50/50 sticky left-0 z-10">{asset.name}</td>

                {matrix.parameters.map(param => {
                  const entry = checklistData.find(d => d.asset === asset.name && d.parameter === param.name);
                  // Default to null (Neutral) if not found
                  const statusValue = entry?.checked ?? null;
                  const description = entry?.description || "";
                  const isClosed = statusValue === 0;

                  return (
                    <td key={`${asset.name}-${param.name}`} className="p-3 border-r text-center align-top min-w-[160px] bg-white">
                      <div className="flex flex-col items-center gap-2">

                        {/* Custom Tri-State Toggle */}
                        <TriStateToggle
                          value={statusValue}
                          onChange={(val) => updateEntry(asset.name, param.name, { checked: val })}
                        />

                        {/* Labels for clarity (optional) */}
                        <div className="text-[10px] text-gray-400 font-medium">
                          {statusValue === 1 && <span className="text-green-600">OK</span>}
                          {statusValue === 0 && <span className="text-red-600">Not OK</span>}
                          {statusValue === null && <span>Please Select</span>}
                        </div>

                        {/* Description Box - Slides down only when "Closed" (0) */}
                        {isClosed && (
                          <div className="w-full animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-start gap-1.5 p-2 bg-red-50 border border-red-100 rounded-md">
                              {/* <AlertCircle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" /> */}
                              <textarea
                                placeholder="Describe the issue..."
                                className="w-full text-xs bg-transparent border-none focus:ring-0 resize-none p-0 text-gray-700 placeholder:text-red-300"
                                rows={2}
                                autoFocus
                                value={description}
                                onChange={(e) => updateEntry(asset.name, param.name, { description: e.target.value })}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}