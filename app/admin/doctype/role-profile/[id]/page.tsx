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

export default function RoleProfileEditPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const docname = decodeURIComponent(params.id as string);
  const doctypeName = "Role Profile";

  const [record, setRecord] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [availableRoles, setAvailableRoles] = React.useState<string[]>([]);

  const formLayout: TabbedLayout[] = [
    {
        name: "Profile Details",
        fields: [
            {
                name: "role_profile",
                label: "Role Profile Name",
                type: "Data",
                required: true,
                readOnly: true // Often name fields acting as IDs can't be modified after creation
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

  // Fetch Record
  React.useEffect(() => {
    const fetchDoc = async () => {
      if (!isInitialized || !isAuthenticated || !apiKey || !apiSecret || !docname) return;
      try {
        const res = await axios.get(`${API_BASE_URL}/${doctypeName}/${encodeURIComponent(docname)}`, {
          headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        });
        setRecord(res.data.data);
      } catch (err: any) {
        setError(err.response?.status === 404 ? "Role Profile not found." : "Failed to load record.");
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [docname, isInitialized, isAuthenticated, apiKey, apiSecret]);

  // Fetch Roles Array
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

  // Map backend `roles` child table to frontend checkbox states
  const defaultValues = React.useMemo(() => {
    if (!record) return {};
    const vals = { ...record };
    if (record.roles && Array.isArray(record.roles)) {
      record.roles.forEach((r: any) => {
        vals[`role_${r.role.replace(/\s+/g, '_')}`] = true;
      });
    }
    return vals;
  }, [record]);

  const handleSubmit = async (formData: any) => {
    if (!apiKey || !apiSecret) return;
    setIsSaving(true);
    try {
      const data = { ...formData };
      
      const rolesToSave: { role: string }[] = [];
      availableRoles.forEach(role => {
        const key = `role_${role.replace(/\s+/g, '_')}`;
        if (data[key]) {
          rolesToSave.push({ role });
        }
        delete data[key];
      });
      data.roles = rolesToSave;

      const res = await axios.put(`${API_BASE_URL}/${doctypeName}/${encodeURIComponent(docname)}`, data, {
        headers: { Authorization: `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" },
      });

      toast.success("Role Profile updated successfully", { duration: 3000 });
      setRecord(res.data.data);
    } catch (err: any) {
      const messages = getApiMessages(null, err, "Profile updated successfully", "Failed to update profile");
      toast.error(messages.message, { description: messages.description, duration: Infinity });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading profile...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!record) return <div className="p-6 text-gray-500">No data found.</div>;

  return (
    <div className="module active">
      <div className="module-content">
        <DynamicForm
          title={`Edit Role Profile: ${record.role_profile || record.name}`}
          tabs={formLayout}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/admin/doctype/role-profile")}
          isEdit={true}
          isSaving={isSaving}
          submitLabel="Save Changes"
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
            modifiedStr={record.modified} 
        />
      </div>
    </div>
  );
}