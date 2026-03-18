"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Trash, Plus, Loader2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

// Mock Data for Selectors
const MOCK_DOCTYPES = [
  "Asset", "Location", "User", "Tender", "Contractor", "Expenditure"
];
const MOCK_ROLES = [
  "System Manager", "Administrator", "Tender Tester", "Guest", "Auditor"
];

const DOC_LEVEL_ACTIONS = ["select", "read", "write", "create", "delete"];
const LIFECYCLE_ACTIONS = ["submit", "cancel", "amend"];
const DATA_EXPORT_ACTIONS = ["report", "export", "import", "share", "print", "email"];

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
    if (!doctype || !role) return;
    setLoading(true);
    try {
      // Encode filters properly
      const filters = JSON.stringify([
        ["parent", "=", doctype],
        ["role", "=", role],
      ]);
      const url = `${API_BASE_URL}/Custom DocPerm?filters=${encodeURIComponent(filters)}&fields=["*"]`;
      
      const resp = await fetch(url, {
        method: "GET",
        headers: authHeaders,
      });

      if (!resp.ok) {
        throw new Error("Failed to fetch permissions");
      }
      
      const data = await resp.json();
      setPermissions(data.data || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDocType && selectedRole) {
      fetchPermissions(selectedDocType, selectedRole);
    } else {
      setPermissions([]);
    }
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
      
      toast.success(`Permission updated for ${field}`);
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
      
      // Refresh list to pull the complete newly formed record
      fetchPermissions(selectedDocType, selectedRole);
    } catch (err: any) {
      toast.error(err.message || "Error creating rule");
    } finally {
      setIsAddMode(false);
    }
  };

  const renderCheckboxGroup = (title: string, actions: string[], permRecord: CustomDocPerm) => {
    return (
      <div className="flex flex-col gap-2">
        <h4 className="font-semibold text-sm text-gray-700">{title}</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {actions.map((action) => {
            const isChecked = permRecord[action as keyof CustomDocPerm] === 1;
            return (
              <div key={action} className="flex items-center space-x-2">
                <Checkbox
                  id={`${permRecord.name}-${action}`}
                  checked={isChecked}
                  onCheckedChange={(checked) => 
                    handleUpdate(permRecord.name!, action as keyof CustomDocPerm, checked ? 1 : 0)
                  }
                />
                <label
                  htmlFor={`${permRecord.name}-${action}`}
                  className="text-sm font-medium leading-none capitalize cursor-pointer"
                >
                  {action.replace("_", " ")}
                </label>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row items-center justify-between pb-4 border-b">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Role Permission Manager</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage granular access control rules by Document Type and Role.
          </p>
        </div>
        {selectedDocType && selectedRole && (
          <Button onClick={() => setIsDialogOpen(true)} className="mt-4 md:mt-0 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add New Rule
          </Button>
        )}
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div className="space-y-2">
          <Label>Document Type</Label>
          <Select value={selectedDocType} onValueChange={setSelectedDocType}>
            <SelectTrigger>
              <SelectValue placeholder="Select Document Type" />
            </SelectTrigger>
            <SelectContent>
              {MOCK_DOCTYPES.map((doc) => (
                <SelectItem key={doc} value={doc}>
                  {doc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger>
              <SelectValue placeholder="Select Role" />
            </SelectTrigger>
            <SelectContent>
              {MOCK_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Permissions Matrix Layout */}
      <div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !selectedDocType || !selectedRole ? (
          <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
            Please select both a Document Type and a Role to view or manage permissions.
          </div>
        ) : permissions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
            No permissions found for <strong>{selectedDocType}</strong> and <strong>{selectedRole}</strong>.
          </div>
        ) : (
          <div className="space-y-6">
            {permissions.map((perm) => (
              <Card key={perm.name} className="shadow-sm border-t-4 border-t-primary">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg">Permission Level: {perm.permlevel}</CardTitle>
                    <CardDescription>
                      Rule ID: {perm.name}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2 bg-gray-100 px-3 py-1.5 rounded-md">
                      <Checkbox
                        id={`${perm.name}-if_owner`}
                        checked={perm.if_owner === 1}
                        onCheckedChange={(checked) =>
                          handleUpdate(perm.name!, "if_owner", checked ? 1 : 0)
                        }
                      />
                      <label
                        htmlFor={`${perm.name}-if_owner`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        If Owner
                      </label>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => perm.name && handleDelete(perm.name)}
                      title="Delete this level"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-4">
                    {renderCheckboxGroup("Document Level", DOC_LEVEL_ACTIONS, perm)}
                    {renderCheckboxGroup("Lifecycle Actions", LIFECYCLE_ACTIONS, perm)}
                    {renderCheckboxGroup("Data & Sharing", DATA_EXPORT_ACTIONS, perm)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add New Rule Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Permission Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-500">
              Creating a new rule for <strong>{selectedDocType}</strong> assigned to <strong>{selectedRole}</strong>.
            </p>
            <div className="space-y-2">
              <Label htmlFor="permlevel">Permission Level</Label>
              <Input
                id="permlevel"
                type="number"
                min="0"
                value={newPermLevel}
                onChange={(e) => setNewPermLevel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Level 0 is standard access. Higher numbers represent advanced workflow stages.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateNew} disabled={isAddMode}>
              {isAddMode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
