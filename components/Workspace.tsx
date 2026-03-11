"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

export interface Doctype {
  name: string;
  title: string;
  icon: React.ElementType;
}

export interface DoctypeGroup {
  title: string;
  doctypes: Doctype[];
  basePath?: string;
}

interface WorkspaceProps {
  title: string;
  description?: string;
  doctypeGroups: DoctypeGroup[];
  basePath: string;
}

export function Workspace({
  title,
  description,
  doctypeGroups,
  basePath,
}: WorkspaceProps) {
  return (
    <div className="module active min-h-screen bg-[#F9FBFC] p-6">
      {/* Refined Header */}
      <div className="mb-10 max-w-4xl">
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
          {title}
        </h2>
        <p className="text-slate-500 text-lg font-medium leading-relaxed">
          {description}
        </p>
      </div>

      <div className="columns-1 xl:columns-2 gap-10 space-y-10">
        {doctypeGroups.map((group, index) => {
          const isMaster = group.title.toLowerCase() === "master";
          const themeColor = isMaster ? "text-emerald-600" : "text-blue-600";
          const borderColor = isMaster ? "border-t-emerald-500" : "border-t-blue-500";
          const dotColor = isMaster ? "bg-emerald-500" : "bg-blue-500";

          return (
            <div
              key={index}
              className="break-inside-avoid mb-10"
            >
              <Card
                className={`border-none border-t-[5px] ${borderColor} shadow-sm bg-white/80 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50`}
              >
              <CardHeader className="pt-8 pb-6 px-8">
                <CardTitle className={`text-2xl font-bold flex items-center gap-3 ${themeColor}`}>
                  <span className={`w-3 h-3 rounded-full ${dotColor} animate-pulse`} />
                  {group.title}
                </CardTitle>
              </CardHeader>

              <CardContent className="px-6 pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                  {group.doctypes.map((doc) => (
                    <Button
                      key={doc.name}
                      asChild
                      variant="ghost"
                      className="group relative w-full justify-start h-auto p-4 rounded-xl transition-all duration-300 hover:bg-[#FEF9EC] overflow-hidden"
                    >
                      <Link href={`${group.basePath || basePath}/${doc.name}`} className="flex items-center justify-between w-full">
                        {/* Hover Left Indicator Bar */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-400 opacity-0 group-hover:opacity-100 transition-all" />

                        <div className="flex items-center gap-4">
                          {/* Modern Icon Box */}
                          <div className="flex items-center justify-center w-11 h-11 bg-slate-50 rounded-xl group-hover:bg-white group-hover:rotate-3 group-hover:scale-110 transition-all duration-300 shadow-sm border border-slate-100">
                            <doc.icon className="w-5 h-5 text-slate-500 group-hover:text-orange-500 transition-colors" />
                          </div>

                          <span className="text-slate-700 group-hover:text-slate-900 font-semibold text-[0.95rem]">
                            {doc.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
                        </div>
                      </Link>
                    </Button>
                  ))}
                </div>
              </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}