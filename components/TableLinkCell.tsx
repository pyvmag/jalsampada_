"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Controller, useFormContext } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";
import { Search, Loader2, X } from "lucide-react";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

interface TableLinkOption {
    value: string;
    label: string;
}

interface TableLinkCellProps {
    control: any;
    fieldName: string;
    column: {
        linkTarget?: string;
        required?: boolean;
        placeholder?: string;
        filters?: Record<string, any> | ((getValues: (name: string) => any) => Record<string, any>);
        searchField?: string;
        customSearchUrl?: string;
        customSearchParams?: Record<string, any>;
        referenceDoctype?: string;
        doctype?: string;
    };
    filters?: Record<string, any>;
    onValueChange?: (value: any) => void;
    disabled?: boolean;
}

export function TableLinkCell({ control, fieldName, column, filters = {}, onValueChange, disabled = false }: TableLinkCellProps) {
    const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();
    const { getValues } = useFormContext();

    const [searchTerm, setSearchTerm] = React.useState("");
    const [options, setOptions] = React.useState<TableLinkOption[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isOpen, setIsOpen] = React.useState(false);
    const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, left: 0, width: 0 });

    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const getCompositeValue = React.useCallback((name: string) => {
        if (name.startsWith("parent.")) {
            return getValues(name.replace("parent.", ""));
        }

        const lastDotIndex = fieldName.lastIndexOf(".");
        if (lastDotIndex !== -1) {
            const rowPrefix = fieldName.substring(0, lastDotIndex);
            const rowValue = getValues(`${rowPrefix}.${name}`);
            if (rowValue !== undefined) return rowValue;
        }

        return getValues(name);
    }, [fieldName, getValues]);

    const searchKey = column.searchField || "name";

    const performSearch = React.useCallback(async (term: string) => {
        if (!isAuthenticated || !apiKey || !column.linkTarget) return;

        setIsLoading(true);
        try {
            // Use custom search URL if provided
            if (column.customSearchUrl) {
                // Resolve dynamic filters
                let activeFilters = { ...filters };
                if (typeof column.filters === 'function') {
                    activeFilters = { ...activeFilters, ...column.filters(getCompositeValue) };
                } else if (column.filters) {
                    activeFilters = { ...activeFilters, ...column.filters };
                }

                // Merge filters: prioritize array format from customSearchParams
                let mergedFilters = column.customSearchParams?.filters;
                if (!Array.isArray(mergedFilters) && Object.keys(activeFilters).length > 0) {
                    mergedFilters = mergedFilters
                        ? { ...mergedFilters, ...activeFilters }
                        : activeFilters;
                }

                const params: Record<string, any> = {
                    txt: term || "",
                    ignore_user_permissions: 0,
                    reference_doctype: column.referenceDoctype,
                    page_length: 10,
                    doctype: column.doctype,
                    filters: mergedFilters
                };

                const formData = new URLSearchParams();
                Object.entries(params).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        if (key === 'filters' && typeof value === 'object') {
                            formData.append(key, JSON.stringify(value));
                        } else {
                            formData.append(key, String(value));
                        }
                    }
                });

                const resp = await axios.post(column.customSearchUrl, formData, {
                    headers: {
                        Authorization: `token ${apiKey}:${apiSecret}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    withCredentials: true,
                });

                const message = resp.data.message || [];
                setOptions(message.map((r: any) => ({
                    value: r.value,
                    label: r.label || r.value
                })));
            } else {
                // Default search logic
                let activeFilters = { ...filters };
                if (typeof column.filters === 'function') {
                    const dynamic = column.filters(getCompositeValue);
                    activeFilters = { ...activeFilters, ...dynamic };
                } else if (column.filters) {
                    activeFilters = { ...activeFilters, ...column.filters };
                }

                const searchFilters: any[] = [];
                if (term?.trim()) {
                    searchFilters.push([column.linkTarget, searchKey, "like", `%${term.trim()}%`]);
                }

                // 🟢 GLOBAL FILTER: Automatically exclude disabled users for all User link fields
                if (column.linkTarget === "User") {
                    searchFilters.push([column.linkTarget, "enabled", "=", 1]);
                }

                // 🟢 GLOBAL FILTER: Automatically exclude disabled items for all Item link fields
                if (column.linkTarget === "Item") {
                    searchFilters.push([column.linkTarget, "disabled", "=", 0]);
                }

                Object.entries(activeFilters).forEach(([key, value]) => {
                    if (value != null && value !== "") {
                        if (Array.isArray(value)) {
                            searchFilters.push([column.linkTarget, key, ...value]);
                        } else {
                            searchFilters.push([column.linkTarget, key, "=", value]);
                        }
                    }
                });

                const fieldsToFetch = ["name"];
                if (searchKey !== "name") fieldsToFetch.push(searchKey);

                const query = JSON.stringify(searchFilters);

                const resp = await axios.get(`${API_BASE_URL}/${column.linkTarget}`, {
                    params: {
                        fields: JSON.stringify(fieldsToFetch),
                        limit_page_length: "20",
                        order_by: `${searchKey} asc`,
                        filters: query
                    },
                    headers: { Authorization: `token ${apiKey}:${apiSecret}` },
                    withCredentials: true,
                });

                const raw = (resp.data.data || []) as any[];
                setOptions(raw.map((r) => ({
                    value: r.name,
                    label: r[searchKey] || r.name
                })));
            }
        } catch (e) {
            console.error("TableLinkCell search error:", e);
            setOptions([]);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, apiKey, apiSecret, column, filters, getCompositeValue, searchKey]);

    const debouncedSearch = React.useCallback((term: string) => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => performSearch(term), 300);
    }, [performSearch]);

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

    React.useEffect(() => {
        if (!isOpen) return;
        const handlePositionUpdate = () => updateDropdownPosition();
        window.addEventListener('scroll', handlePositionUpdate, true);
        window.addEventListener('resize', handlePositionUpdate);
        return () => {
            window.removeEventListener('scroll', handlePositionUpdate, true);
            window.removeEventListener('resize', handlePositionUpdate);
        };
    }, [isOpen, updateDropdownPosition]);

    const selectedOptionRef = React.useRef<TableLinkOption | null>(null);

    const handleChange = React.useCallback((newValue: string) => {
        if (disabled) return;
        if (onValueChange) {
            onValueChange(newValue);
        }
    }, [disabled, onValueChange]);

    return (
        <div className="relative" ref={dropdownRef} style={{ overflow: 'visible' }}>
            <Controller
                control={control}
                name={fieldName}
                rules={{ required: column.required ? "This field is required" : false }}
                render={({ field: { onChange, onBlur, value } }) => {

                    // 1. Initial Load: Fetch Label if we have an ID but no Label
                    React.useEffect(() => {
                        if (value && !selectedOptionRef.current && (!searchTerm || searchTerm === value)) {
                            // Temporarily show ID
                            if (!searchTerm) setSearchTerm(value);

                            const fetchLabel = async () => {
                                if (!isAuthenticated || !apiKey) return;
                                try {
                                    const fieldsToFetch = ["name"];
                                    if (searchKey !== "name") fieldsToFetch.push(searchKey);

                                    const resp = await axios.get(`${API_BASE_URL}/${column.linkTarget}`, {
                                        params: {
                                            filters: JSON.stringify([["name", "=", value]]),
                                            fields: JSON.stringify(fieldsToFetch)
                                        },
                                        headers: { Authorization: `token ${apiKey}:${apiSecret}` },
                                    });

                                    if (resp.data?.data?.[0]) {
                                        const row = resp.data.data[0];
                                        const label = row[searchKey] || row.name;

                                        // Update cache
                                        selectedOptionRef.current = { value: row.name, label: label };
                                        // Update display
                                        setSearchTerm(label);
                                    }
                                } catch (e) {
                                    console.error("Autofetch label failed", e);
                                }
                            };
                            fetchLabel();
                        }
                    }, []);

                    // 2. Sync Logic
                    React.useEffect(() => {
                        if (!isOpen) {
                            if (selectedOptionRef.current && selectedOptionRef.current.value === value) {
                                if (searchTerm !== selectedOptionRef.current.label) {
                                    setSearchTerm(selectedOptionRef.current.label);
                                }
                            } else if (value && value !== searchTerm && !selectedOptionRef.current) {
                                setSearchTerm(value);
                            } else if (!value && searchTerm) {
                                setSearchTerm("");
                            }
                        }
                    }, [value, isOpen]);

                    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                        if (disabled) return;
                        const newValue = e.target.value;
                        setSearchTerm(newValue);
                        setIsOpen(true);
                        updateDropdownPosition();
                        debouncedSearch(newValue);

                        // Clear cache if user types
                        if (!newValue) selectedOptionRef.current = null;

                        // Optimization: If they typed the exact label of an option we know (unlikely but possible)
                        // But mostly we rely on selection. 
                        // Unlike LinkField, we don't auto-set value on typing unless it's a clear match or strict mode.
                        // Here we just let them type and search.
                    };

                    const handleOptionSelect = (option: TableLinkOption) => {
                        if (disabled) return;
                        // 1. Update Visuals
                        setSearchTerm(option.label);
                        // 2. Update Cache
                        selectedOptionRef.current = option;
                        // 3. Update Data
                        onChange(option.value);
                        setIsOpen(false);
                        handleChange(option.value);
                    };

                    const handleInputFocus = () => {
                        if (disabled) return;
                        setIsOpen(true);
                        updateDropdownPosition();
                        performSearch(searchTerm);
                    };

                    return (
                        <>
                            <div className="relative">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className={`form-control-borderless w-full pr-8 ${!isAuthenticated ? "bg-gray-50 cursor-not-allowed" : ""}`}
                                    placeholder={column.placeholder || "Search..."}
                                    value={searchTerm}
                                    onChange={handleInputChange}
                                    onFocus={handleInputFocus}
                                    onBlur={() => {
                                        onBlur();
                                        setTimeout(() => {
                                            if (!options.find(o => o.label === searchTerm) && searchTerm !== value) {
                                                setSearchTerm(value || "");
                                            }
                                            setIsOpen(false);
                                        }, 200);
                                    }}
                                    disabled={disabled || !isAuthenticated || !isInitialized}
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-400">
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                        searchTerm ? <X className="h-4 w-4 cursor-pointer hover:text-gray-600" onClick={() => { if (disabled) return; setSearchTerm(""); onChange(""); setOptions([]); handleChange(""); }} /> :
                                            <Search className="h-4 w-4" />}
                                </div>
                            </div>
                            {isOpen && !disabled && createPortal(
                                <div
                                    ref={dropdownRef}
                                    className="absolute z-[99999] bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
                                    style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px`, width: `${dropdownPosition.width}px` }}
                                >
                                    {options.length > 0 ? options.map((option) => (
                                        <div key={option.value} className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors" onMouseDown={(e) => { e.preventDefault(); handleOptionSelect(option); }}>
                                            {option.label}
                                        </div>
                                    )) : <div className="px-3 py-3 text-sm text-gray-500 text-center italic">{isLoading ? "Searching..." : "No results found"}</div>}
                                </div>,
                                document.body
                            )}
                        </>
                    );
                }}
            />
        </div>
    );
}