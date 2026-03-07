"use client";

import * as React from "react";
import { Controller } from "react-hook-form";
import { cn } from "@/lib/utils";
import { FormField, rulesFor, FieldError, FieldHelp } from "./DynamicFormComponent";

interface DurationHHMMFieldProps {
    field: FormField;
    control: any;
    error?: any;
    disabled?: boolean;
}

export function DurationHHMMField({ field, control, error, disabled }: DurationHHMMFieldProps) {
    const formatToHHMM = (val: string) => {
        if (!val) return "";
        // Replace dot with colon if it looks like a decimal hour input
        let cleanVal = val.replace(".", ":");

        const parts = cleanVal.split(":");
        if (parts.length === 2) {
            let hoursInt = parseInt(parts[0] || "0");
            let minsInt = parseInt(parts[1] || "00");

            // Normalization logic: overflow minutes into hours
            if (minsInt >= 60) {
                hoursInt += Math.floor(minsInt / 60);
                minsInt = minsInt % 60;
            }

            const formattedHours = String(hoursInt);
            const formattedMins = String(minsInt).padStart(2, "0");
            return `${formattedHours}:${formattedMins}`;
        }

        if (/^\d+$/.test(cleanVal)) return `${cleanVal}:00`;
        return cleanVal;
    };

    return (
        <div className="form-group">
            <label htmlFor={field.name} className="form-label">
                {field.label}{field.required ? " *" : ""}
            </label>
            <Controller
                name={field.name}
                control={control}
                rules={rulesFor(field)}
                render={({ field: { onChange, onBlur, value, name, ref } }) => (
                    <input
                        ref={ref}
                        type="text"
                        name={name}
                        value={value ?? ""}
                        placeholder="HH:MM"
                        className={cn("form-control", error ? "!border-red-500" : "")}
                        disabled={disabled || field.readOnly}
                        onChange={(e) => {
                            let val = e.target.value;
                            val = val.replace(/[^0-9:.]/g, "");
                            onChange(val);
                        }}
                        onBlur={(e) => {
                            const formatted = formatToHHMM(e.target.value);
                            onChange(formatted);
                            onBlur();
                        }}
                    />
                )}
            />
            <FieldError error={error} />
            <FieldHelp text={field.description || "Format: HH:MM"} />
        </div>
    );
}
