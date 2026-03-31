// app/assets/page.tsx

"use client";

import * as React from "react";
import { Workspace, Doctype, DoctypeGroup } from "@/components/Workspace";
import {

  User,
  Shield,
  Contact,
  ShieldAlert
} from "lucide-react";

const adminDoctypeGroups: DoctypeGroup[] = [
  {
    title: "User Management",
    doctypes: [
      { name: "user", title: "User", icon: User },
      { name: "role", title: "Role", icon: Shield },
      { name: "role-profile", title: "Role Profile", icon: Contact },
    ]
  },
  {
    title: "Tools",
    basePath: "/admin",
    doctypes: [
      { name: "role-permission-manager", title: "Role Permission Manager", icon: ShieldAlert },
    ]
  }
];

export default function AdminWorkspace() {
  return (
    <Workspace
      title="Admin Workspace"
      description="Manage system settings and configurations."
      // buttonText="Add Setting"
      doctypeGroups={adminDoctypeGroups}
      basePath="/admin/doctype"
    />
  );
}