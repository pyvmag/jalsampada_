"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import axios from "axios";
import { DynamicForm, TabbedLayout } from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

export default function NewRolePage() {
    const router = useRouter();
    const { apiKey, apiSecret } = useAuth();
    const [isSaving, setIsSaving] = React.useState(false);

    const roleFormLayout: TabbedLayout[] = [
        {
            name: "Role Details",
            fields: [
                {
                    name: "role_name",
                    label: "Role Name",
                    type: "Data",
                    required: true,
                },
                {
                    name: "home_page",
                    label: "Home Page",
                    type: "Data",
                    placeholder: "Route: Example '/app'",
                },
                {
                    name: "restrict_to_domain",
                    label: "Restrict To Domain",
                    type: "Link",
                    options: "Domain"
                },
                {
                    name: "column_break_4",
                    label: "",
                    type: "Column Break",
                },
                {
                    name: "desk_access",
                    label: "Desk Access",
                    type: "Check",
                    defaultValue: 1,
                },
                {
                    name: "is_custom",
                    label: "Is Custom",
                    type: "Check",
                    defaultValue: 0,
                },
                {
                    name: "two_factor_auth",
                    label: "Two Factor Authentication",
                    type: "Check",
                    defaultValue: 0,
                },
                {
                    name: "disabled",
                    label: "Disabled",
                    type: "Check",
                    defaultValue: 0,
                },
            ],
        }
    ];

    const handleSubmit = async (data: any) => {
        if (!apiKey || !apiSecret) {
            toast.error("Authentication missing. Please login.");
            return;
        }

        setIsSaving(true);
        try {
            const formData = { ...data };
            
            // Convert booleans to 1/0 for Frappe
            const checkFields = ["desk_access", "is_custom", "two_factor_auth", "disabled"];
            checkFields.forEach(field => {
                if (typeof formData[field] === "boolean") {
                    formData[field] = formData[field] ? 1 : 0;
                }
            });

            const response = await axios.post(`${API_BASE_URL}/Role`, formData, {
                headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                    "Content-Type": "application/json",
                },
            });

            toast.success("Role created successfully!");
            const newId = response.data.data.name;
            router.push(`/admin/doctype/role/${encodeURIComponent(newId)}`);

        } catch (error: any) {
            console.error("Error creating role:", error);
            toast.error(error.response?.data?.exception || "Failed to create role", { duration: Infinity });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="module active">
            <div className="module-header mb-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">New Role</h2>
                        <p className="text-sm text-gray-500">Create a new system role</p>
                    </div>
                </div>
            </div>

            <div className="module-content">
                <DynamicForm
                    title=""
                    tabs={roleFormLayout}
                    onSubmit={handleSubmit}
                    onCancel={() => router.back()}
                    submitLabel="Save Role"
                    isSaving={isSaving}
                />
            </div>
        </div>
    );
}