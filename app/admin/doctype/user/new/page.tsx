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

export default function NewUserPage() {
    const router = useRouter();
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
    const [availableRoles, setAvailableRoles] = React.useState<string[]>([]);

    // ─────────────────────────────────────────────────────────────────────────────
    // FORM CONFIGURATION (User Structure)
    // ─────────────────────────────────────────────────────────────────────────────
    const userFormLayout: TabbedLayout[] = [
        {
            name: "Basic Details",
            fields: [
                {
                    name: "sb_personal_info",
                    label: "Personal Information",
                    type: "Section Break",
                },
                {
                    name: "first_name",
                    label: "First Name",
                    type: "Data",
                    required: true,
                },
                {
                    name: "last_name",
                    label: "Last Name",
                    type: "Data",
                },
                {
                    name: "email",
                    label: "Email",
                    type: "Data",
                    required: true,
                    pattern: "[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}$",
                    patternMessage: "Invalid email format",
                },
                {
                    name: "cb_basic_right",
                    label: "",
                    type: "Column Break",
                },
                {
                    name: "username",
                    label: "Username",
                    type: "Data",
                },
                {
                    name: "user_type",
                    label: "User Type",
                    type: "Select",
                    options: [
                        { label: "System User", value: "System User" },
                        { label: "Website User", value: "Website User" },
                    ],
                    defaultValue: "System User",
                },
                {
                    name: "new_password",
                    label: "Password",
                    type: "Password",
                    required: true,
                },
                {
                    name: "send_welcome_email",
                    label: "Send Welcome Email",
                    type: "Check",
                    defaultValue: 1,
                },
            ],
        },
        {
            name: "Contact & Profile",
            fields: [
                {
                    name: "sb_contact",
                    label: "Contact Information",
                    type: "Section Break",
                },
                {
                    name: "mobile_no",
                    label: "Mobile Number",
                    type: "Data",
                },
                {
                    name: "cb_contact_right",
                    label: "",
                    type: "Column Break",
                },
                {
                    name: "phone",
                    label: "Phone",
                    type: "Data",
                },
                {
                    name: "sb_profile",
                    label: "Profile Image",
                    type: "Section Break",
                },
                {
                    name: "user_image",
                    label: "User Image",
                    type: "Attach Image",
                },
            ],
        },
        {
            name: "Settings & Preferences",
            fields: [
                {
                    name: "sb_settings",
                    label: "System Preferences",
                    type: "Section Break",
                },
                {
                    name: "language",
                    label: "Language",
                    type: "Select",
                    options: [
                        { label: "English", value: "en" },
                        { label: "Hindi", value: "hi" }
                    ],
                },
                {
                    name: "cb_settings_right",
                    label: "",
                    type: "Column Break",
                },
                {
                    name: "time_zone",
                    label: "Time Zone",
                    type: "Data",
                    defaultValue: "Asia/Kolkata",
                },
                {
                    name: "enabled",
                    label: "Enabled",
                    type: "Check",
                    defaultValue: 1,
                },
            ],
        },
        {
            name: "Roles",
            fields: [
                {
                    name: "sb_roles",
                    label: "Assign Roles",
                    type: "Section Break",
                },
                ...availableRoles.map(role => ({
                    name: `role_${role.replace(/\s+/g, '_')}`,
                    label: role,
                    type: "Check" as const,
                })),
            ],
        },
    ];

    // Fetch Available Roles
    React.useEffect(() => {
        const fetchRoles = async () => {
            if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret) return;
            try {
                const res = await axios.get(`${API_BASE_URL}/Role`, {
                    params: {
                        limit_page_length: 1000,
                        fields: JSON.stringify(["name"]),
                    },
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

    // ─────────────────────────────────────────────────────────────────────────────
    // SUBMIT HANDLER
    // ─────────────────────────────────────────────────────────────────────────────
    const handleSubmit = async (data: any) => {
        if (!apiKey || !apiSecret) {
            toast.error("Authentication missing. Please login.", { duration: Infinity });
            return;
        }

        try {
            // Auto-generate full name if missing but first/last are provided
            if (data.first_name && !data.full_name) {
                data.full_name = [data.first_name, data.last_name].filter(Boolean).join(" ");
            }

            // Convert Checkboxes (usually outputting boolean) to 1/0 for Frappe if needed
            if (typeof data.send_welcome_email === "boolean") data.send_welcome_email = data.send_welcome_email ? 1 : 0;
            if (typeof data.enabled === "boolean") data.enabled = data.enabled ? 1 : 0;

            // Convert checkbox roles to roles child table
            const rolesToSave: { role: string }[] = [];
            availableRoles.forEach(role => {
                const key = `role_${role.replace(/\s+/g, '_')}`;
                if (data[key]) {
                    rolesToSave.push({ role });
                }
                delete data[key];
            });
            data.roles = rolesToSave;

            // 🟢 Handle Image Upload
            if (data.user_image instanceof File) {
                toast.loading("Uploading user image...");
                try {
                    const fileUrl = await uploadFile(
                        data.user_image,
                        apiKey,
                        apiSecret,
                        API_BASE_URL
                    );
                    data.user_image = fileUrl;
                    toast.dismiss();
                } catch (uploadErr) {
                    toast.dismiss();
                    toast.error("Failed to upload image. Saving without image.");
                    delete data.user_image;
                }
            }

            const response = await axios.post(
                `${API_BASE_URL}/User`,
                data,
                {
                    headers: {
                        Authorization: `token ${apiKey}:${apiSecret}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            toast.success("User created successfully!");
            const newId = response.data.data.name;
            router.push(`/admin/doctype/user/${encodeURIComponent(newId)}`);

        } catch (error: any) {
            console.error("Error creating user:", error);
            toast.error(
                error.response?.data?.exception || "Failed to create user"
                , { duration: Infinity });
        }
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────────
    return (
        <div className="module active">
            <div className="module-header mb-6">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">New User</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Create a new system or website user
                        </p>
                    </div>
                </div>
            </div>

            <div className="module-content">
                <DynamicForm
                    title=""
                    tabs={userFormLayout}
                    onSubmit={handleSubmit}
                    onCancel={() => router.back()}
                    submitLabel="Save User"
                />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function uploadFile(
    file: File,
    apiKey: string,
    apiSecret: string,
    baseUrl: string
): Promise<string> {
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("is_private", "0");

    try {
        const siteUrl = baseUrl.split("/api/")[0];
        const resp = await axios.post(`${siteUrl}/api/method/upload_file`, formData, {
            headers: {
                Authorization: `token ${apiKey}:${apiSecret}`,
            },
            withCredentials: true,
        });

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