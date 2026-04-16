"use client";

import * as React from "react";
import { Workspace } from "@/components/Workspace";
import {
  FileText,
  Wrench,
  FileText as FileInvoice,
  Activity,
  ClipboardList,
  Book,
  AlertTriangle,
  DoorOpen,
  Calendar,
  TrendingUp,
  Receipt,
  Droplet
} from "lucide-react";

// Define report doctypes organized by modules
const reportDoctypeGroups = [
  {
    title: "LIS Management Reports",
    basePath: "/lis-management/reports",
    doctypes: [
      {
        name: "asset_register_report",
        title: "Asset Register Report",
        icon: ClipboardList
      }
    ]
  },
  {
    title: "Operations Reports",
    basePath: "/operations/reports",
    doctypes: [
      {
        name: "logsheet-report",
        title: "Logsheet Report",
        icon: FileText
      },
      {
        name: "logbook-report",
        title: "Logbook Report",
        icon: Book
      },
      {
        name: "lis-incident-report",
        title: "LIS Incident Report",
        icon: AlertTriangle
      },
      {
        name: "gate-logbook-report",
        title: "Gate Logbook Report",
        icon: DoorOpen
      },
      {
        name: "pump-hour-report",
        title: "Pump Hour Report",
        icon: FileText
      }
    ]
  },
  {
    title: "Tender Reports",
    basePath: "/tender/reports",
    doctypes: [
      {
        name: "tender_level_report",
        title: "Tender Level Report",
        icon: TrendingUp
      },
      {
        name: "expenditure_details_report",
        title: "Expenditure Details Report",
        icon: Receipt
      }
    ]
  },
  {
    title: "Maintenance Reports",
    basePath: "/maintenance/reports",
    doctypes: [
      {
        name: "maintenance-schedule-report",
        title: "Work Schedule Report",
        icon: Calendar
      }
    ]
  },

  // {
  //   title: "LIS Management Reports",
  //   basePath: "/lis-management/reports",
  //   doctypes: [
  //     {
  //       name: "asset_register_report",
  //       title: "Asset Register Report (LIS)",
  //       icon: Droplet
  //     }
  //   ]
  // }
];

export default function ReportsPage() {
  const totalReports = reportDoctypeGroups.reduce((total, group) => total + group.doctypes.length, 0);

  return (
    <Workspace
      title="Reports"
      description={`Centralized hub for all system reports and analytics. Access ${totalReports} reports across ${reportDoctypeGroups.length} modules.`}
      doctypeGroups={reportDoctypeGroups}
      basePath="/reports"
    />
  );
}
