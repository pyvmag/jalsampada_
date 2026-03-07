"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Controller } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";
import { FormField } from "./DynamicFormComponent";
import { Search, Loader2, X, Tag } from "lucide-react";

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

interface TableMultiSelectOption {
    value: string;
    label: string;
}


interface TableMultiSelectProps {
    control: any;
    field: FormField & { defaultValue?: string[]; linkTarget?: string };
    error?: any;
    className?: string;
    filters?: Record<string, any>;
    getQuery?: (filters: Record<string, any>) => string;
    disabled?: boolean;
}

export function TableMultiSelect({ control, field, error, className, filters = {}, getQuery, disabled = false }: TableMultiSelectProps) {
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

    const [searchTerm, setSearchTerm] = React.useState("");
    const [options, setOptions] = React.useState<TableMultiSelectOption[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isOpen, setIsOpen] = React.useState(false);
    const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, left: 0, width: 0 });

    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // --- API Search Logic ---
    const performSearch = React.useCallback(async (term: string) => {
        if (!isAuthenticated || !apiKey || !field.linkTarget) return;

        setIsLoading(true);
        try {
            const searchFilters: any[] = [];
            if (term?.trim()) {
                searchFilters.push([field.linkTarget, "name", "like", `%${term.trim()}%`]);
            }

            // 🟢 GLOBAL FILTER: Automatically exclude disabled users for all User link fields
            if (field.linkTarget === "User") {
                searchFilters.push([field.linkTarget, "enabled", "=", 1]);
            }

            // 🟢 GLOBAL FILTER: Automatically exclude disabled items for all Item link fields
            if (field.linkTarget === "Item") {
                searchFilters.push([field.linkTarget, "disabled", "=", 0]);
            }

            Object.entries(filters).forEach(([key, value]) => {
                if (value != null && value !== "") {
                    searchFilters.push([field.linkTarget, key, "=", value]);
                }
            });

            const query = getQuery ? getQuery(filters) : JSON.stringify(searchFilters);

            const resp = await axios.get(`${API_BASE_URL}/${field.linkTarget}`, {
                params: {
                    fields: JSON.stringify(["name"]),
                    limit_page_length: "20",
                    order_by: "name asc",
                    filters: query
                },
                headers: { Authorization: `token ${apiKey}:${apiSecret}` },
                withCredentials: true,
            });

            const raw = (resp.data.data || []) as { name: string }[];
            const currentValue = control._formValues[field.name] || [];
            const selectedLabels = currentValue.map((item: any) => {
                if (typeof item === 'string') return item;
                if (item?.stage) return item.stage;
                if (item?.asset) return item.asset;
                if (item?.name) return item.name;
                return JSON.stringify(item);
            });
            const filteredOptions = raw.filter((r) => !selectedLabels.includes(r.name));
            setOptions(filteredOptions.map((r) => ({ value: r.name, label: r.name })));
        } catch (e) {
            console.error("TableMultiSelect search error:", e);
            setOptions([]);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, apiKey, apiSecret, field.linkTarget, filters, getQuery, control, field.name]);

    const debouncedSearch = React.useCallback((term: string) => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => performSearch(term), 300);
    }, [performSearch]);

    // Update dropdown position when opened
    const updateDropdownPosition = React.useCallback(() => {
        if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, []);

    // Close dropdown on click outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current && !inputRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Update position on scroll/resize when dropdown is open
    React.useEffect(() => {
        if (!isOpen) return;

        const handlePositionUpdate = () => {
            updateDropdownPosition();
        };

        window.addEventListener('scroll', handlePositionUpdate, true);
        window.addEventListener('resize', handlePositionUpdate);

        return () => {
            window.removeEventListener('scroll', handlePositionUpdate, true);
            window.removeEventListener('resize', handlePositionUpdate);
        };
    }, [isOpen, updateDropdownPosition]);

    return (
        <div className={`form-group ${className || ""}`} style={{ overflow: 'visible' }}>

            <label htmlFor={field.name} className="form-label">
                {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>

            <Controller
                control={control}
                name={field.name}
                defaultValue={field.defaultValue || []}
                rules={{ required: field.required ? `${field.label} is required` : false }}
                render={({ field: { onChange, onBlur, value } }) => {
                    const selectedValues = Array.isArray(value) ? value : [];

                    // Memoized helper to extract display value from any type
                    const getDisplayValue = React.useCallback((item: any): string => {
                        if (typeof item === 'string') return item;
                        if (item?.stage) return item.stage;
                        return JSON.stringify(item);
                    }, []);

                    // Memoized selected options to prevent recalculation
                    const selectedOptions = React.useMemo(() => {
                        return selectedValues.map((val, index) => ({
                            value: typeof val === 'string' ? val : JSON.stringify(val),
                            label: getDisplayValue(val),
                            originalIndex: index
                        }));
                    }, [selectedValues, getDisplayValue]);

                    // Memoized selection check
                    const isOptionSelected = React.useCallback((optionLabel: string) => {
                        return selectedValues.some(v => getDisplayValue(v) === optionLabel);
                    }, [selectedValues, getDisplayValue]);

                    const handleInputChangeWrapper = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
                        const newValue = e.target.value;
                        setSearchTerm(newValue);
                        setIsOpen(true);
                        updateDropdownPosition();
                        debouncedSearch(newValue);
                    }, [debouncedSearch, updateDropdownPosition]);

                    const handleOptionSelect = React.useCallback((option: TableMultiSelectOption) => {
                        if (disabled) return;
                        const isSelected = isOptionSelected(option.label);
                        let newSelectedValues: any[];

                        if (isSelected) {
                            // Remove from selection
                            newSelectedValues = selectedValues.filter(v => getDisplayValue(v) !== option.label);
                        } else {
                            // Add to selection as proper object
                            const newStageObject = {
                                stage: option.label,
                                name: "", // Will be filled by Frappe
                                idx: selectedValues.length + 1
                            };
                            newSelectedValues = [...selectedValues, newStageObject];
                        }

                        onChange(newSelectedValues);
                        setSearchTerm(""); // Clear search after selection
                    }, [selectedValues, onChange, isOptionSelected]);

                    const handleInputFocus = () => {
                        setIsOpen(true);
                        updateDropdownPosition();
                        performSearch(searchTerm);
                    };

                    const removeSelectedValue = React.useCallback((valueToRemove: string) => {
                        if (disabled) return;
                        const newSelectedValues = selectedValues.filter(v => getDisplayValue(v) !== valueToRemove);
                        onChange(newSelectedValues);
                    }, [selectedValues, onChange, getDisplayValue, disabled]);

                    const clearAll = React.useCallback(() => {
                        if (disabled) return;
                        onChange([]);
                        setSearchTerm("");
                    }, [onChange, disabled]);

                    return (
                        <div className="relative" ref={dropdownRef} style={{ overflow: 'visible' }}>

                            {/* Selected Tags Display */}
                            {selectedOptions.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2 p-2 border border-gray-200 rounded-md bg-gray-50 min-h-[40px]">
                                    {selectedOptions.map((option, index) => (
                                        <div
                                            key={`${option.value}-${index}`}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-sky-100 text-sky-800 rounded-md text-sm"
                                        >
                                            <Tag size={14} />
                                            <span>{option.label}</span>
                                            <X
                                                size={14}
                                                className="cursor-pointer hover:text-sky-600"
                                                onClick={() => removeSelectedValue(option.label)}
                                            />
                                        </div>
                                    ))}
                                    {selectedOptions.length > 0 && (
                                        <button
                                            type="button"
                                            className="text-xs text-gray-500 hover:text-gray-700 self-center"
                                            onClick={clearAll}
                                            disabled={disabled}
                                        >
                                            Clear all
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Input Field */}
                            <div className="relative">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    id={field.name}
                                    className={`form-control w-full pr-10 
                    ${error ? "border-red-500" : ""}`}

                                    placeholder={field.placeholder || `Search ${field.label}...`}
                                    value={searchTerm}
                                    onChange={handleInputChangeWrapper}
                                    onFocus={handleInputFocus}
                                    onBlur={() => {
                                        onBlur();
                                        setTimeout(() => {
                                            setIsOpen(false);
                                        }, 200);
                                    }}
                                    disabled={disabled || !isAuthenticated || !isInitialized}
                                />

                                {/* Icons */}
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-400">
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : searchTerm ? (
                                        <X
                                            className="h-4 w-4 cursor-pointer hover:text-gray-600"
                                            onClick={() => {
                                                setSearchTerm("");
                                                setOptions([]);
                                            }}
                                        />
                                    ) : (
                                        <Search className="h-4 w-4" />
                                    )}
                                </div>
                            </div>

                            {/* Dropdown */}
                            {isOpen && createPortal(
                                <div
                                    ref={dropdownRef}
                                    className="absolute z-[99999] bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
                                    style={{
                                        top: `${dropdownPosition.top}px`,
                                        left: `${dropdownPosition.left}px`,
                                        width: `${dropdownPosition.width}px`
                                    }}
                                >
                                    {options.length > 0 ? (
                                        options.map((option) => {
                                            const isSelected = isOptionSelected(option.label);
                                            return (
                                                <div
                                                    key={`dropdown-${option.value}`}
                                                    className={`px-3 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between
                            ${isSelected ? "bg-sky-50 text-sky-700" : "hover:bg-gray-50"}
                          `}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        handleOptionSelect(option);
                                                    }}
                                                >
                                                    <span>{option.label}</span>
                                                    {isSelected && (
                                                        <div className="w-4 h-4 bg-sky-600 rounded flex items-center justify-center">
                                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="px-3 py-3 text-sm text-gray-500 text-center italic">
                                            {isLoading ? "Searching..." : "No results found"}
                                        </div>
                                    )}
                                </div>,
                                document.body
                            )}
                        </div>
                    );
                }}
            />

            {/* Error Display */}
            {error && <div className="text-red-500 text-xs mt-1">{error.message}</div>}
        </div>
    );
}
