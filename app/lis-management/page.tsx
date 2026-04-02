// app/assets/page.tsx

"use client";

import * as React from "react";
import { Workspace, Doctype, DoctypeGroup } from "@/components/Workspace";
import {
  Database,
  Layers,
  Factory,
  Package,
  Ruler,
  Star,
  Droplets,
  MapPin, // Icon for locations
  Home,
} from "lucide-react";

const masterDoctypes: Doctype[] = [
  { name: "doctype/asset", title: "Asset", doctype: "Asset", icon: Database },
  { name: "doctype/asset-category", title: "Asset Category", doctype: "Asset Category", icon: Database },
  { name: "doctype/lift-irrigation-scheme", title: "Lift Irrigation Scheme", doctype: "Lift Irrigation Scheme", icon: Droplets },
  { name: "doctype/stage-no", title: "Stage No", doctype: "Stage No", icon: Layers },
  { name: "doctype/equipment-make", title: "Equipment Make", doctype: "Equipment Make", icon: Factory },
  { name: "doctype/equipement-model", title: "Equipment Model", doctype: "Equipment Model", icon: Package },
  { name: "doctype/equipement-capacity", title: "Equipment Capacity", doctype: "Equipment Capacity", icon: Ruler },
  { name: "doctype/rating", title: "Rating", doctype: "Rating", icon: Star },
  { name: "doctype/district", title: "District", doctype: "District", icon: MapPin },
  { name: "doctype/taluka", title: "Taluka", doctype: "Taluka", icon: Star },
  { name: "doctype/location", title: "Location", doctype: "Location", icon: MapPin },
  { name: "doctype/village", title: "Village", doctype: "Village", icon: Home }
];

const transactionDoctypes: Doctype[] = [
  // Add transaction doctypes here as needed
  { name: "doctype/asset-interchange", title: "Asset Interchange", icon: Database },
];
const reportDoctypes: Doctype[] = [
  // Add transaction doctypes here as needed
  { name: "reports/asset_register_report", title: "Asset Register Report", icon: Package },
  { name: "reports/asset_interchange_report", title: "Asset Interchange Report", icon: Package },
];

const doctypeGroups: DoctypeGroup[] = [
  {
    title: "Masters",
    doctypes: masterDoctypes
  },
  {
    title: "Transactions",
    doctypes: transactionDoctypes
  },
  {
    title: "Reports",
    doctypes: reportDoctypes
  },
];

export default function AssetsWorkspacePage() {
  return (
    <Workspace
      title="Asset Management Workspace"
      description="Manage Lift Irrigation Scheme assets and transactions"
      doctypeGroups={doctypeGroups}
      basePath="/lis-management/"
      layout="asset"
    />
  );
}