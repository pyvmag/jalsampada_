"use client";

import * as React from "react";
import { Workspace, Doctype, DoctypeGroup } from "@/components/Workspace";

import {
  FileText,
  ClipboardList,
  IndianRupee,
  Settings,
  Users,
  BarChart3,
} from "lucide-react";

const masterDoctypes: Doctype[] = [
  // Masters
  { name: "contractor", title: "Contractor", icon: Users },
  { name: "work-type", title: "Work Type", icon: ClipboardList },
  { name: "work-subtype", title: "Work Subtype", icon: ClipboardList },
  { name: "fund-head", title: "Fund Head", icon: Settings },
];

const transactionDoctypes: Doctype[] = [
  // Tender-related
  { name: "prapan-suchi", title: "Prapan Suchi", icon: FileText },
  { name: "tender", title: "Tender", doctype: "Project", icon: FileText },
  { name: "draft-tender-paper", title: "Draft Tender Paper", icon: FileText },

  // Financial / Expenditure
  { name: "expenditure", title: "Expenditure", icon: IndianRupee },
];

const reportsDoctypes: Doctype[] = [
  // Reports
  { name: "expenditure_details_report", title: "Expenditure Details Report", icon: BarChart3 },
  { name: "tender_level_report", title: "Tender Level Report", icon: BarChart3 },
];

const reportsGroup: DoctypeGroup = {
  title: "Reports",
  doctypes: reportsDoctypes,
  basePath: "/tender/reports"
};

const tenderDoctypeGroups: DoctypeGroup[] = [
  {
    title: "Masters",
    doctypes: masterDoctypes
  },
  {
    title: "Transactions",
    doctypes: transactionDoctypes
  },
  reportsGroup,
];

export default function TenderPage() {
  return (
    <Workspace
      title="Tender Management"
      description="Manage tenders, work orders, fund heads, and expenditure records."
      // buttonText="Create New"
      doctypeGroups={tenderDoctypeGroups}
      // This ensures clicks go to /tender/doctype/[name]
      basePath="/tender/doctype"
      layout="tender"
    />
  );
}