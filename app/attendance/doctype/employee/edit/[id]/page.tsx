"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import axios from "axios";
import { DynamicForm, TabbedLayout } from "@/components/DynamicFormComponent";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { apiKey, apiSecret, isInitialized } = useAuth();

  const [defaultValues, setDefaultValues] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Existing Data
  useEffect(() => {
    if (!isInitialized || !apiKey || !apiSecret) return;

    const fetchData = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/Employee/${id}`, {
          headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        });
        setDefaultValues(response.data.data);
      } catch (err) {
        console.error("Failed to load employee:", err);
        toast.error("Failed to load employee data", { duration: Infinity });
        router.push("/attendance/doctype/employee");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, apiKey, apiSecret, isInitialized, router]);

  // 2. Define Layout (Identical to New Page)
  // You should ideally extract this array to a separate file (e.g., employee-layout.ts) 
  // to avoid code duplication between 'new' and 'edit'.
  const employeeFormLayout: TabbedLayout[] = [
    {
      name: "Employee Details",
      fields: [
        {
          name: "sb_personal_info",
          label: "Personal Information",
          type: "Section Break",
        },
        {
          name: "naming_series",
          label: "Series",
          type: "Select",
          options: "HR-EMP-.YYYY.-",
          defaultValue: "HR-EMP-.YYYY.-",
          required: true,
        },
        // IMPORTANT: Employee ID is Read Only in Edit Mode
        {
          name: "employee", // This field holds the ID
          label: "Employee ID",
          type: "Data",
          readOnlyValue: id, // Force display of current ID
          // We don't want to edit the primary key
          description: "Unique ID cannot be changed.",
        },
        {
          name: "first_name",
          label: "First Name",
          type: "Data",
          required: true,
        },
        {
          name: "middle_name",
          label: "Middle Name",
          type: "Data",
        },
        {
          name: "last_name",
          label: "Last Name",
          type: "Data",
        },
        {
          name: "cb_personal_right",
          label: "",
          type: "Column Break",
        },
        {
          name: "employee_name",
          label: "Employee Name",
          type: "Data",
          readOnlyValue: "Auto-calculated",
        },
        {
          name: "gender",
          label: "Gender",
          type: "Link",
          linkTarget: "Gender",
        },
        {
          name: "date_of_birth",
          label: "Date of Birth",
          type: "Date",
        },
        {
          name: "salutation",
          label: "Salutation",
          type: "Link",
          linkTarget: "Salutation",
        },
        {
          name: "image",
          label: "Image",
          type: "Attach",
        },
        {
          name: "sb_employment_details",
          label: "Employment Details",
          type: "Section Break",
        },
        {
          name: "company",
          label: "Company",
          type: "Link",
          linkTarget: "Company",
          required: true,
        },
        {
          name: "date_of_joining",
          label: "Date of Joining",
          type: "Date",
          required: true,
        },
        {
          name: "employment_type",
          label: "Employment Type",
          type: "Link",
          linkTarget: "Employment Type",
        },
        {
          name: "cb_employment_right",
          label: "",
          type: "Column Break",
        },
        {
          name: "status",
          label: "Status",
          type: "Select",
          options: [
            { label: "Active", value: "Active" },
            { label: "Inactive", value: "Inactive" },
            { label: "Left", value: "Left" },
          ],
          required: true,
        },
        {
          name: "date_of_retirement",
          label: "Date of Retirement",
          type: "Date",
        },
        {
          name: "relieving_date",
          label: "Relieving Date",
          type: "Date",
          displayDependsOn: "eval:doc.status=='Left'",
        },
        {
          name: "sb_dept_reporting",
          label: "Department & Reporting",
          type: "Section Break",
        },
        {
          name: "department",
          label: "Department",
          type: "Link",
          linkTarget: "Department",
        },
        {
          name: "designation",
          label: "Designation",
          type: "Link",
          linkTarget: "Designation",
        },
        {
          name: "cb_dept_right",
          label: "",
          type: "Column Break",
        },
        {
          name: "reports_to",
          label: "Reports To",
          type: "Link",
          linkTarget: "Employee",
        },
        {
          name: "sb_contact_details",
          label: "Contact Details",
          type: "Section Break",
        },
        {
          name: "personal_email",
          label: "Personal Email",
          type: "Data",
        },
        {
          name: "cell_number",
          label: "Cell Number",
          type: "Data",
        },
        {
          name: "cb_contact_right",
          label: "",
          type: "Column Break",
        },
        {
          name: "company_email",
          label: "Company Email",
          type: "Data",
        },
      ],
    },
    // ... Add other tabs (Payroll, Attendance, etc) as needed, identical to 'new' page
  ];

  // 3. Inject default values into the layout fields
  // This is a crucial step: DynamicForm expects `defaultValue` inside the field definition
  // or via the useForm defaultValues (which we handle below differently).
  // Actually, your DynamicForm takes `defaultValues` from the schema.
  // We need to merge the API data into the schema or pass it to the form.

  // OPTIMIZATION: Your DynamicForm component doesn't accept a separate `defaultValues` prop easily.
  // It builds them from the `tabs` prop.
  // So we map the API data into the `tabs` structure.
  const layoutWithValues = React.useMemo(() => {
    if (!defaultValues) return employeeFormLayout;

    return employeeFormLayout.map(tab => ({
      ...tab,
      fields: tab.fields.map(field => ({
        ...field,
        defaultValue: defaultValues[field.name] ?? field.defaultValue
      }))
    }));
  }, [defaultValues]);


  // 4. Update Handler
  const handleUpdate = async (data: any) => {
    try {
      // Logic for Full Name Update
      if (data.first_name) {
        data.employee_name = [data.first_name, data.middle_name, data.last_name]
          .filter(Boolean)
          .join(" ");
      }

      await axios.put(
        `${API_BASE_URL}/Employee/${id}`,
        data,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
        }
      );

      toast.success("Employee updated successfully!");
      router.push(`/attendance/doctype/employee/${id}`); // Go back to detail view
    } catch (error: any) {
      console.error("Error updating employee:", error);
      toast.error(error.response?.data?.exception || "Failed to update employee", { duration: Infinity });
    }
  };

  if (loading) return <div className="p-10"><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href={`/attendance/doctype/employee/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Employee</h1>
          <p className="text-sm text-muted-foreground">
            {id}
          </p>
        </div>
      </div>

      <DynamicForm
        title={`Employee: ${defaultValues?.employee_name || defaultValues?.name || id}`}
        tabs={layoutWithValues} // Pass the layout with injected values
        onSubmit={handleUpdate}
        onCancel={() => router.back()}
        submitLabel="Save Changes"
      />
    </div>
  );
}