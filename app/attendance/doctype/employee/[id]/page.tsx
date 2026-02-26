"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, User, Mail, Phone, Briefcase, Building } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { apiKey, apiSecret, isInitialized } = useAuth();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isInitialized || !apiKey || !apiSecret) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/Employee/${id}`, {
          headers: { Authorization: `token ${apiKey}:${apiSecret}` },
        });
        setData(response.data.data);
      } catch (err: any) {
        console.error("Error fetching employee:", err);
        setError(err.response?.status === 404 ? "Employee not found" : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, apiKey, apiSecret, isInitialized]);

  if (loading) return <div className="p-6"><Skeleton className="h-12 w-1/3 mb-4" /><Skeleton className="h-64 w-full" /></div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!data) return null;

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/attendance/doctype/employee">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.employee_name}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">{data.name}</span>
              <span>•</span>
              <span className={data.status === 'Active' ? "text-green-600" : "text-red-600"}>{data.status}</span>
            </p>
          </div>
        </div>
        <Link href={`/attendance/doctype/employee/edit/${id}`}>
          <Button>
            <Edit className="mr-2 h-4 w-4" /> Edit
          </Button>
        </Link>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Left Column: Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-lg border shadow-sm text-center">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4 overflow-hidden">
              {data.image ? (
                <img src={`http://103.219.3.169:2223${data.image}`} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-gray-400" />
              )}
            </div>
            <h3 className="font-semibold text-lg">{data.employee_name}</h3>
            <p className="text-gray-500 text-sm">{data.designation || "No Designation"}</p>
            <p className="text-gray-400 text-xs mt-1">{data.department}</p>
          </div>

          <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
            <h4 className="font-semibold text-sm text-gray-900 border-b pb-2">Contact Info</h4>

            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-gray-500 text-xs">Personal Email</p>
                <p>{data.personal_email || "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-gray-500 text-xs">Cell Number</p>
                <p>{data.cell_number || "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Details */}
        <div className="md:col-span-2 space-y-6">

          {/* Employment Details */}
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Employment Details
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Date of Joining</p>
                <p className="font-medium">{data.date_of_joining || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Date of Retirement</p>
                <p className="font-medium">{data.date_of_retirement || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Employment Type</p>
                <p className="font-medium">{data.employment_type || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Company</p>
                <p className="font-medium">{data.company || "—"}</p>
              </div>
            </div>
          </div>

          {/* Reporting */}
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building className="h-4 w-4" /> Reporting Hierarchy
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Reports To</p>
                <p className="font-medium text-blue-600">{data.reports_to || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Department</p>
                <p className="font-medium">{data.department || "—"}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}