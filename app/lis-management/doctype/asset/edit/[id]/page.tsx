"use client";

import * as React from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import {
    DynamicForm,
    TabbedLayout,
    FormField,
} from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { getApiMessages } from "@/lib/utils";
import DocumentActivity from "@/components/DocumentActivity";
import {
    Loader2,
    FileText,
    LayoutGrid,
    List as ListIcon,
    Plus,
    Trash2,
    Upload,
    X,
    Eye,
    Image as ImageIcon
} from "lucide-react";

// Use RHF hooks for the custom editor component
import { useFormContext, useFieldArray } from "react-hook-form";

const FRAPPE_BASE_URL = "http://103.219.3.169:2223";
const API_BASE_URL = `${FRAPPE_BASE_URL}/api/resource`;
const API_METHOD_URL = `${FRAPPE_BASE_URL}/api/method`;

/* -------------------------------------------------
   1. Asset type
   ------------------------------------------------- */
interface AssetData {
    name: string;
    naming_series?: string;
    asset_name?: string;
    asset_category?: string;
    custom_asset_no?: string;
    // location?: string;
    custom_lis_name?: string;
    custom_stage_no?: string;
    custom_serial_number?: string;
    status?: string;
    company?: string;
    asset_owner?: string;
    asset_owner_company?: string;
    is_existing_asset?: 0 | 1;
    is_composite_asset?: 0 | 1;
    is_composite_component?: 0 | 1;
    purchase_date?: string;
    gross_purchase_amount?: number;
    asset_quantity?: number;
    calculate_depreciation?: 0 | 1;
    opening_accumulated_depreciation?: number;
    opening_number_of_booked_depreciations?: number;
    is_fully_depreciated?: 0 | 1;
    depreciation_method?: string;
    value_after_depreciation?: number;
    maintenance_required?: 0 | 1;
    custom_previous_hours?: number;
    custom_condition?: string;
    custom_pump_status?: string;
    custom_start_datetime?: string;
    custom_hours_before_system?: number;
    custom_cumulative_hours?: number;
    custom_current_hours?: number;
    docstatus: 0 | 1 | 2;
    modified: string;
    owner?: string;
    modified_by?: string;
    additional_asset_cost?: number;
    total_asset_cost?: number;

    custom_doctype_name?: string;

    policy_number?: string;
    insurance_start_date?: string;
    insurer?: string;
    insurance_end_date?: string;
    insured_value?: number;
    comprehensive_insurance?: 0 | 1;

    custodian?: string;
    department?: string;
    custom_equipement_make?: string;
    custom_equipement_model?: string;
    installation_date?: string;
    custom_equipement_capacity?: string;
    last_repair_date?: string;
    custom_equipement_rating?: string;
    custom_description?: string;
    custom_obsolete?: 0 | 1;
    available_for_use_date?: string;

    finance_books?: Array<{
        finance_book?: string;
        depreciation_method?: string;
        rate?: number;
    }>;
    custom_drawing_attachment?: Array<{
        name_of_document?: string;
        attachment?: string | File;
    }>;
    custom_asset_specifications?: Array<{
        specification_type: string;
        details: string;
    }>;
}

interface ExpenditureData {
    work_type: string;
    work_subtype: string;
    bill_amount: number;
    asset_id: string;
    work_details: string;
    expenditure_date: string;
    fiscal_year: string;
    expenditure_doc: string;
}

/* -------------------------------------------------
   2. Helper: Check if URL is image
   ------------------------------------------------- */
const isImage = (url?: string | File) => {
    if (!url) return false;
    if (url instanceof File) {
        return url.type.startsWith("image/");
    }
    const extension = url.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '');
};

/* -------------------------------------------------
   3. Custom Component: Drawing Attachment Editor
   ------------------------------------------------- */
