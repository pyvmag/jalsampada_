"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { DynamicForm, TabbedLayout } from "@/components/DynamicFormComponent";
import { getApiMessages } from "@/lib/utils";
import DocumentActivity from "@/components/DocumentActivity";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

export default function RoleEditPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = decodeURIComponent(params.id as string);
  const doctypeName = "Role";

  const [record, setRecord] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
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
                readOnly: true // Primary key cannot be changed after creation
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
            },
            {
                name: "is_custom",
                label: "Is Custom",
                type: "Check",
            },
            {
                name: "two_factor_auth",
                label: "Two Factor Authentication",
                type: "Check",
            },
            {
                name: "disabled",
                label: "Disabled",
                type: "Check",
            },
        ],
    }
  ];

  React.useEffect(() => {
    const fetchDoc = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret || !docname) return;
      try {
        const res = await axios.get(`${API_BASE_URL}/${doctypeName}/${encodeURIComponent(docname)}`, {
          headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        });
        setRecord(res.data.data);
      } catch (err: any) {
        setError(err.response?.status === 404 ? "Role not found." : "Failed to load role record.");
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [docname, isInitialized, isAuthenticated, apiKey, apiSecret]);

  const handleSubmit = async (formData: any) => {
    if (!apiKey || !apiSecret) return;
    setIsSaving(true);
    try {
      const data = { ...formData };
      
      const checkFields = ["desk_access", "is_custom", "two_factor_auth", "disabled"];
      checkFields.forEach(field => {
          if (typeof data[field] === "boolean") data[field] = data[field] ? 1 : 0;
      });

      const res = await axios.put(`${API_BASE_URL}/${doctypeName}/${encodeURIComponent(docname)}`, data, {
        headers: { Authorization: `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" },
      });

      toast.success("Role updated successfully", { duration: 3000 });
      setRecord(res.data.data);
    } catch (err: any) {
      const messages = getApiMessages(null, err, "Role updated successfully", "Failed to update Role");
      toast.error(messages.message, { description: messages.description, duration: Infinity });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading role...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!record) return <div className="p-6 text-gray-500">No data found.</div>;

  return (
    <div className="module active">
      <div className="module-content">
        <DynamicForm
          title={`Edit Role: ${record.role_name || record.name}`}
          tabs={roleFormLayout}
          defaultValues={record}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/admin/doctype/role")}
          isEdit={true}
          isSaving={isSaving}
          submitLabel="Save Changes"
        />
      </div>
      <div className="w-full px-4 md:px-8">
        <DocumentActivity doctype={doctypeName} docname={docname} baseUrl={API_BASE_URL.replace("/api/resource", "")} apiKey={apiKey || ""} apiSecret={apiSecret || ""} isInitialized={isInitialized} modifiedStr={record.modified} />
      </div>
    </div>
  );
}