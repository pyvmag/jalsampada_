"use client";

import * as React from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Search, Loader2, X } from "lucide-react";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

interface LinkInputOption {
    value: string;
    label: string;
}

interface LinkInputProps {
    value: string | undefined;
    onChange: (value: string) => void;
    placeholder?: string;
    linkTarget?: string;
    className?: string;
    filters?: Record<string, any> | ((getValues: (name: string) => any) => Record<string, any>);
    disabled?: boolean;
    searchField?: string;
    customSearchUrl?: string;
    customSearchParams?: Record<string, any>;
    referenceDoctype?: string;
    doctype?: string;
    getValues?: (name: string) => any;
}

export function LinkInput({ value, onChange, placeholder, linkTarget, className, filters = {}, disabled = false, searchField, customSearchUrl, customSearchParams, referenceDoctype, doctype, getValues }: LinkInputProps) {
    const { apiKey, apiSecret, isAuthenticated } = useAuth();

    const [searchTerm, setSearchTerm] = React.useState("");
    const [options, setOptions] = React.useState<LinkInputOption[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isOpen, setIsOpen] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);

    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const searchKey = searchField || "name";

    // Memoized filters to prevent unnecessary re-renders
    const filtersString = React.useMemo(() => JSON.stringify(filters), [filters]);

    // API Search Logic
    const performSearch = React.useCallback(async (term: string) => {
        if (!isAuthenticated || !apiKey || !linkTarget) return;

        setIsLoading(true);
        try {
            // Use custom search URL if provided
            if (customSearchUrl) {
                // Resolve dynamic filters
                const dynamicFilters = typeof filters === 'function' && getValues
                    ? filters(getValues)
                    : (typeof filters === 'object' ? filters : {});

                // Merge filters: prioritize array format from customSearchParams
                let mergedFilters = customSearchParams?.filters;
                if (!Array.isArray(mergedFilters) && Object.keys(dynamicFilters).length > 0) {
                    mergedFilters = mergedFilters
                        ? { ...mergedFilters, ...dynamicFilters }
                        : dynamicFilters;
                }

                const params: Record<string, any> = {
                    txt: term || "",
                    ignore_user_permissions: 0,
                    reference_doctype: referenceDoctype,
                    page_length: 10,
                    doctype: doctype,
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

                const resp = await axios.post(customSearchUrl, formData, {
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
                const activeFilters = typeof filters === 'function' && getValues ? filters(getValues) : filters;

                // Helper to build filter array from active filters
                const buildFilterArray = (baseFilters: any[] = []) => {
                    const result = [...baseFilters];
                    Object.entries(activeFilters).forEach(([key, value]) => {
                        if (value != null && value !== "") {
                            if (Array.isArray(value) && value[0] === "in") {
                                const arrayValues = value[1];
                                if (Array.isArray(arrayValues) && arrayValues.length > 0) {
                                    result.push([linkTarget, key, "in", arrayValues]);
                                }
                            } else if (Array.isArray(value)) {
                                result.push([linkTarget, key, ...value]);
                            } else {
                                result.push([linkTarget, key, "=", value]);
                            }
                        }
                    });
                    return result;
                };

                const searchFilters: any[] = [];
                if (term?.trim()) {
                    if (linkTarget === "Prapan Suchi") {
                        searchFilters.push([linkTarget, "work_name", "like", `%${term.trim()}%`]);
                    } else {
                        searchFilters.push([linkTarget, searchKey, "like", `%${term.trim()}%`]);
                    }
                }

                // 🟢 GLOBAL FILTER: Automatically exclude disabled users for all User link fields
                if (linkTarget === "User") {
                    searchFilters.push([linkTarget, "enabled", "=", 1]);
                }

                const allFilters = buildFilterArray(searchFilters);

                // Determine which fields to fetch based on linkTarget
                let fieldsToFetch = ["name"];
                if (linkTarget === "Prapan Suchi") {
                    fieldsToFetch = ["name", "work_name"];
                } else if (searchKey !== "name") {
                    fieldsToFetch.push(searchKey);
                }

                const query = allFilters.length > 0 ? JSON.stringify(allFilters) : undefined;
                const response = await axios.get(`${API_BASE_URL}/${linkTarget}`, {
                    headers: {
                        Authorization: `token ${apiKey}:${apiSecret}`,
                    },
                    params: {
                        filters: query,
                        fields: JSON.stringify(fieldsToFetch),
                        limit_page_length: 20,
                        order_by: `${searchKey} asc`,
                    },
                });

                if (response.data?.data) {
                    let formattedOptions = response.data.data.map((item: any) => {
                        const label = linkTarget === "Prapan Suchi" ? (item.work_name || item.name) : (item[searchKey] || item.name);
                        // For Prapan Suchi, store work_name as value instead of name
                        const value = linkTarget === "Prapan Suchi" ? (item.work_name || item.name) : item.name;
                        return {
                            value,
                            label,
                        };
                    });

                    // If searching for Prapan Suchi and no results found in work_name, try name field
                    if (linkTarget === "Prapan Suchi" && formattedOptions.length === 0 && term?.trim()) {
                        try {
                            const nameFilters = buildFilterArray([[linkTarget, "name", "like", `%${term.trim()}%`]]);

                            const nameQuery = nameFilters.length > 0 ? JSON.stringify(nameFilters) : undefined;
                            const nameResponse = await axios.get(`${API_BASE_URL}/${linkTarget}`, {
                                headers: {
                                    Authorization: `token ${apiKey}:${apiSecret}`,
                                },
                                params: {
                                    filters: nameQuery,
                                    fields: JSON.stringify(fieldsToFetch),
                                    limit_page_length: 20,
                                },
                            });

                            if (nameResponse.data?.data) {
                                formattedOptions = nameResponse.data.data.map((item: any) => {
                                    const label = item.work_name || item.name;
                                    // For Prapan Suchi, store work_name as value instead of name
                                    const value = item.work_name || item.name;
                                    return {
                                        value,
                                        label,
                                    };
                                });
                            }
                        } catch (fallbackError) {
                            console.log("Fallback search failed:", fallbackError);
                        }
                    }

                    setOptions(formattedOptions);
                }
            }
        } catch (error) {
            console.error("LinkInput search error:", error);
            setOptions([]);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, apiKey, apiSecret, linkTarget, customSearchUrl, customSearchParams, referenceDoctype, doctype, searchKey, filters, getValues, filtersString]);

    // Optimized debounced search with useCallback
    const debouncedSearch = React.useCallback((term: string) => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = setTimeout(() => {
            if (term !== value) {
                performSearch(term);
            }
        }, 300);
    }, [performSearch, value]);

    // Sync external value when not focused
    React.useEffect(() => {
        if (!isFocused) {
            setSearchTerm(value || "");
        }
    }, [value, isFocused]);

    // Debounced search effect
    React.useEffect(() => {
        debouncedSearch(searchTerm);
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchTerm, debouncedSearch]);

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Display logic
    const displayValue = isFocused ? searchTerm : (value || "");

    // Filter options based on search term
    const filteredOptions = React.useMemo(() => {
        if (!searchTerm?.trim()) {
            return options;
        }
        return options.filter(option =>
            option.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm]);

    // Input handlers
    const handleFocus = React.useCallback(() => {
        if (disabled) return;
        setIsFocused(true);
        setSearchTerm(value || "");
        setIsOpen(true);
        performSearch(value || "");
    }, [disabled, value, performSearch]);

    const handleBlur = React.useCallback(() => {
        setTimeout(() => {
            setIsFocused(false);
            if (searchTerm !== value) {
                setSearchTerm(value || ""); // Restore original
            }
        }, 200);
    }, [value, searchTerm]);

    const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        const newValue = e.target.value;
        setSearchTerm(newValue);
        setIsOpen(true);

        // Only call onChange on clear
        if (newValue === "") {
            onChange("");
        }
    }, [disabled, onChange]);

    const handleOptionSelect = React.useCallback((option: LinkInputOption) => {
        if (disabled) return;
        setSearchTerm(option.value);
        onChange(option.value); // Update on selection
        setIsOpen(false);
        setIsFocused(false);
    }, [disabled, onChange]);

    const handleClear = React.useCallback(() => {
        if (disabled) return;
        setSearchTerm("");
        onChange("");
        setIsOpen(false);
    }, [disabled, onChange]);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={displayValue}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder={placeholder || `Select ${linkTarget}...`}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none form-control focus:border-transparent"
                    autoComplete="off"
                    spellCheck="false"
                    disabled={disabled}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-400">
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : value ? (
                        <X
                            className="h-4 w-4 cursor-pointer hover:text-gray-600"
                            onClick={handleClear}
                        />
                    ) : (
                        <Search className="h-4 w-4" />
                    )}
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option, index) => (
                            <div
                                key={`${option.value}-${index}`}
                                onClick={() => handleOptionSelect(option)}
                                className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                                {option.label}
                            </div>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-gray-500 text-sm">
                            {isLoading ? "Searching..." : searchTerm ? "No results found" : "Type to search..."}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
