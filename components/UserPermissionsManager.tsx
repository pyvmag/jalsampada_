"use client";

import * as React from "react";
import axios from "axios";
import { toast } from "sonner";
import { Search, Loader2, Plus, Trash2, Save, X, Tag } from "lucide-react";
import { LinkInput } from "./LinkInput";

interface UserPermissionsManagerProps {
  userEmail: string;
  apiKey: string;
  apiSecret: string;
}

interface PermissionRow {
  doctype: string;
  documents: string[];
}

export const UserPermissionsManager: React.FC<UserPermissionsManagerProps> = ({
  userEmail,
  apiKey,
  apiSecret,
}) => {
  const [rows, setRows] = React.useState<PermissionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [docOptions, setDocOptions] = React.useState<Record<string, string[]>>({});
  const [activeSearchIndex, setActiveSearchIndex] = React.useState<number | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");

  const API_BASE_URL = "http://103.219.3.169:2223/api/resource";
  const API_METHOD_URL = "http://103.219.3.169:2223/api/method";

  // Fetch existing permissions on mount
  React.useEffect(() => {
    const fetchExistingPermissions = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE_URL}/User Permission`, {
          params: {
            filters: JSON.stringify({ user: userEmail }),
            fields: JSON.stringify(["allow", "for_value"]),
            limit_page_length: 1000,
          },
          headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        });

        // Group by doctype (allow)
        const grouped: Record<string, string[]> = {};
        res.data.data.forEach((p: any) => {
          if (!grouped[p.allow]) grouped[p.allow] = [];
          grouped[p.allow].push(p.for_value);
        });

        const initialRows = Object.entries(grouped).map(([doctype, documents]) => ({
          doctype,
          documents,
        }));

        setRows(initialRows.length > 0 ? initialRows : [{ doctype: "", documents: [] }]);
        
        // Fetch options for existing doctypes
        initialRows.forEach(row => {
          if (row.doctype) fetchDocOptions(row.doctype);
        });

      } catch (error) {
        console.error("Failed to fetch user permissions:", error);
        toast.error("Failed to load existing permissions");
      } finally {
        setLoading(false);
      }
    };

    if (userEmail && apiKey && apiSecret) {
      fetchExistingPermissions();
    }
  }, [userEmail, apiKey, apiSecret]);

  const fetchDocOptions = async (doctype: string) => {
    if (!doctype || docOptions[doctype]) return;

    try {
      const res = await axios.get(`${API_BASE_URL}/${doctype}`, {
        params: { limit_page_length: 1000, fields: JSON.stringify(["name"]) },
        headers: { Authorization: `token ${apiKey}:${apiSecret}` },
      });
      const options = res.data.data.map((d: any) => d.name);
      setDocOptions(prev => ({ ...prev, [doctype]: options }));
    } catch (error) {
      console.error(`Failed to fetch options for ${doctype}:`, error);
    }
  };

  const handleAddRow = () => {
    setRows([...rows, { doctype: "", documents: [] }]);
  };

  const handleRemoveRow = (index: number) => {
    const newRows = [...rows];
    newRows.splice(index, 1);
    setRows(newRows.length > 0 ? newRows : [{ doctype: "", documents: [] }]);
  };

  const handleDoctypeChange = (index: number, doctype: string) => {
    const newRows = [...rows];
    newRows[index].doctype = doctype;
    newRows[index].documents = []; // Clear documents if doctype changes
    setRows(newRows);
    if (doctype) fetchDocOptions(doctype);
  };

  const toggleDocumentSelection = (rowIndex: number, docName: string) => {
    const newRows = [...rows];
    const currentDocs = newRows[rowIndex].documents;
    if (currentDocs.includes(docName)) {
      newRows[rowIndex].documents = currentDocs.filter(d => d !== docName);
    } else {
      newRows[rowIndex].documents = [...currentDocs, docName];
    }
    setRows(newRows);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // Transform rows to the dictionary expected by the backend
      const permissionData: Record<string, string[]> = {};
      rows.forEach(row => {
        if (row.doctype && row.documents.length > 0) {
          permissionData[row.doctype] = row.documents;
        }
      });

      await axios.post(
        `${API_METHOD_URL}/quantlis_management.custom_api.sync_user_permissions`,
        {
          user_email: userEmail,
          permission_data: permissionData
        },
        {
          headers: { Authorization: `token ${apiKey}:${apiSecret}` }
        }
      );

      toast.success("Permissions synced successfully");
    } catch (error) {
      console.error("Failed to sync permissions:", error);
      toast.error("Failed to save permissions");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Document Level Access (User Permissions)</h3>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn btn--primary btn--sm flex items-center gap-2"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Permissions
        </button>
      </div>

      <div className="p-4 bg-gray-50/30 dark:bg-transparent">
        <div className="space-y-6">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="p-5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm transition-all hover:shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex-1 max-w-[300px]">
                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">
                            Allow
                        </label>
                        <LinkInput
                            linkTarget="DocType"
                            value={row.doctype}
                            onChange={(val) => handleDoctypeChange(rowIndex, val)}
                            placeholder="Select Doctype..."
                        />
                    </div>
                    
                    <button
                        onClick={() => handleRemoveRow(rowIndex)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-full transition-all"
                        title="Remove Rule"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>

                <div className="mt-4">
                    <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">
                      For Values
                    </label>
                    
                    {/* Selected Tags Display */}
                    <div className="flex flex-wrap gap-2 mb-2 p-2 border border-gray-200 rounded-md bg-gray-50 min-h-[40px]">
                        {row.documents.length > 0 ? (
                            <>
                                {row.documents.map((doc, docIndex) => (
                                    <div
                                        key={`${doc}-${docIndex}`}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-sky-100 text-sky-800 rounded-md text-sm"
                                    >
                                        <Tag size={14} />
                                        <span>{doc}</span>
                                        <X
                                            size={14}
                                            className="cursor-pointer hover:text-sky-600"
                                            onClick={() => toggleDocumentSelection(rowIndex, doc)}
                                        />
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    className="text-xs text-gray-500 hover:text-gray-700 self-center"
                                    onClick={() => {
                                      const newRows = [...rows];
                                      newRows[rowIndex].documents = [];
                                      setRows(newRows);
                                    }}
                                >
                                    Clear all
                                </button>
                            </>
                        ) : (
                            <span className="text-sm text-gray-400 italic px-2">
                                {row.doctype ? "No records selected. Start typing below to search..." : "Please select a Doctype first."}
                            </span>
                        )}
                    </div>

                    {/* Search Input for Documents */}
                    {row.doctype && (
                        <div className="relative">
                            <div
                                className="relative flex items-center"
                                onFocus={() => setActiveSearchIndex(rowIndex)}
                                onBlur={() => setTimeout(() => setActiveSearchIndex(null), 200)}
                            >
                                <input
                                    type="text"
                                    className="form-control w-full pr-10"
                                    placeholder={`Search ${row.doctype}...`}
                                    value={activeSearchIndex === rowIndex ? searchTerm : ""}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-400">
                                    {searchTerm && activeSearchIndex === rowIndex ? (
                                        <X
                                            className="h-4 w-4 cursor-pointer hover:text-gray-600"
                                            onClick={() => setSearchTerm("")}
                                        />
                                    ) : (
                                        <Search className="h-4 w-4" />
                                    )}
                                </div>
                            </div>

                            {/* Options Dropdown Overlay */}
                            {activeSearchIndex === rowIndex && (
                                <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                    {(docOptions[row.doctype] || [])
                                        .filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()))
                                        .slice(0, 50)
                                        .map((option) => {
                                            const isSelected = row.documents.includes(option);
                                            return (
                                                <div
                                                    key={option}
                                                    className={`px-3 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between
                                                        ${isSelected ? "bg-sky-50 text-sky-700" : "hover:bg-gray-50"}
                                                    `}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        toggleDocumentSelection(rowIndex, option);
                                                        setSearchTerm("");
                                                    }}
                                                >
                                                    <span>{option}</span>
                                                    {isSelected && (
                                                        <div className="w-4 h-4 bg-sky-600 rounded flex items-center justify-center">
                                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    {((docOptions[row.doctype] || []).filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase())).length === 0) && (
                                        <div className="px-4 py-4 text-center text-gray-500 text-sm italic">
                                            No matching records found.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleAddRow}
          className="mt-6 flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700 font-bold px-4 py-2 bg-sky-50 dark:bg-sky-900/20 rounded-lg transition-all hover:scale-105 active:scale-95"
        >
          <Plus size={18} />
          Add Access Rule
        </button>
      </div>
      
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed italic">
          <span className="font-bold not-italic">Note:</span> These permissions determine which specific records this user can view within the selected Doctypes. These are linked directly to Frappe&apos;s "User Permission" records.
        </p>
      </div>
    </div>
  );
};


