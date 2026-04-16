"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  Trash,
  Plus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { LinkInput } from "@/components/LinkInput";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

const PERMISSION_COLS = [
  ["select", "create", "cancel", "email", "export"],
  ["read", "delete", "amend", "report", "share"],
  ["write", "submit", "print", "import"]
];

export interface CustomDocPerm {
  name?: string;
  parent: string;
  role: string;
  permlevel: number;
  if_owner: 0 | 1;

  select: 0 | 1;
  read: 0 | 1;
  write: 0 | 1;
  create: 0 | 1;
  delete: 0 | 1;

  submit: 0 | 1;
  cancel: 0 | 1;
  amend: 0 | 1;

  report: 0 | 1;
  export: 0 | 1;
  import: 0 | 1;
  share: 0 | 1;
  print: 0 | 1;
  email: 0 | 1;
}

export default function RolePermissionManager() {
  const { apiKey, apiSecret } = useAuth();

  const [selectedDocType, setSelectedDocType] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");

  const [permissions, setPermissions] = useState<CustomDocPerm[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isAddMode, setIsAddMode] = useState<boolean>(false);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPermLevel, setNewPermLevel] = useState<string>("0");

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `token ${apiKey}:${apiSecret}`,
  };

  const fetchPermissions = async (doctype: string, role: string) => {
    if (!doctype && !role) {
      setPermissions([]);
      return;
    }
    setLoading(true);
    try {
      const filters: any[] = [];
      if (doctype) filters.push(["parent", "=", doctype]);
      if (role) filters.push(["role", "=", role]);
      
      const url = `${API_BASE_URL}/Custom DocPerm?filters=${encodeURIComponent(JSON.stringify(filters))}&fields=["*"]`;

      const resp = await fetch(url, {
        method: "GET",
        headers: authHeaders,
      });

      if (!resp.ok) {
        throw new Error("Failed to fetch permissions");
      }

      const data = await resp.json();
      const sortedPermissions = (data.data || []).sort(
        (a: CustomDocPerm, b: CustomDocPerm) => a.permlevel - b.permlevel
      );
      setPermissions(sortedPermissions);
    } catch (err: any) {
      toast.error(err.message || "Error fetching rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch if either one exists, or all if none exists (though you probably want some limit if none)
    // Actually, Frappe's Role Permission manager requires at least one of them to be selected to not overload the system, 
    // but the user wants to see all Asset rules if ONLY asset is selected.
    fetchPermissions(selectedDocType, selectedRole);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocType, selectedRole]);

  const handleUpdate = async (name: string, field: keyof CustomDocPerm, newValue: 0 | 1) => {
    // Optimistic update
    setPermissions((prev) =>
      prev.map((p) => (p.name === name ? { ...p, [field]: newValue } : p))
    );

    try {
      const resp = await fetch(`${API_BASE_URL}/Custom DocPerm/${name}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ [field]: newValue }),
      });

      if (!resp.ok) {
        throw new Error("Failed to update rule");
      }

    } catch (err: any) {
      toast.error(err.message || "Error updating rule");
      // Revert optimistic update
      setPermissions((prev) =>
        prev.map((p) => (p.name === name ? { ...p, [field]: newValue === 1 ? 0 : 1 } : p))
      );
    }
  };

  const handleDelete = async (name: string) => {
    try {
      const resp = await fetch(`${API_BASE_URL}/Custom DocPerm/${name}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (!resp.ok) {
        throw new Error("Failed to delete rule");
      }

      toast.success("Rule deleted successfully");
      setPermissions((prev) => prev.filter((p) => p.name !== name));
    } catch (err: any) {
      toast.error(err.message || "Error deleting rule");
    }
  };

  const handleCreateNew = async () => {
    const level = parseInt(newPermLevel, 10);
    if (isNaN(level) || level < 0) {
      toast.error("Valid Permission Level is required");
      return;
    }

    // Check if level already exists locally to prevent duplicates
    if (permissions.some((p) => p.permlevel === level)) {
      toast.error(`A rule with level ${level} already exists!`);
      return;
    }

    setIsAddMode(true);
    try {
      const payload = {
        parent: selectedDocType,
        role: selectedRole,
        permlevel: level,
      };

      const resp = await fetch(`${API_BASE_URL}/Custom DocPerm`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.exception || "Failed to create rule");
      }

      toast.success("Rule created successfully");
      setIsDialogOpen(false);
      setNewPermLevel("0");

      // Refresh list to pull the complete newly formed record
      fetchPermissions(selectedDocType, selectedRole);
    } catch (err: any) {
      toast.error(err.message || "Error creating rule");
    } finally {
      setIsAddMode(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6 bg-[#FAFAFA] min-h-screen text-foreground">
      {/* Header Area (Frappe Style Page Header) */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-gray-200 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
          Role Permissions Manager
        </h1>
        <div className="flex items-center gap-2">
          {(selectedDocType && selectedRole) ? (
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="flex items-center gap-2 shadow-sm whitespace-nowrap bg-zinc-900 hover:bg-zinc-800 text-white h-8 px-3 text-xs font-medium"
            >
              <Plus className="h-3 w-3" />
              Add A New Rule
            </Button>
          ) : (
             <Button
              disabled
              className="flex items-center gap-2 shadow-sm whitespace-nowrap bg-zinc-900/50 text-white h-8 px-3 text-xs font-medium opacity-70"
              title="Select both a Document Type and Role to add a rule"
            >
              <Plus className="h-3 w-3" />
              Add A New Rule
            </Button>
          )}
        </div>
      </div>

      {/* Selectors Area */}
      <div className="flex flex-wrap items-center gap-4 py-2 pb-1">
        <div className="w-[280px]">
          <LinkInput
            value={selectedDocType}
            onChange={setSelectedDocType}
            linkTarget="DocType"
            placeholder="Select Document Type..."
          />
        </div>
        <div className="w-[280px]">
          <LinkInput
            value={selectedRole}
            onChange={setSelectedRole}
            linkTarget="Role"
            placeholder="Select Role..."
          />
        </div>
      </div>

      {/* Permissions Content Area Using Table Layout */}
      <div className="animate-in fade-in duration-500 rounded-md overflow-hidden border border-gray-100 bg-white shadow-sm mt-4">
        {/* Table Header */}
        <div className="grid grid-cols-[200px_200px_80px_1fr] bg-[#3683f6] text-white px-4 py-2.5 text-[13px] font-semibold border-b">
          <div>Document Type</div>
          <div>Role</div>
          <div>Level</div>
          <div>Permissions</div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <p className="text-sm">Loading permissions...</p>
          </div>
        ) : permissions.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground/70 bg-white text-sm">
            {(!selectedDocType && !selectedRole) 
              ? "Select a Document Type or Role above to view permissions." 
              : "No permissions found for the selected criteria. Add a new rule to begin."}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {permissions.map((perm) => (
              <div key={perm.name} className="grid grid-cols-[200px_200px_80px_1fr] px-4 py-5 text-[13px] text-gray-800 hover:bg-gray-50/40 transition-colors">
                
                {/* Document Type Column */}
                <div className="pt-0.5 font-medium text-gray-700">{perm.parent}</div>

                {/* Role Column */}
                <div className="flex flex-col gap-3 pt-0.5">
                  <span className="font-medium text-gray-700">{perm.role}</span>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`${perm.name}-if_owner`}
                      checked={perm.if_owner === 1}
                      onCheckedChange={(checked) =>
                        handleUpdate(perm.name!, "if_owner", checked ? 1 : 0)
                      }
                      className="rounded hover:border-gray-400 border-gray-300 h-3.5 w-3.5 data-[state=checked]:bg-zinc-800 data-[state=checked]:border-zinc-800"
                    />
                    <label
                      htmlFor={`${perm.name}-if_owner`}
                      className="text-[12px] leading-none cursor-pointer text-gray-500 font-medium hover:text-gray-800"
                    >
                      Only If Creator
                    </label>
                  </div>
                </div>

                {/* Level Column */}
                <div className="pt-0.5 font-medium text-gray-700">{perm.permlevel}</div>

                {/* Permissions Grid Column */}
                <div className="flex items-start justify-between">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-4 w-full max-w-4xl">
                    {PERMISSION_COLS.map((colGroup, colIndex) => (
                      <div key={colIndex} className="flex flex-col gap-3.5">
                        {colGroup.map((action) => {
                          const isChecked = perm[action as keyof CustomDocPerm] === 1;
                          return (
                            <div key={action} className="flex items-center space-x-2.5">
                              <Checkbox
                                id={`${perm.name}-${action}`}
                                checked={isChecked}
                                onCheckedChange={(checked) =>
                                  handleUpdate(perm.name!, action as keyof CustomDocPerm, checked ? 1 : 0)
                                }
                                className={cn("rounded border-gray-300 h-3.5 w-3.5", 
                                  isChecked ? "bg-zinc-800 border-zinc-800 text-white" : "hover:border-gray-400"
                                )}
                              />
                              <label
                                htmlFor={`${perm.name}-${action}`}
                                className={cn("text-[13px] leading-none capitalize cursor-pointer",
                                  isChecked ? "text-gray-900 font-medium" : "text-gray-500 hover:text-gray-800"
                                )}
                              >
                                {action}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  
                  {/* Delete Button far right */}
                  <Button
                    variant="destructive"
                    className="ml-4 h-7 w-7 p-0 bg-red-500/90 hover:bg-red-600 rounded shrink-0 opacity-80 hover:opacity-100"
                    onClick={() => perm.name && handleDelete(perm.name)}
                    title="Delete Rule"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Level Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
         <DialogContent className="sm:max-w-sm">
           <DialogHeader>
             <DialogTitle className="text-lg">Add A New Rule</DialogTitle>
             <DialogDescription className="text-sm">
               For {selectedDocType} • {selectedRole}
             </DialogDescription>
           </DialogHeader>
           <div className="py-2">
             <Label htmlFor="permlevel" className="font-semibold text-gray-700 block mb-2">
               Permission Level
             </Label>
             <Input
               id="permlevel"
               type="number"
               min="0"
               className="h-10 text-base"
               value={newPermLevel}
               onChange={(e) => setNewPermLevel(e.target.value)}
             />
           </div>
           <DialogFooter>
             <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="text-gray-600 hover:text-gray-900">
               Cancel
             </Button>
             <Button onClick={handleCreateNew} disabled={isAddMode} className="bg-zinc-900 hover:bg-zinc-800 text-white">
               {isAddMode ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
               Save
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
    </div>
  );
}
