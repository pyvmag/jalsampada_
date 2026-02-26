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

export default function NewEmployeePage() {
  const router = useRouter();
  const { apiKey, apiSecret } = useAuth();

  // ─────────────────────────────────────────────────────────────────────────────
  // FORM CONFIGURATION (Employee Structure)
  // ─────────────────────────────────────────────────────────────────────────────
  const employeeFormLayout: TabbedLayout[] = [
    {
      name: "Employee Details",
      fields: [
        // 🔹 SECTION BREAK: Personal Information
        {
          name: "sb_personal_info",
          label: "Personal Information",
          type: "Section Break",
        },
        // ➤ COLUMN BREAK (Left)
        {
          name: "naming_series",
          label: "Series",
          type: "Select",
          options: "HR-EMP-.YYYY.-",
          defaultValue: "HR-EMP-.YYYY.-",
          required: true,
          description: "Select the naming series for the employee ID.",
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
        // ➤ COLUMN BREAK (Right)
        {
          name: "cb_personal_right",
          label: "",
          type: "Column Break",
        },
        {
          name: "gender",
          label: "Gender",
          type: "Link",
          linkTarget: "Gender",
          placeholder: "Select Gender",
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

        // 🔹 SECTION BREAK: Employment Details
        {
          name: "sb_employment_details",
          label: "Employment Details",
          type: "Section Break",
        },
        // ➤ COLUMN BREAK (Left)
        {
          name: "company",
          label: "Company",
          type: "Link",
          linkTarget: "Company",
          required: true,
          defaultValue: "Jalsampada",
        },
        {
          name: "date_of_joining",
          label: "Date of Joining",
          type: "Date",
          required: true,
        },

        // ➤ COLUMN BREAK (Right)
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
          defaultValue: "Active",
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

        // 🔹 SECTION BREAK: Department & Reporting
        {
          name: "sb_dept_reporting",
          label: "Department & Reporting",
          type: "Section Break",
        },
        // ➤ COLUMN BREAK (Left)
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
        // ➤ COLUMN BREAK (Right)
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

        // 🔹 SECTION BREAK: Contact Details
        {
          name: "sb_contact_details",
          label: "Contact Details",
          type: "Section Break",
        },
        {
          name: "personal_email",
          label: "Personal Email",
          type: "Data",
          pattern: "[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}$",
          patternMessage: "Invalid email format",
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
          pattern: "[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}$",
        },
      ],
    },
    // 🟦 TAB BREAK: Salary & Payroll
    {
      name: "Salary & Payroll",
      fields: [
        {
          name: "sb_payroll_info",
          label: "Payroll Information",
          type: "Section Break",
        },
        {
          name: "payroll_placeholder",
          label: "Payroll Note",
          type: "Read Only",
          readOnlyValue: "Payroll module fields will appear here once enabled.",
        },
      ],
    },
    // 🟦 TAB BREAK: Attendance & Leaves
    {
      name: "Attendance & Leaves",
      fields: [
        {
          name: "sb_attendance_info",
          label: "Leave Policy",
          type: "Section Break",
        },
        {
          name: "leave_policy",
          label: "Leave Policy",
          type: "Link",
          linkTarget: "Leave Policy",
        },
        {
          name: "holiday_list",
          label: "Holiday List",
          type: "Link",
          linkTarget: "Holiday List",
        },
      ],
    },
    // 🟦 TAB BREAK: Profile & Documents
    {
      name: "Profile & Documents",
      fields: [
        {
          name: "sb_attachments",
          label: "Attachments",
          type: "Section Break",
        },
        {
          name: "resume",
          label: "Resume / CV",
          type: "Attach",
        },
        {
          name: "id_proof",
          label: "ID Proof",
          type: "Attach",
        },
      ],
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // SUBMIT HANDLER
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSubmit = async (data: any) => {
    if (!apiKey || !apiSecret) {
      toast.error("Authentication missing. Please login.", { duration: Infinity });
      return;
    }

    try {
      if (data.first_name) {
        data.employee_name = [data.first_name, data.middle_name, data.last_name]
          .filter(Boolean)
          .join(" ");
      }

      const response = await axios.post(
        `${API_BASE_URL}/Employee`,
        data,
        {
          headers: {
            Authorization: `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
          },
        }
      );

      toast.success("Employee created successfully!");
      const newId = response.data.data.name;
      router.push(`/attendance/doctype/employee/${encodeURIComponent(newId)}`);

    } catch (error: any) {
      console.error("Error creating employee:", error);
      toast.error(
        error.response?.data?.exception || "Failed to create employee"
        , { duration: Infinity });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER (Using Module Layout)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="module active">
      {/* Module Header - Matches Asset/Tender Style */}
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
            <h2 className="text-2xl font-bold tracking-tight">New Employee</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create a new employee record
            </p>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div className="module-content">
        <DynamicForm
          title="" // Intentionally empty as we used module-header above
          tabs={employeeFormLayout}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          submitLabel="Save"
        />
      </div>
    </div>
  );
}