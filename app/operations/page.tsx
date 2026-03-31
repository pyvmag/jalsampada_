// app/assets/page.tsx

"use client";

import * as React from "react";
import { Workspace, Doctype, DoctypeGroup } from "@/components/Workspace";
import {
  DoorOpen,
  Box,
  Warehouse,
  Book,
  FileText,
  ClipboardList,
  Wrench,
  AlertTriangle,
  FilePlus,
  ArrowDownUp,
  ListChecks,
  Thermometer
} from "lucide-react";


const masterDoctypes: Doctype[] = [
  // Master
  { name: "temperature", title: "Temperature", icon: Thermometer },
  { name: "gate", title: "Gate", icon: DoorOpen },
  { name: "item", title: "Item", icon: Box },
  { name: "warehouse", title: "Store Location", icon: Warehouse },
];

const operationLogsDoctypes: Doctype[] = [
  // Operation Logs
  { name: "logbook", title: "Log Book", icon: Book },
  { name: "logsheet", title: "Log Sheet", icon: FileText },
  { name: "gate-operation-logbook", title: "Gate Operation Logbook", icon: ClipboardList },
  { name: "repair-work-requirement", title: "Repair Work Requirement", icon: Wrench },
  { name: "lis-incident-record", title: "LIS Incident Record", icon: AlertTriangle },
];


const stockTransactionDoctypes: Doctype[] = [
  // Stock Transaction
  { name: "spare-indent", title: "Spare Indent", icon: FilePlus },
  { name: "stock-entry", title: "Stock Entry", icon: ArrowDownUp },
  { name: "stock-reconciliation", title: "Stock Reconciliation", icon: ListChecks },
];

const reportsDoctypes: Doctype[] = [
  // Reports
  { name: "logbook-report", title: "Logbook Report", icon: FileText },
  { name: "logsheet-report", title: "Logsheet Report", icon: FileText },
  { name: "lis-incident-report", title: "LIS Incident Report", icon: FileText },
  { name: "gate-logbook-report", title: "Gate Logbook Report", icon: FileText },
];

const stockReportsDoctypes: Doctype[] = [
  // Reports
  { name: "stock-register-report", title: "Stock Register", icon: FileText },
  { name: "stock-balance-report", title: "Stock Balance", icon: FileText },
  { name: "stock-projected-qty-report", title: "Stock Projected Qty", icon: FileText },
  { name: "stock-summary-report", title: "Stock Summary", icon: FileText },
  { name: "stock-ageing-report", title: "Stock Ageing", icon: FileText },
  { name: "item-price-stock-report", title: "Item Price Stock", icon: FileText },
  { name: "warehouse-wise-stock-balance-report", title: "Warehouse Wise Stock balance", icon: FileText },
  { name: "stock-analytics-report", title: "Stock Analytics", icon: FileText },
];

const operationsDoctypeGroups: DoctypeGroup[] = [
  {
    title: "Masters",
    doctypes: masterDoctypes
  },
  {
    title: "Transaction",
    doctypes: operationLogsDoctypes
  },
  {
    title: "Stock Transaction",
    doctypes: stockTransactionDoctypes
  },
  {
    title: "Reports",
    doctypes: reportsDoctypes,
    basePath: "/operations/reports"
  },
  {
    title: "Stock Reports",
    doctypes: stockReportsDoctypes,
    basePath: "/operations/reports"
  }
];


export default function OperationsWorkspacePage() {
  return (
    <Workspace
      title="Operations Workspace"
      description="Select a doctype to view or manage records."
      // buttonText="Add Workspace"
      doctypeGroups={operationsDoctypeGroups}
      basePath="/operations/doctype"
      layout="operations"
    />
  );
}