"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import axios from "axios";
import { DynamicForm, TabbedLayout } from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

export default function NewRoleProfilePage() {
    const router = useRouter();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
    const [isSaving, setIsSaving] = React.useState(false);
    const [availableRoles, setAvailableRoles] = React.useState<string[]>([]);

    const doctypeName = "Role Profile";

    const formLayout: TabbedLayout[] = [
        {
            name: "Profile Details",
            fields: [
                {
                    name: "role_profile",
                    label: "Role Profile Name",
                    type: "Data",
                    required: true,
                },
                {
                    name: "sb_roles",
                    label: "Assigned Roles",
                    type: "Section Break",
                },
                ...availableRoles.map(role => ({
                    name: `role_${role.replace(/\s+/g, '_')}`,
                    label: role,
                    type: "Check" as const,
                })),
            ],
        }
    ];

    React.useEffect(() => {
        const fetchRoles = async () => {
            if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;
            try {
                const res = await axios.get(`${API_BASE_URL}/Role`, {
                    params: { limit_page_length: 1000, fields: JSON.stringify(["name"]) },
                    headers: { Authorization: `token ${apiKey}:${apiSecret}` },
                });
                const roles = res.data.data.map((r: any) => r.name).sort();
                setAvailableRoles(roles);
            } catch (err) {
                console.error("Failed to fetch roles:", err);
            }
        };
        fetchRoles();
    }, [isInitialized, isAuthenticated, apiKey, apiSecret]);

    const handleSubmit = async (data: any) => {
        if (!apiKey || !apiSecret) {
            toast.error("Authentication missing. Please login.");
            return;
        }

        setIsSaving(true);
        try {
            const formData = { ...data };
            
            // Map checkboxes to the `roles` child table expected by Frappe
            const rolesToSave: { role: string }[] = [];
            availableRoles.forEach(role => {
                const key = `role_${role.replace(/\s+/g, '_')}`;
                if (formData[key]) {
                    rolesToSave.push({ role });
                }
                delete formData[key]; // Clean up boolean before sending
            });
            
            formData.roles = rolesToSave;

            const response = await axios.post(`${API_BASE_URL}/${doctypeName}`, formData, {
                headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                    "Content-Type": "application/json",
                },
            });

            toast.success("Role Profile created successfully!");
            const newId = response.data.data.name;
            router.push(`/admin/doctype/role-profile/${encodeURIComponent(newId)}`);

        } catch (error: any) {
            console.error("Error creating role profile:", error);
            toast.error(error.response?.data?.exception || "Failed to create role profile", { duration: Infinity });
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
                        <h2 className="text-2xl font-bold tracking-tight">New Role Profile</h2>
                        <p className="text-sm text-gray-500">Create a template to group multiple roles</p>
                    </div>
                </div>
            </div>

            <div className="module-content">
                <DynamicForm
                    title=""
                    tabs={formLayout}
                    onSubmit={handleSubmit}
                    onCancel={() => router.back()}
                    submitLabel="Save Role Profile"
                    isSaving={isSaving}
                />
            </div>
        </div>
    );
}