const DrawingAttachmentEditor = () => {
    const { control, register, watch, setValue } = useFormContext();
    const { fields, append, remove } = useFieldArray({
        control,
        name: "custom_drawing_attachment"
    });

    // Toggle State: Default list view
    const [viewMode, setViewMode] = React.useState<"list" | "grid">("list");

    // Watch fields to render previews correctly
    const watchedFields = watch("custom_drawing_attachment");

    // File Handler
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (file) {
            setValue(`custom_drawing_attachment.${index}.attachment`, file, { shouldDirty: true });
        }
    };

    const handlePreview = (fileOrUrl: string | File) => {
        if (!fileOrUrl) return;
        if (fileOrUrl instanceof File) {
            const url = URL.createObjectURL(fileOrUrl);
            window.open(url, "_blank");
        } else {
            const fullUrl = fileOrUrl.startsWith("http") ? fileOrUrl : `${FRAPPE_BASE_URL}${fileOrUrl}`;
            window.open(fullUrl, "_blank");
        }
    };

    return (
        <div className="form-group" style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label className="form-label" style={{ margin: 0 }}>
                    Drawing Attachments
                </label>

                {/* Single Toggle Button */}
                <button
                    type="button"
                    className="btn btn--outline btn--sm flex items-center justify-center"
                    onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
                    title={viewMode === "grid" ? "Switch to List View" : "Switch to Grid View"}
                >
                    {viewMode === "grid" ? <ListIcon className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
                </button>
            </div>

            {/* --- LIST VIEW --- */}
            {viewMode === "list" && (
                <div className="stock-table-container">
                    <table className="stock-table child-form-table">
                        <thead>
                            <tr>
                                <th>Name of Document</th>
                                <th>Attachment</th>
                                <th style={{ width: "50px", textAlign: "center" }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {fields.map((field, index) => {
                                const attachmentValue = watchedFields?.[index]?.attachment;
                                const isFile = attachmentValue instanceof File;
                                const fileName = isFile ? attachmentValue.name : attachmentValue;

                                return (
                                    <tr key={field.id}>
                                        <td style={{ verticalAlign: "top" }}>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Document Name"
                                                {...register(`custom_drawing_attachment.${index}.name_of_document` as const)}
                                            />
                                        </td>
                                        <td style={{ verticalAlign: "top" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                {/* Upload Button */}
                                                <label className="btn btn--outline btn--sm" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                                                    <Upload size={14} />
                                                    {fileName ? "Replace" : "Upload"}
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        onChange={(e) => handleFileChange(e, index)}
                                                    />
                                                </label>

                                                {/* Filename & Preview - Pure Text with Preview Icon */}
                                                {fileName && (
                                                    <div className="flex items-center gap-2 max-w-[250px]">
                                                        <span
                                                            className="text-xs truncate text-gray-900 dark:text-gray-100"
                                                            style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}
                                                        >
                                                            {fileName}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePreview(attachmentValue)}
                                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                                            title="Preview File"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: "center", verticalAlign: "top" }}>
                                            <button
                                                type="button"
                                                onClick={() => remove(index)}
                                                className="btn btn--icon btn--danger"
                                                style={{ padding: "4px" }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        style={{ marginTop: "8px" }}
                        onClick={() => append({ name_of_document: "", attachment: null })}
                    >
                        + Add Row
                    </button>
                </div>
            )}

            {/* --- GRID VIEW (Visual Cards) --- */}
            {viewMode === "grid" && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {fields.map((field, index) => {
                        const attachmentValue = watchedFields?.[index]?.attachment;
                        const isFile = attachmentValue instanceof File;
                        const isImg = isImage(attachmentValue);

                        // Create preview URL
                        const previewUrl = isFile
                            ? URL.createObjectURL(attachmentValue)
                            : attachmentValue?.startsWith("http")
                                ? attachmentValue
                                : `${FRAPPE_BASE_URL}${attachmentValue}`;

                        return (
                            <div key={field.id} className="group relative border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900 hover:shadow-md transition-all">
                                {/* Remove Button */}
                                <button
                                    type="button"
                                    onClick={() => remove(index)}
                                    className="absolute top-1 right-1 z-10 bg-white/80 dark:bg-black/60 text-red-500 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                                >
                                    <X size={14} />
                                </button>

                                {/* Image/Icon Preview Area */}
                                <div
                                    className="h-32 w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 overflow-hidden relative cursor-pointer"
                                    onClick={() => attachmentValue && handlePreview(attachmentValue)}
                                >
                                    {attachmentValue ? (
                                        isImg ? (
                                            <img
                                                src={previewUrl}
                                                alt="Preview"
                                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                            />
                                        ) : (
                                            <FileText size={40} className="text-gray-400" />
                                        )
                                    ) : (
                                        <div className="flex flex-col items-center text-gray-400 pointer-events-none">
                                            <ImageIcon size={24} className="mb-1 opacity-50" />
                                            <span className="text-[10px]">No File</span>
                                        </div>
                                    )}

                                    {/* Upload Overlay */}
                                    <label className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center cursor-pointer">
                                        <div className="bg-white dark:bg-black text-xs px-3 py-1.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity font-medium flex items-center gap-1">
                                            <Upload size={12} /> {attachmentValue ? "Change" : "Upload"}
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            onClick={(e) => e.stopPropagation()} // Prevent preview click
                                            onChange={(e) => handleFileChange(e, index)}
                                        />
                                    </label>
                                </div>

                                {/* Input Area */}
                                <div className="p-2 border-t border-gray-200 dark:border-gray-800">
                                    <input
                                        type="text"
                                        className="w-full bg-transparent border-none text-xs font-medium focus:ring-0 p-0 placeholder:text-gray-400 focus:outline-none"
                                        placeholder="Document Name..."
                                        {...register(`custom_drawing_attachment.${index}.name_of_document` as const)}
                                    />
                                    {/* Filename display */}
                                    <div className="mt-1 text-[10px] text-gray-400 truncate flex items-center gap-1 h-4">
                                        {isFile ? attachmentValue.name : (attachmentValue || "No file selected")}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Add New Card (Grid Mode) */}
                    <button
                        type="button"
                        onClick={() => append({ name_of_document: "", attachment: null })}
                        className="flex flex-col items-center justify-center h-full min-h-[180px] border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all text-gray-400 hover:text-blue-500"
                    >
                        <Plus size={32} />
                        <span className="text-xs font-medium mt-2">Add New</span>
                    </button>
                </div>
            )}
        </div>
    );
};


/* -------------------------------------------------
   4. Helper: Upload File
   ------------------------------------------------- */
async function uploadFile(
    file: File,
    apiKey: string,
    apiSecret: string,
    methodUrl: string
): Promise<string> {
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("is_private", "0");

    try {
        const resp = await axios.post(
            `${methodUrl.replace("/api/resource", "")}/api/method/upload_file`,
            formData,
            {
                headers: { Authorization: `token ${apiKey}:${apiSecret}` },
                withCredentials: true,
            }
        );

        if (resp.data && resp.data.message) {
            return resp.data.message.file_url;
        } else {
            throw new Error("Invalid response from file upload");
        }
    } catch (err) {
        console.error("File upload failed:", err);
        throw err;
    }
}

/* -------------------------------------------------
   5. Main Page Component
   ------------------------------------------------- */
export default function RecordDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

    const docname = params.id as string;
    const doctypeName = "Asset";

    const [asset, setAsset] = React.useState<AssetData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    // 🟢 Track which button to show (SAME AS LOGBOOK)
    const [activeButton, setActiveButton] = React.useState<"SAVE" | "SUBMIT" | "CANCEL" | null>(null);
    const [formDirty, setFormDirty] = React.useState(false);
    const [formInstance, setFormInstance] = React.useState<any>(null);
    const isProgrammaticUpdate = React.useRef(false);
    const [formVersion, setFormVersion] = React.useState(0);

    // Expenditure State
    const [expenditureList, setExpenditureList] = React.useState<ExpenditureData[]>([]);
    const [expenditureLoading, setExpenditureLoading] = React.useState(false);

    /* --- Fetch Asset --- */
    React.useEffect(() => {
        const fetchAsset = async () => {
            if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret || !docname) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const resp = await axios.get(`${API_BASE_URL}/${doctypeName}/${docname}`, {
                    headers: {
                        Authorization: `token ${apiKey}:${apiSecret}`,
                        "Content-Type": "application/json",
                    },
                    withCredentials: true,
                });

                const data = resp.data.data;
                setAsset(data);

                // Initialize button state based on document status (SAME AS LOGBOOK)
                if (data.docstatus === 0) {
                    // Draft
                    setActiveButton("SUBMIT");
                } else if (data.docstatus === 1) {
                    // Submitted
                    setActiveButton("CANCEL");
                }

                setFormDirty(false);
            } catch (err: any) {
                console.error("API Error:", err);
                setError(
                    err.response?.status === 404
                        ? "Asset not found"
                        : "Failed to load asset"
                );
            } finally {
                setLoading(false);
            }
        };

        fetchAsset();
    }, [docname, apiKey, apiSecret, isAuthenticated, isInitialized]);

    // 🟢 Watch for form changes (SAME AS LOGBOOK)
    React.useEffect(() => {
        if (!formInstance) return;

        const subscription = formInstance.watch((value: any, { name }: { name?: string }) => {
            // Watch for form changes to mark as dirty
            if (name && !isProgrammaticUpdate.current) {
                setFormDirty(true);
                // When form becomes dirty, show SAVE button
                if (asset?.docstatus === 0) {
                    setActiveButton("SAVE");
                }
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [formInstance, asset]);

    const handleFormInit = React.useCallback((form: any) => {
        setFormInstance(form);
    }, []);

    // 🟢 Badge Status Logic (LIKE LOGBOOK)
    const getCurrentStatus = () => {
        if (!asset) return "";

        // 1. If Cancelled
        if (asset.docstatus === 2) return "Cancelled";

        // 2. If Submitted (Show status)
        if (asset.docstatus === 1) {
            return asset.status || "Submitted";
        }

        // 3. If Draft (docstatus === 0)
        if (asset.docstatus === 0) {
            if (formDirty) {
                return "Not Saved";
            }
            return "Draft";
        }

        return "";
    };

    /* --- Fetch Expenditure --- */
    React.useEffect(() => {
        const fetchExpenditure = async () => {
            if (!asset || !apiKey || !apiSecret) return;

            const targetName = asset.custom_doctype_name || asset.name;
            if (!targetName) return;

            try {
                setExpenditureLoading(true);
                const methodPath = "quantlis_management.quantlis_utils.get_expenditure_details_for_asset";
                const url = `${API_METHOD_URL}/${methodPath}`;

                const expResp = await axios.get(url, {
                    params: { custom_doctype_name: targetName },
                    headers: { Authorization: `token ${apiKey}:${apiSecret}` },
                    withCredentials: true,
                });

                if (expResp.data.message) {
                    setExpenditureList(expResp.data.message);
                } else {
                    setExpenditureList([]);
                }
            } catch (expErr) {
                console.error("Failed to fetch expenditure details", expErr);
            } finally {
                setExpenditureLoading(false);
            }
        };

        fetchExpenditure();
    }, [asset, apiKey, apiSecret]);

    /* --- Expenditure Table (Read Only) --- */
    const ExpenditureTableComponent = React.useMemo(() => {
        return (
            <div className="form-group" style={{ marginTop: "1rem" }}>
                <label className="form-label" style={{ fontWeight: 600, marginBottom: "8px", display: "block" }}>
                    Expenditure History
                </label>

                <div
                    className="stock-table-container"
                    style={{
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-base)",
                        overflow: "hidden",
                        backgroundColor: "var(--color-surface)"
                    }}
                >
                    {expenditureLoading ? (
                        <div style={{ padding: "2rem", textAlign: "center" }}>
                            <Loader2 className="animate-spin w-5 h-5 mx-auto mb-2 text-gray-500" />
                            <span className="text-sm text-gray-500">Loading...</span>
                        </div>
                    ) : expenditureList.length > 0 ? (
                        <table className="stock-table">
                            <thead>
                                <tr>
                                    <th style={{ textAlign: "left", width: "15%" }}>Work Type</th>
                                    <th style={{ textAlign: "left", width: "15%" }}>Subtype</th>
                                    <th style={{ textAlign: "left", width: "30%" }}>Details</th>
                                    <th style={{ textAlign: "center", width: "12%" }}>Date</th>
                                    <th style={{ textAlign: "right", width: "15%" }}>Amount</th>
                                    <th style={{ textAlign: "center", width: "13%" }}>Year</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenditureList.map((row, idx) => (
                                    <tr key={idx}>
                                        <td style={{ textAlign: "left", verticalAlign: "top" }}>{row.work_type}</td>
                                        <td style={{ textAlign: "left", verticalAlign: "top" }}>{row.work_subtype}</td>
                                        <td title={row.work_details} style={{ textAlign: "left", verticalAlign: "top", maxWidth: "250px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {row.work_details}
                                        </td>
                                        <td style={{ textAlign: "center", verticalAlign: "top" }}>
                                            {row.expenditure_date ? new Date(row.expenditure_date).toLocaleDateString("en-IN") : "-"}
                                        </td>
                                        <td style={{ textAlign: "right", verticalAlign: "top", fontWeight: 500 }}>
                                            {row.expenditure_doc ? (
                                                <a
                                                    href={`${FRAPPE_BASE_URL}/app/expenditure/${row.expenditure_doc}`}
                                                    target="_blank"
                                                    style={{ color: "var(--color-primary)", textDecoration: "none" }}
                                                >
                                                    ₹ {row.bill_amount?.toLocaleString("en-IN")}
                                                </a>
                                            ) : (
                                                `₹ ${row.bill_amount?.toLocaleString("en-IN")}`
                                            )}
                                        </td>
                                        <td style={{ textAlign: "center", verticalAlign: "top" }}>{row.fiscal_year}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ padding: "2rem", textAlign: "center", opacity: 0.7 }}>
                            <FileText size={20} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No expenditure records found</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }, [expenditureList, expenditureLoading]);

    /* -------------------------------------------------
       6. Form Configuration
       ------------------------------------------------- */
    const formTabs: TabbedLayout[] = React.useMemo(() => {
        if (!asset) return [];

        const fields = (list: FormField[]): FormField[] =>
            list.map((f) => ({
                ...f,
                defaultValue:
                    f.name in asset
                        ? // @ts-ignore
                        asset[f.name as keyof AssetData]
                        : f.defaultValue,
            }));

        return [
            {
                name: "Details",
                fields: fields([
                    { name: "asset_name", label: "Asset Name", type: "Text", required: true },
                    // { name: "company", label: "Company", type: "Link", required: true, linkTarget: "Company" },D
                    { name: "asset_category", label: "Asset Category", type: "Link", linkTarget: "Asset Category" },
                    { name: "custom_asset_no", label: "Asset No", type: "Data" },
                    { name: "custom_lis_name", label: "Lift Irrigation Scheme", required: true, type: "Link", linkTarget: "Lift Irrigation Scheme" },

                    { name: "custom_stage_no", label: "Stage No.", type: "Link", required: true, linkTarget: "Stage No" },
                    { name: "location", label: "Location", type: "Link", required: true, linkTarget: "Location" },
                    { name: "custom_serial_number", label: "Serial Number", type: "Data" },



                    {
                        name: "is_existing_asset",
                        label: "Is Existing Asset",
                        type: "Check",
                        displayDependsOn: "is_composite_asset==0 && is_composite_component==0 && custom_obsolete==0",
                    },
                    {
                        name: "is_composite_asset",
                        label: "Is Composite Asset",
                        type: "Check",
                        displayDependsOn: "is_existing_asset==0 && is_composite_component==0 && custom_obsolete==0",
                    },
                    {
                        name: "is_composite_component",
                        label: "Is Composite Component",
                        type: "Check",
                        displayDependsOn: "is_composite_asset==0 && is_existing_asset==0 && custom_obsolete==0",
                    },
                    {
                        name: "custom_obsolete",
                        label: "Is Obsolete",
                        type: "Check",
                        displayDependsOn: "is_composite_asset==0 && is_existing_asset==0 && is_composite_component==0",
                    },
                    { name: "section_interchange", label: "Interchange Details", type: "Section Break" },
                    {
                        name: "custom_current_linked_asset",
                        label: "Current Linked Motor/Pump",
                        type: "Link",
                        linkTarget: "Asset",
                        customSearchUrl: "http://103.219.3.169:2223/api/method/frappe.desk.search.search_link",
                        filters: (getValue) => {
                            const filters: Record<string, any> = {};
                            const stageNo = getValue("custom_stage_no");
                            const lisName = getValue("custom_lis_name");

                            if (stageNo) filters.custom_stage_no = stageNo;
                            if (lisName) filters.custom_lis_name = lisName;

                            return filters;
                        },
                        referenceDoctype: "Asset",
                        doctype: "Asset",
                    },
                    {
                        name: "custom_linked_asset_no",
                        label: "Linked Asset No",
                        type: "Data",
                        fetchFrom: { sourceField: "custom_current_linked_asset", targetDoctype: "Asset", targetField: "custom_asset_no" }
                    },
                    {
                        name: "custom_interchange_date",
                        label: "Interchange Date",
                        type: "Date"
                    },
                    { name: "section_purchase", label: "Purchase Details", type: "Section Break" },
                    {
                        name: "purchase_date",
                        label: "Purchase Date",
                        type: "Date",
                        required: true,
                        displayDependsOn: "is_existing_asset==1 || is_composite_asset==1",
                    },
                    { name: "net_purchase_amount", label: "Net Purchase Amount", type: "Currency", required: true },
                    { name: "asset_quantity", label: "Asset Quantity", type: "Int", min: 1 },
                    {
                        name: "available_for_use_date",
                        label: "Commisioning Date",
                        type: "Date",
                        displayDependsOn: "is_existing_asset==1 || is_composite_asset==1",
                    },
                    // Expenditure Table
                    { name: "section_expenditure", label: "Expenditure Information", type: "Section Break" },
                    {
                        name: "expenditure_table_display",
                        label: "",
                        type: "Custom",
                        customElement: ExpenditureTableComponent
                    }
                ]),
            },

            {
                name: "Insurance",
                fields: fields([
                    { name: "policy_number", label: "Policy number", type: "Data" },
                    { name: "insurance_start_date", label: "Insurance Start Date", type: "Date" },
                    { name: "insurer", label: "Insurer", type: "Data" },
                    { name: "insurance_end_date", label: "Insurance End Date", type: "Date" },
                    { name: "insured_value", label: "Insured value", type: "Currency" },
                    { name: "comprehensive_insurance", label: "Comprehensive Insurance", type: "Check" },
                ]),
            },
            {
                name: "Other Info",
                fields: fields([
                    { name: "custodian", label: "Custodian", type: "Link", linkTarget: "Employee" },
                    { name: "department", label: "Department", type: "Link", linkTarget: "Department" },
                    { name: "installation_date", label: "Installation Date", type: "Date" },
                    { name: "custom_equipement_make", label: "Equipement Make", type: "Link", linkTarget: "Equipement Make" },
                    { name: "custom_equipement_model", label: "Equipement Model", type: "Link", linkTarget: "Equipement Model" },
                    { name: "last_repair_date", label: "Last Repair Date", type: "Date" },
                    { name: "custom_equipement_capacity", label: "Equipement Capacity", type: "Link", linkTarget: "Equipement Capacity" },
                    { name: "custom_equipement_rating", label: "Equipement Rating", type: "Link", linkTarget: "Rating" },
                    {
                        name: "custom_condition",
                        label: "Condition",
                        type: "Select",
                        options: [{ label: "Working", value: "Working" }, { label: "Under Repair", value: "Under Repair", }],
                    },
                    { name: "custom_previous_hours", label: "Previous Running Hours", type: "Float" },
                    { name: "custom_hours_before_system", label: "Hours Before System", type: "Float" },
                    { name: "custom_cumulative_hours", label: "Cumulative Hours", type: "Float" },
                    { name: "maintenance_required", label: "Maintenance Required", type: "Check" },
                    { name: "section_specifications", label: "Specification of Asset", type: "Section Break" },
                    {
                        name: "custom_asset_specifications",
                        label: "Asset Specifications",
                        type: "Table",
                        columns: [
                            { name: "specification_type", label: "Specification Type", type: "Link", linkTarget: "Specifications" },
                            { name: "details", label: "Details", type: "Read Only" },
                        ],

                        fetchFrom: {
                            sourceField: "asset_category",
                            targetDoctype: "Asset Category",
                            targetField: "custom_specifications"
                        },
                    },
                ]),
            },
            {
                name: "Drawing Attachment",
                fields: fields([
                    // 🟢 Replaced standard Table with Custom DrawingAttachmentEditor
                    {
                        name: "custom_drawing_attachment",
                        label: "",
                        type: "Custom",
                        customElement: <DrawingAttachmentEditor />
                    },
                ]),
            },
        ];
    }, [asset, ExpenditureTableComponent]);

    /* -------------------------------------------------
       7. SUBMIT
       ------------------------------------------------- */
    // 🟢 SAVE (UPDATE) DOCUMENT (SAME AS LOGBOOK)
    const handleSubmit = async (data: Record<string, any>, isDirty: boolean) => {
        if (!isDirty && !formDirty) {
            toast.info("No changes to save.");
            return;
        }

        if (!asset) {
            toast.error("Record not loaded. Cannot save.", { duration: Infinity });
            return;
        }

        setIsSaving(true);
        isProgrammaticUpdate.current = true;
        try {
            const doctypeName = "Asset";
            const docname = params.id as string;

            let finalPayload = { ...data };

            if (!asset) {
                alert("Error: Asset data not loaded. Cannot save.");
                setIsSaving(false);
                return;
            }
            finalPayload.modified = asset.modified;
            finalPayload.docstatus = asset.docstatus;

            const boolFields = [
                "is_existing_asset", "is_composite_asset", "is_composite_component",
                "calculate_depreciation", "is_fully_depreciated",
                "maintenance_required", "comprehensive_insurance", "custom_obsolete",
            ];
            boolFields.forEach((f) => {
                if (f in finalPayload) finalPayload[f] = finalPayload[f] ? 1 : 0;
            });

            const numericFields = [
                "gross_purchase_amount", "additional_asset_cost", "total_asset_cost",
                "asset_quantity", "opening_accumulated_depreciation",
                "opening_number_of_booked_depreciations", "value_after_depreciation",
                "custom_previous_hours", "insured_value", "custom_hours_before_system",
                "custom_cumulative_hours", "custom_current_hours"
            ];
            numericFields.forEach((f) => {
                finalPayload[f] = Number(finalPayload[f]) || 0;
            });

            delete finalPayload.naming_series;

            const resp = await axios.put(`${API_BASE_URL}/${doctypeName}/${docname}`, finalPayload, {
                headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                    "Content-Type": "application/json",
                },
                withCredentials: true,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            });

            const messages = getApiMessages(resp, null, "Changes saved!", "Failed to save");
            if (messages.success) {
                toast.success(messages.message, { description: messages.description });
            } else {
                toast.error(messages.message, { description: messages.description, duration: Infinity });
            }

            if (resp.data && resp.data.data) {
                // Update state with new data
                const updatedData = resp.data.data as AssetData;
                setAsset(updatedData);
                setFormDirty(false);

                // Update button state after save
                if (updatedData.docstatus === 0) {
                    // Still draft
                    setActiveButton("SUBMIT");
                }

                // Force form remount
                setFormVersion((v) => v + 1);
            }
        } catch (err: any) {
            console.error("Save error:", err);

            const messages = getApiMessages(
                null,
                err,
                "Changes saved!",
                "Failed to save",
                (error) => {
                    if (error.response?.status === 404) return "Asset not found";
                    if (error.response?.status === 403) return "Unauthorized";
                    if (error.response?.status === 417) return "Expectation Failed";
                    return "Failed to save";
                }
            );

            if (!messages.success) {
                toast.error(messages.message, { description: messages.description, duration: Infinity });
            }
            return { status: asset?.status };
        } finally {
            setIsSaving(false);
            // Reset programmatic update flag with a small delay (LIKE LOGBOOK)
            // to ensure mount-time form events are ignored
            setTimeout(() => {
                isProgrammaticUpdate.current = false;
            }, 100);
        }
    };

    // 🟢 SUBMIT DOCUMENT (SAME AS LOGBOOK)
    const handleSubmitDocument = async () => {
        if (!asset) return;

        setIsSaving(true);

        try {
            // Prepare payload similar to handleSubmit
            const payload: Record<string, any> = { ...asset };

            // Set docstatus to 1 (submitted)
            payload.docstatus = 1;

            const response = await axios.put(
                `${API_BASE_URL}/${doctypeName}/${docname}`,
                payload,
                {
                    headers: {
                        Authorization: `token ${apiKey}:${apiSecret}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            toast.success("Document submitted successfully!");

            // Update local state without reload
            const updatedData = response.data.data as AssetData;
            setAsset(updatedData);
            setFormDirty(false);

            // Update button to CANCEL after submission
            setActiveButton("CANCEL");

            // Force form remount with new docstatus
            setFormVersion((v) => v + 1);
        } catch (err: any) {
            console.error("Submit error:", err);

            const messages = getApiMessages(
                null,
                err,
                "Document submitted successfully!",
                "Failed to submit document",
                (error) => {
                    if (error.response?.status === 404) return "Document not found";
                    if (error.response?.status === 403) return "Unauthorized";
                    if (error.response?.status === 417) return "Expectation Failed";
                    return "Failed to submit document";
                }
            );

            if (!messages.success) {
                toast.error(messages.message, { description: messages.description, duration: Infinity });
            }
        } finally {
            setIsSaving(false);
        }
    };

    // 🟢 CANCEL DOCUMENT (SAME AS LOGBOOK)
    const handleCancelDocument = async () => {
        if (!asset) return;

        if (!window.confirm(`Are you sure you want to cancel this ${doctypeName}? This action cannot be undone.`)) {
            return;
        }

        setIsSaving(true);

        try {
            const payload = {
                docstatus: 2,
                modified: asset.modified,
            };

            const resp = await axios.put(
                `${API_BASE_URL}/${doctypeName}/${docname}`,
                payload,
                {
                    headers: {
                        Authorization: `token ${apiKey}:${apiSecret}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            toast.success("Document cancelled successfully!");

            // Update local state without reload
            const updatedRecord = resp.data.data as AssetData;
            setAsset(updatedRecord);
            setActiveButton(null); // Remove cancel button after cancellation
        } catch (err: any) {
            console.error("Cancel error:", err);

            const messages = getApiMessages(
                null,
                err,
                "Document cancelled successfully!",
                "Failed to cancel document",
                (error) => {
                    if (error.response?.status === 404) return "Document not found";
                    if (error.response?.status === 403) return "Unauthorized";
                    if (error.response?.status === 417) return "Expectation Failed";
                    return "Failed to cancel document";
                }
            );

            if (!messages.success) {
                toast.error(messages.message, { description: messages.description, duration: Infinity });
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => router.push('/lis-management/doctype/asset');

    /* -------------------------------------------------
       8. DUPLICATE
       ------------------------------------------------- */
    const handleDuplicate = React.useCallback(() => {
        if (!asset) {
            toast.error("Asset data not loaded. Cannot duplicate.", { duration: Infinity });
            return;
        }
        const duplicateData: Record<string, any> = {};
        const excludeFields = [
            'name', 'naming_series', 'docstatus', 'modified', 'creation',
            'owner', 'modified_by', 'idx', 'status'
        ];
        Object.keys(asset).forEach(key => {
            if (!excludeFields.includes(key) && asset[key as keyof AssetData] !== undefined) {
                duplicateData[key] = asset[key as keyof AssetData];
            }
        });
        const encodedData = btoa(JSON.stringify(duplicateData));
        router.push(`/lis-management/doctype/asset/new?duplicate=${encodeURIComponent(encodedData)}`);
    }, [asset, router]);

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.shiftKey && event.key.toLowerCase() === 'd') {
                // Prevent when typing in inputs / textareas / contenteditable
                const el = event.target as HTMLElement;
                const tag = el.tagName.toLowerCase();

                if (
                    tag === 'input' ||
                    tag === 'textarea' ||
                    tag === 'select' ||
                    el.isContentEditable
                ) {
                    return;
                }

                event.preventDefault();
                handleDuplicate();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleDuplicate]);

    /* -------------------------------------------------
       9. UI STATES
       ------------------------------------------------- */
    if (loading) {
        return (
            <div className="module active" style={{ padding: "2rem", textAlign: "center" }}>
                <p>Loading asset details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="module active" style={{ padding: "2rem" }}>
                <p style={{ color: "var(--color-error)" }}>{error}</p>
                <button className="btn btn--primary" onClick={() => window.location.reload()}>
                    Retry
                </button>
            </div>
        );
    }

    if (!asset) {
        return (
            <div className="module active" style={{ padding: "2rem" }}>
                <p>Asset not found.</p>
            </div>
        );
    }

    // Determine submit label based on active button (SAME AS LOGBOOK)
    const getSubmitLabel = () => {
        if (isSaving) {
            switch (activeButton) {
                case "SAVE":
                    return "Saving...";
                case "SUBMIT":
                    return "Submitting...";
                case "CANCEL":
                    return "Cancelling...";
                default:
                    return "Processing...";
            }
        }

        switch (activeButton) {
            case "SAVE":
                return "Save";
            case "SUBMIT":
                return "Submit";
            case "CANCEL":
                return "Cancel";
            default:
                return undefined;
        }
    };

    const isSubmitted = asset.docstatus === 1;
    const isDraft = asset.docstatus === 0;
    const formKey = `${asset.name}-${asset.docstatus}-${formVersion}`;

    /* -------------------------------------------------
       10. RENDER FORM (SAME AS LOGBOOK)
       ------------------------------------------------- */
    return (
        <div className="space-y-6 pb-24 bg-gray-50/30 min-h-screen">
            <DynamicForm
                key={formKey}
                tabs={formTabs}
                onSubmit={activeButton === "SAVE" ? handleSubmit : async () => { }}
                onSubmitDocument={activeButton === "SUBMIT" ? handleSubmitDocument : undefined}
                onCancelDocument={activeButton === "CANCEL" ? handleCancelDocument : undefined}
                onCancel={handleCancel}
                title={`${asset.name}`}
                description={`Status: ${asset?.status || 'Unknown'}`}
                submitLabel={getSubmitLabel()}
                cancelLabel="Cancel"
                initialStatus={getCurrentStatus()}
                docstatus={asset.docstatus}
                isSubmittable={activeButton === "SUBMIT" || asset.docstatus === 1}
                onFormInit={handleFormInit}
                deleteConfig={{
                    doctypeName: doctypeName,
                    docName: docname,
                    redirectUrl: "/lis-management/doctype/asset"
                }}
            />

            <div className="w-full px-4 md:px-8">
                <DocumentActivity
                    doctype={doctypeName}
                    docname={docname}
                    baseUrl={FRAPPE_BASE_URL}
                    apiKey={apiKey || ""}
                    apiSecret={apiSecret || ""}
                    isInitialized={isInitialized}
                    currentUserEmail={asset.owner}
                    modifiedStr={asset.modified}
                    modifiedBy={asset.modified_by}
                />
            </div>
        </div>
    );
}
