"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Controller } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";
import { FormField } from "./DynamicFormComponent";
import { Search, Loader2, X } from "lucide-react";

const API_BASE_URL = "http://103.219.1.138:4412/api/resource";

interface LinkFieldOption {
  value: string;
  label: string;
}

interface LinkFieldProps {
  control: any;
  // Support custom searchField
  field: FormField & { defaultValue?: string; linkTarget?: string; searchField?: string; customSearchUrl?: string; customSearchParams?: Record<string, any> };
  error?: any;
  className?: string;
  filters?: Record<string, any>;
  getQuery?: (filters: Record<string, any>) => string;
  disabled?: boolean;
}

export function LinkField({ control, field, error, className, filters = {}, getQuery, disabled = false }: LinkFieldProps) {
  const { apiKey, apiSecret, isAuthenticated, isInitialized } = useAuth();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [options, setOptions] = React.useState<LinkFieldOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, left: 0, width: 0 });

  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Store the full selected option object (ID + Label)
  const selectedOptionRef = React.useRef<LinkFieldOption | null>(null);

  const searchKey = field.searchField || "name";

  // --- API Search Logic ---
  const performSearch = React.useCallback(async (term: string) => {
    if (!isAuthenticated || !apiKey || !field.linkTarget) return;

    setIsLoading(true);
    try {
      // Use custom search URL if provided
      if (field.customSearchUrl) {
        // Resolve dynamic filters
        const rawFilters = typeof field.filters === 'function'
          ? field.filters((name: string) => {
            // Fallback to internal form values if needed, but prefer passed filters
            const formValues = control._formValues || {};
            return formValues[name];
          })
          : (typeof field.filters === 'object' ? field.filters : {});

        // Create a new object to avoid mutating the field definition
        const dynamicFilters = { ...rawFilters };

        // 🟢 MERGE: respect the 'filters' prop passed to this component
        if (filters && Object.keys(filters).length > 0) {
          Object.assign(dynamicFilters, filters);
        }

        // Merge filters: prioritize array format from customSearchParams
        let mergedFilters = field.customSearchParams?.filters;
        if (!Array.isArray(mergedFilters) && Object.keys(dynamicFilters).length > 0) {
          mergedFilters = mergedFilters
            ? { ...mergedFilters, ...dynamicFilters }
            : dynamicFilters;
        }

        const params: Record<string, any> = {
          txt: term || "",
          ignore_user_permissions: 0,
          reference_doctype: field.referenceDoctype,
          page_length: 10,
          doctype: field.doctype,
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

        const resp = await axios.post(field.customSearchUrl, formData, {
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
        const searchFilters: any[] = [];
        if (term?.trim()) {
          searchFilters.push([field.linkTarget, searchKey, "like", `%${term.trim()}%`]);
        }

        // 🟢 GLOBAL FILTER: Automatically exclude disabled users for all User link fields
        if (field.linkTarget === "User") {
          searchFilters.push([field.linkTarget, "enabled", "=", 1]);
        }

        Object.entries(filters).forEach(([key, value]) => {
          if (value != null && value !== "") {
            if (Array.isArray(value) && value.length === 2) {
              searchFilters.push([field.linkTarget, key, value[0], value[1]]);
            } else {
              searchFilters.push([field.linkTarget, key, "=", value]);
            }
          }
        });

        const query = getQuery ? getQuery(filters) : JSON.stringify(searchFilters);

        const fieldsToFetch = ["name"];
        if (searchKey !== "name") fieldsToFetch.push(searchKey);

        const resp = await axios.get(`${API_BASE_URL}/${field.linkTarget}`, {
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
      console.error("LinkField search error:", e);
      setOptions([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, apiKey, apiSecret, field.linkTarget, field.customSearchUrl, field.customSearchParams, field.filters, filters, getQuery, searchKey]);

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

  return (
    <div className={`form-group ${className || ""}`} style={{ overflow: 'visible' }}>
      <label htmlFor={field.name} className="form-label">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </label>

      <Controller
        control={control}
        name={field.name}
        defaultValue={field.defaultValue || ""}
        rules={{
          required: field.required ? `${field.label} is required` : false,
          validate: (value) => {
            // Custom validation to ensure the field is not just an empty string
            if (field.required && (!value || value.trim() === '')) {
              return `${field.label} is required`;
            }
            return true;
          }
        }}
        render={({ field: { onChange, onBlur, value } }) => {

          React.useEffect(() => {
            if (value && !selectedOptionRef.current && (!searchTerm || searchTerm === value)) {
              // Temporarily show ID to prevent empty field
              if (!searchTerm) setSearchTerm(value);

              const fetchLabel = async () => {
                if (!isAuthenticated || !apiKey) return;
                try {
                  const fieldsToFetch = ["name"];
                  if (searchKey !== "name") fieldsToFetch.push(searchKey);

                  const resp = await axios.get(`${API_BASE_URL}/${field.linkTarget}`, {
                    params: {
                      filters: JSON.stringify([["name", "=", value]]),
                      fields: JSON.stringify(fieldsToFetch)
                    },
                    headers: { Authorization: `token ${apiKey}:${apiSecret}` },
                  });

                  if (resp.data?.data?.[0]) {
                    const row = resp.data.data[0];
                    const label = row[searchKey] || row.name;

                    // Update cache so it sticks
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
          }, []); // Run once on mount (per key change)

          // 🟢 2. SYNC LOGIC (Keeps Label displayed)
          React.useEffect(() => {
            if (!isOpen) {
              // Case A: We have a cached label for this value -> Show Label
              if (selectedOptionRef.current && selectedOptionRef.current.value === value) {
                if (searchTerm !== selectedOptionRef.current.label) {
                  setSearchTerm(selectedOptionRef.current.label);
                }
              }
              // Case B: No cache yet (Fetch hasn't finished) -> Show ID
              else if (value && value !== searchTerm && !selectedOptionRef.current) {
                setSearchTerm(value);
              }
              // Case C: Value cleared -> Clear search
              else if (!value && searchTerm) {
                setSearchTerm("");
              }
            }
          }, [value, isOpen]);

          const handleInputChangeWrapper = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            setSearchTerm(newValue);
            setIsOpen(true);
            updateDropdownPosition();
            debouncedSearch(newValue);

            // If user clears input, clear the selection cache
            if (!newValue) selectedOptionRef.current = null;
          };

          const handleOptionSelect = (option: LinkFieldOption) => {
            // 1. Update Visuals (Display Label)
            setSearchTerm(option.label);

            // 2. Cache the selection
            selectedOptionRef.current = option;

            // 3. Update Data (Store ID)
            onChange(option.value);

            setIsOpen(false);
          };

          const handleInputFocus = () => {
            setIsOpen(true);
            updateDropdownPosition();
            performSearch(searchTerm);
          };

          return (
            <div className="relative" ref={dropdownRef} style={{ overflow: 'visible' }}>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  id={field.name}
                  className={`form-control w-full pr-10 
                    ${error ? "border-red-500 !border-red-500 !ring-red-500 !focus:border-red-500 !focus:ring-red-500 ring-1 ring-red-500" : ""}
                    ${!isAuthenticated ? "bg-gray-50 cursor-not-allowed" : ""}`}
                  placeholder={field.placeholder || `Select ${field.label}...`}
                  value={searchTerm}
                  onChange={handleInputChangeWrapper}
                  onFocus={handleInputFocus}
                  onBlur={() => {
                    onBlur();
                    setTimeout(() => {
                      if (!options.find(o => o.label === searchTerm) && searchTerm !== (selectedOptionRef.current?.label || value)) {
                        setSearchTerm(selectedOptionRef.current?.label || value || "");
                      }
                      setIsOpen(false);
                    }, 200);
                  }}
                  disabled={disabled || !isAuthenticated || !isInitialized}
                />

                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-400">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : searchTerm ? (
                    <X
                      className="h-4 w-4 cursor-pointer hover:text-gray-600"
                      onClick={() => {
                        if (disabled) return;
                        setSearchTerm("");
                        onChange("");
                        selectedOptionRef.current = null;
                        setOptions([]);
                      }}
                    />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </div>
              </div>

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
                    options.map((option) => (
                      <div
                        key={option.value}
                        className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleOptionSelect(option);
                        }}
                      >
                        {option.label}
                      </div>
                    ))
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
      {error && <div className="text-red-500 text-xs mt-1">{error.message}</div>}
    </div>
  );
}