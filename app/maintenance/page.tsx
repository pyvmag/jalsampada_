"use client";

import * as React from "react";
import { Workspace, Doctype, DoctypeGroup } from "@/components/Workspace";

import {
  ListChecks,
  CalendarCheck,
  FileText,
} from "lucide-react";

const maintenanceDoctypes: Doctype[] = [
  { name: "parameter-checklist", title: "Parameter Checklist", icon: ListChecks },
];

const transactionDoctypes: Doctype[] = [
  { name: "maintenance-checklist", title: "Maintenance Checklist", icon: ListChecks },
  { name: "maintenance-schedule", title: "Work Schedule", icon: CalendarCheck },
  { name: "maintenance-log", title: "Maintenance Log", icon: FileText },
];
const reportsDoctypes: Doctype[] = [
  { name: "maintenance-schedule-report", title: "Work Schedule Report", icon: FileText },
];

const maintenanceDoctypeGroups: DoctypeGroup[] = [
  {
    title: "Masters",
    doctypes: maintenanceDoctypes
  },
  {
    title: "Transactions",
    doctypes: transactionDoctypes
  },
  {
    title: "Reports",
    doctypes: reportsDoctypes,
    basePath: "/maintenance/reports"
  },
];

export default function MaintenancePage() {
  return (
    <Workspace
      title="Maintenance"
      description="Manage maintenance checklists, schedules, and logs."
      // buttonText="Create New"
      doctypeGroups={maintenanceDoctypeGroups}
      basePath="/maintenance/doctype"
      layout="maintenance"
    />
  );
}
