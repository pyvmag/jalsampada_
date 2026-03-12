"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  DynamicForm,
  TabbedLayout,
} from "@/components/DynamicFormComponent";
import { getApiMessages } from "@/lib/utils";
import DocumentActivity from "@/components/DocumentActivity";


const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

export default function UserEditPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  // The User document ID is their email address
  const docname = decodeURIComponent(params.id as string);
  const doctypeName = "User";

  const [record, setRecord] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [availableRoles, setAvailableRoles] = React.useState<string[]>([]);
  const [formInstance, setFormInstance] = React.useState<any>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. FORM CONFIGURATION
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
          label: "Email (User ID)",
          type: "Data",
          readOnly: true, // Email is the primary key in Frappe Users, usually can't be changed directly here
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
        },
        {
          name: "enabled",
          label: "Enabled",
          type: "Check",
        },
        {
          name: "sb_password",
          label: "Security",
          type: "Section Break",
        },
        {
          name: "new_password",
          label: "New Password",
          type: "Password",
          placeholder: "Leave empty to keep current password",
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
        {
          name: "role_profile_name",
          label: "Role Profile",
          type: "Link",
          linkTarget: "Role Profile",
        },
        {
          name: "cb_roles_right",
          label: "",
          type: "Column Break",
        },
        ...availableRoles.map(role => ({
          name: `role_${role.replace(/\s+/g, '_')}`,
          label: role,
          type: "Check" as const,
        })),
      ],
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. FETCH DATA
  // ─────────────────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const fetchDoc = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret || !docname) {
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(
          `${API_BASE_URL}/${doctypeName}/${encodeURIComponent(docname)}`,
          {
            headers: {
              Authorization: `token ${apiKey}:${apiSecret}`,
            },
          }
        );
        setRecord(res.data.data);
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(err.response?.status === 404 ? "User not found." : "Failed to load user record.");
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [docname, isInitialized, isAuthenticated, apiKey, apiSecret]);

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
      } catch (err: any) {
        console.error("Failed to fetch roles:", err);
        if (err.response?.status === 403) {
          setError("You do not have permission to manage roles. Please log in as an administrator.");
        }
      }
    };
    fetchRoles();
  }, [isInitialized, isAuthenticated, apiKey, apiSecret]);

  // Map record roles to checkbox values
  const defaultValues = React.useMemo(() => {
    if (!record) return {};
    const vals = { ...record };
    if (record.roles) {
      record.roles.forEach((r: any) => {
        vals[`role_${r.role.replace(/\s+/g, '_')}`] = true;
      });
    }
    return vals;
  }, [record]);

  // Track Role Profile changes and update role checkboxes
  const previousProfileRef = React.useRef<string | null>(null);
  
  React.useEffect(() => {
    if (!formInstance || !apiKey || !apiSecret || availableRoles.length === 0) return;

    // Initialize the ref with the record's profile on mount to avoid triggering on initial load
    if (record?.role_profile_name && previousProfileRef.current === null) {
      previousProfileRef.current = record.role_profile_name;
    }

    const subscription = formInstance.watch((value: any, { name }: any) => {
        if (name === "role_profile_name" || name === undefined) {
            const selectedProfile = value.role_profile_name;
            if (selectedProfile && selectedProfile !== previousProfileRef.current) {
                previousProfileRef.current = selectedProfile;
                axios.get(`${API_BASE_URL}/Role Profile/${encodeURIComponent(selectedProfile)}`, {
                    headers: { Authorization: `token ${apiKey}:${apiSecret}` }
                }).then(res => {
                    const profileRoles = res.data.data.roles || [];
                    availableRoles.forEach(role => {
                        const key = `role_${role.replace(/\s+/g, '_')}`;
                        const hasRole = profileRoles.some((pr: any) => pr.role === role);
                        formInstance.setValue(key, hasRole ? 1 : 0, { shouldDirty: true });
                    });
                }).catch(err => {
                    console.error("Failed to fetch role profile roles", err);
                });
            } else if (!selectedProfile && previousProfileRef.current) {
                // If profile is cleared, we could optionally clear roles, but we'll leave as-is 
                // or let the user manually uncheck. We just need to update the ref.
                previousProfileRef.current = null;
            }
        }
    });

    return () => subscription.unsubscribe();
  }, [formInstance, availableRoles, apiKey, apiSecret, record]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SUBMIT (PUT)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSubmit = async (formData: any) => {
    if (!apiKey || !apiSecret) return;
    setIsSaving(true);

    try {
      const data = { ...formData };

      // Re-generate full name based on changes
      if (data.first_name) {
        data.full_name = [data.first_name, data.last_name].filter(Boolean).join(" ");
      }

      // Convert boolean checks back to 1/0 integers for Frappe
      if (typeof data.enabled === "boolean") {
        data.enabled = data.enabled ? 1 : 0;
      }

      // Convert checkbox roles back to roles child table
      const rolesToSave: { role: string }[] = [];
      availableRoles.forEach(role => {
        const key = `role_${role.replace(/\s+/g, '_')}`;
        if (data[key]) {
          rolesToSave.push({ role });
        }
        delete data[key];
      });
      data.roles = rolesToSave;

      // Handle Password: If empty, don't send it to avoid overwriting or API errors
      if (!data.new_password) {
        delete data.new_password;
      }

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

      const res = await axios.put(
        `${API_BASE_URL}/${doctypeName}/${encodeURIComponent(docname)}`,
        data,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
        }
      );

      toast.success("User updated successfully", { duration: 3000 });
      setRecord(res.data.data);

      // Optionally route back to the list after saving:
      // router.push("/admin/doctype/user");

    } catch (err: any) {
      console.error("Update error:", err);
      const messages = getApiMessages(
        null,
        err,
        "User updated successfully",
        "Failed to update User"
      );
      toast.error(messages.message, {
        description: messages.description,
        duration: Infinity,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="p-6 text-gray-500">Loading user...</div>;
  }
  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }
  if (!record) {
    return <div className="p-6 text-gray-500">No data found.</div>;
  }

  return (
    <div className="module active">
      <div className="module-content">
        <DynamicForm
          title={`Edit User: ${record.full_name || record.name}`}
          tabs={userFormLayout}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/admin/doctype/user")}
          isEdit={true}
          isSaving={isSaving}
          submitLabel="Save Changes"
          onFormInit={setFormInstance}
        />
      </div>

      <div className="w-full px-4 md:px-8">
        <DocumentActivity
          doctype={doctypeName}
          docname={docname}
          baseUrl={API_BASE_URL.replace("/api/resource", "")}
          apiKey={apiKey || ""}
          apiSecret={apiSecret || ""}
          isInitialized={isInitialized}
          currentUserEmail={record.email}
          modifiedStr={record.modified}
          modifiedBy={undefined}
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