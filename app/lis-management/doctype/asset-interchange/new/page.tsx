"use client";

import * as React from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { DynamicForm, TabbedLayout } from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

interface AssetInterchangeData {
    name?: string;
    lis_name?: string;
    stage?: string;
    posting_date?: string;
    select_asset?: "Motor" | "Pump";

    // Motor fields
    pump_asset?: string;
    pump_no?: string;
    pump_serial_no?: string;
    current_motor_asset?: string;
    current_motor_no?: string;
    current_motor_serial_no?: string;
    interchange_motor?: string;
    interchange_motor_no?: string;
    interchange_motor_serial_no?: string;

    // Pump fields
    motor_asset?: string;
    motor_no?: string;
    motor_serial_no?: string;
    current_pump_asset?: string;
    current_pump_no?: string;
    current_pump_serial_no?: string;
    interchange_pump?: string;
    interchange_pump_no?: string;
    interchange_pump_serial_no?: string;
}

export default function NewAssetInterchangePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
    const doctypeName = "Asset Interchange";

    const [isSaving, setIsSaving] = React.useState(false);

    const duplicateData: AssetInterchangeData | null = React.useMemo(() => {
        const duplicateParam = searchParams.get("duplicate");
        if (!duplicateParam) return null;

        try {
            const decodedData = JSON.parse(atob(decodeURIComponent(duplicateParam)));
            return decodedData;
        } catch (error) {
            console.error("Error parsing duplicate data:", error);
            toast.error("Invalid duplicate data provided.");
            return null;
        }
    }, [searchParams]);

    const notificationShown = React.useRef(false);
    React.useEffect(() => {
        if (duplicateData && !notificationShown.current) {
            toast.success("Form pre-filled with duplicate data. Please review and save.");
            notificationShown.current = true;
        }
    }, [duplicateData]);

    const [selectedAsset, setSelectedAsset] = React.useState<"Motor" | "Pump" | "">(
        duplicateData?.select_asset || ""
    );

    const handleAssetChange = (value: "Motor" | "Pump") => {
        setSelectedAsset(value);
    };


    const formTabs: TabbedLayout[] = React.useMemo(() => {
        const getValue = (fieldName: keyof AssetInterchangeData, defaultValue: any = undefined) =>
            duplicateData?.[fieldName] ?? defaultValue;

        return [
            {
                name: "Details",
                fields: [
                    // ROW 1: Only Posting Date (1/3rd width, followed by two empty columns)
                    { type: "Section Break", layoutCols: 3, name: "layout_section", label: "" },
                    {
                        name: "posting_date",
                        label: "Posting Date",
                        type: "Date",
                        defaultValue: getValue("posting_date"),
                    },
                    { type: "Column Break", name: "cb_1", label: "" },
                    { type: "Column Break", name: "cb_2", label: "" },

                    // ROW 2: LIS Name, Stage, and Which Asset To Interchange
                    { type: "Section Break", name: "sb_details", label: "Details" },
                    {
                        name: "lis_name",
                        label: "LIS Name",
                        type: "Link",
                        linkTarget: "Lift Irrigation Scheme",
                        defaultValue: getValue("lis_name"),
                    },
                    {
                        name: "stage",
                        label: "Stage",
                        type: "Link",
                        linkTarget: "Stage No",
                        defaultValue: getValue("stage"),
                        filterMapping: [{ sourceField: "lis_name", targetField: "lis_name" }],
                    },
                    {
                        name: "select_asset",
                        label: "Which Asset To Interchange?",
                        type: "Select",
                        options: [
                            { label: "Motor", value: "Motor" },
                            { label: "Pump", value: "Pump" },
                        ],
                        defaultValue: getValue("select_asset"),
                        onChange: handleAssetChange,
                    },

                    // INTERCHANGE MOTOR SECTION
                    {
                        name: "motor_section",
                        type: "Section Break",
                        label: "Interchange Motor",
                        displayDependsOn: { select_asset: "Motor" },
                    },
                    // Motor Row 1: Pump Asset, Pump No, Pump Serial No.
                    {
                        name: "pump_asset",
                        label: "Pump Asset",
                        type: "Link",
                        linkTarget: "Asset",
                        displayDependsOn: { select_asset: "Motor" },
                        filters: (getValue) => ({
                            custom_lis_name: getValue("lis_name"),
                            custom_stage_no: getValue("stage"),
                            asset_category: "Pump"
                        }),
                    },
                    {
                        name: "pump_no",
                        label: "Pump No",
                        type: "Read Only",
                        fetchFrom: { sourceField: "pump_asset", targetDoctype: "Asset", targetField: "custom_asset_no" },
                        displayDependsOn: { select_asset: "Motor" },
                    },
                    {
                        name: "pump_serial_no",
                        label: "Pump Serial No.",
                        type: "Data",
                        displayDependsOn: { select_asset: "Motor" },
                    },

                    // Motor Row 2: Current Motor Asset, Current Motor No, Current Motor Serial No.
                    { type: "Section Break", name: "sb_motor_row_2", label: "", displayDependsOn: { select_asset: "Motor", pump_asset: true } },
                    {
                        name: "current_motor_asset",
                        label: "Current Motor Asset",
                        type: "Read Only",
                        displayDependsOn: { select_asset: "Motor", pump_asset: true },
                        fetchFrom: { sourceField: "pump_asset", targetDoctype: "Asset", targetField: "custom_current_linked_asset" },
                    },
                    {
                        name: "current_motor_no",
                        label: "Current Motor No",
                        type: "Read Only",
                        displayDependsOn: { select_asset: "Motor", pump_asset: true },
                        fetchFrom: { sourceField: "pump_asset", targetDoctype: "Asset", targetField: "custom_linked_asset_no" },
                    },
                    {
                        name: "current_motor_serial_no",
                        label: "Current Motor Serial No.",
                        type: "Data",
                        displayDependsOn: { select_asset: "Motor", pump_asset: true },
                    },

                    // Motor Row 3: Interchange Motor, Interchange Motor No, Interchange Motor Serial No.
                    { type: "Section Break", name: "sb_motor_row_3", label: "", displayDependsOn: { select_asset: "Motor", pump_asset: true } },
                    {
                        name: "interchange_motor",
                        label: "Interchange Motor",
                        type: "Link",
                        linkTarget: "Asset",
                        displayDependsOn: { select_asset: "Motor", pump_asset: true },
                        filters: (getValue) => ({
                            custom_lis_name: getValue("lis_name"),
                            custom_stage_no: getValue("stage"),
                            asset_category: "Motor"
                        }),
                    },
                    {
                        name: "interchange_motor_no",
                        label: "Interchange Motor No",
                        type: "Read Only",
                        displayDependsOn: { select_asset: "Motor", pump_asset: true },
                        fetchFrom: { sourceField: "interchange_motor", targetDoctype: "Asset", targetField: "custom_asset_no" },
                    },
                    {
                        name: "interchange_motor_serial_no",
                        label: "Interchange Motor Serial No.",
                        type: "Data",
                        displayDependsOn: { select_asset: "Motor", pump_asset: true },
                    },

                    // INTERCHANGE PUMP SECTION (Mirrored Layout)
                    {
                        name: "pump_section",
                        type: "Section Break",
                        label: "Interchange Pump",
                        displayDependsOn: { select_asset: "Pump" },
                    },
                    // Pump Row 1: Motor Asset, Motor No, Motor Serial No.
                    {
                        name: "motor_asset",
                        label: "Motor Asset",
                        type: "Link",
                        linkTarget: "Asset",
                        displayDependsOn: { select_asset: "Pump" },
                        filters: (getValue) => ({
                            custom_lis_name: getValue("lis_name"),
                            custom_stage_no: getValue("stage"),
                            asset_category: "Motor"
                        }),
                    },
                    {
                        name: "motor_no",
                        label: "Motor No",
                        type: "Read Only",
                        fetchFrom: { sourceField: "motor_asset", targetDoctype: "Asset", targetField: "custom_asset_no" },
                        displayDependsOn: { select_asset: "Pump" },
                    },
                    {
                        name: "motor_serial_no",
                        label: "Motor Serial No.",
                        type: "Data",
                        displayDependsOn: { select_asset: "Pump" },
                    },

                    // Pump Row 2: Current Pump Asset, Current Pump No, Current Pump Serial No.
                    { type: "Section Break", name: "sb_pump_row_2", label: "", displayDependsOn: { select_asset: "Pump", motor_asset: true } },
                    {
                        name: "current_pump_asset",
                        label: "Current Pump Asset",
                        type: "Read Only",
                        displayDependsOn: { select_asset: "Pump", motor_asset: true },
                        fetchFrom: { sourceField: "motor_asset", targetDoctype: "Asset", targetField: "custom_current_linked_asset" },
                    },
                    {
                        name: "current_pump_no",
                        label: "Current Pump No",
                        type: "Read Only",
                        displayDependsOn: { select_asset: "Pump", motor_asset: true },
                        fetchFrom: { sourceField: "motor_asset", targetDoctype: "Asset", targetField: "custom_linked_asset_no" },
                    },
                    {
                        name: "current_pump_serial_no",
                        label: "Current Pump Serial No.",
                        type: "Data",
                        displayDependsOn: { select_asset: "Pump", motor_asset: true },
                    },

                    // Pump Row 3: Interchange Pump, Interchange Pump No, Interchange Pump Serial No.
                    { type: "Section Break", name: "sb_pump_row_3", label: "", displayDependsOn: { select_asset: "Pump", motor_asset: true } },
                    {
                        name: "interchange_pump",
                        label: "Interchange Pump",
                        type: "Link",
                        linkTarget: "Asset",
                        displayDependsOn: { select_asset: "Pump", motor_asset: true },
                        filters: (getValue) => ({
                            custom_lis_name: getValue("lis_name"),
                            custom_stage_no: getValue("stage"),
                            asset_category: "Pump"
                        }),
                    },
                    {
                        name: "interchange_pump_no",
                        label: "Interchange Pump No",
                        type: "Read Only",
                        displayDependsOn: { select_asset: "Pump", motor_asset: true },
                        fetchFrom: { sourceField: "interchange_pump", targetDoctype: "Asset", targetField: "custom_asset_no" },
                    },
                    {
                        name: "interchange_pump_serial_no",
                        label: "Interchange Pump Serial No.",
                        type: "Data",
                        displayDependsOn: { select_asset: "Pump", motor_asset: true },
                    },
                ],
            },
        ];
    }, [duplicateData, selectedAsset]);

    const handleSubmit = async (data: Record<string, any>) => {
        if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) {
            toast.error("Authentication required. Please log in.");
            return;
        }

        if (!data.select_asset) {
            toast.info("Please select Which Asset To Interchange.");
            return;
        }

        setIsSaving(true);
        try {
            const payload = { ...data };
            if (payload.name === "Will be auto-generated") delete payload.name;

            const response = await axios.post(`${API_BASE_URL}/${doctypeName}`, payload, {
                headers: { Authorization: `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" },
                withCredentials: true,
            });

            toast.success("Asset Interchange created successfully!");
            const newName = response.data?.data?.name;
            if (newName) {
                router.push(
                    `/lis-management/doctype/asset-interchange/${newName}?asset=${data.select_asset}`
                );
            }
        } catch (err: any) {
            console.error("Create error:", err);
            const res = err.response?.data;

            if (res?._server_messages) {
                try {
                    const messages = JSON.parse(res._server_messages);
                    const cleanMessage = messages.map((msg: string) => JSON.parse(msg).message).join("\n");
                    toast.error(cleanMessage);
                    return;
                } catch { }
            }

            const errorMessage = res?.message || res?.exception || res?.error || "Failed to create Asset Interchange.";
            toast.error(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => router.back();

    return (
        <DynamicForm
            tabs={formTabs}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            title={`New ${doctypeName}`}
            description="Fill out the details to create a new Asset Interchange."
            submitLabel={isSaving ? "Saving..." : "Save"}
            cancelLabel="Cancel"
        />
    );
}