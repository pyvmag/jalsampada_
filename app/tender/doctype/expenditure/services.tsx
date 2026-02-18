import axios from 'axios';

const API_BASE_URL = "http://103.219.3.169:2223/api/resource";

/**
 * Service functions for Expenditure operations
 */

export interface WorkNameResponse {
    work_name: string;
}

export interface PreviousBillDetails {
    bill_number?: string;
    bill_amount?: number;
    mb_no?: string;
    page_no?: string;
    cumulative_amount?: number;
}

/**
 * Fetches work name for a given tender number using SQL query
 * @param tenderNumber - The tender/project number
 * @param apiKey - Frappe API key
 * @param apiSecret - Frappe API secret
 * @returns Promise resolving to work name or null
 */
export async function fetchWorkNameByTenderNumber(
    tenderNumber: string,
    apiKey: string,
    apiSecret: string
): Promise<string | null> {
    try {
        const sqlQuery = `SELECT DISTINCT ps.work_name FROM \`tabProject\` p JOIN \`tabPrapan Suchi\` ps ON p.custom_prapan_suchi = ps.name WHERE p.name = '${tenderNumber}'`;

        const response = await axios.post(
            `${API_BASE_URL.replace("/api/resource", "")}/api/method/quantlis_management.api.frappe_db_sql`,
            { sql_query: sqlQuery },
            {
                headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                    "Content-Type": "application/json",
                },
                withCredentials: true,
            }
        );

        if (response.data?.message && response.data.message.length > 0) {
            return response.data.message[0].work_name;
        }

        return null;
    } catch (error) {
        console.error("Failed to fetch work name:", error);
        throw error;
    }
}

/**
 * Updates work name in all rows of expenditure details table
 * @param formInstance - React Hook Form instance
 * @param workName - The work name to set in all rows
 */
export function updateWorkNameInTableRows(
    formInstance: any,
    workName: string
): void {
    try {
        const currentRows = formInstance.getValues("expenditure_details") || [];

        if (currentRows.length > 0) {
            const updatedRows = currentRows.map((row: any) => ({
                ...row,
                name_of_work: workName
            }));
            formInstance.setValue("expenditure_details", updatedRows, { shouldDirty: true });
        } else {
            // If no rows exist, create first one with work name
            formInstance.setValue("expenditure_details", [{ name_of_work: workName }]);
        }
    } catch (error) {
        console.error("Failed to update work name in table rows:", error);
        throw error;
    }
}

export async function fetchPreviousBillDetails(
    tenderNumber: string,
    currentDocName: string | null,
    apiKey: string,
    apiSecret: string
): Promise<PreviousBillDetails | null> {
    try {
        const queryParams = new URLSearchParams({
            tender_number: tenderNumber,
            ...(currentDocName && { current_doc_name: currentDocName })
        });

        const response = await axios.get(
            `${API_BASE_URL.replace("/api/resource", "")}/api/method/quantlis_management.tendor.doctype.expenditure.expenditure.get_previous_bill_details?${queryParams}`,
            {
                headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                    "Content-Type": "application/json",
                },
                withCredentials: true,
            }
        );

        return response.data.message || null;
    } catch (error: any) {
        console.error("Failed to fetch previous bill details:", error);

        // Check if method doesn't exist
        if (error.response?.data?.exc?.includes("has no attribute 'get_previous_bill_details'")) {
            console.warn("get_previous_bill_details method not found in API. Backend method may need to be properly exposed.");
            return null;
        }

        return null;
    }
}

/**
 * Clears work name from all rows in expenditure details table
 * @param formInstance - React Hook Form instance
 */
export function clearWorkNameInTableRows(formInstance: any): void {
    try {
        const currentRows = formInstance.getValues("expenditure_details") || [];

        if (currentRows.length > 0) {
            const updatedRows = currentRows.map((row: any) => ({
                ...row,
                name_of_work: ""
            }));
            formInstance.setValue("expenditure_details", updatedRows, { shouldDirty: true });
        }
    } catch (error) {
        console.error("Failed to clear work name in table rows:", error);
        throw error;
    }
}
/**
 * Checks if a bill number is unique for a given tender number
 * @param tenderNumber - The tender/project number
 * @param billNumber - The bill number to check
 * @param docName - Optional current document name to exclude (for edit mode)
 * @param apiKey - Frappe API key
 * @param apiSecret - Frappe API secret
 * @returns Promise resolving to boolean (true if unique, false if exists)
 */
export async function checkBillNumberUniqueness(
    tenderNumber: string,
    billNumber: string,
    docName: string | null = null,
    apiKey: string,
    apiSecret: string
): Promise<boolean> {
    if (!tenderNumber || !billNumber) return true;

    try {
        const filters: any[] = [
            ["tender_number", "=", tenderNumber],
            ["bill_number", "=", billNumber],
            ["docstatus", "!=", 2] // Exclude cancelled documents
        ];

        if (docName && docName !== "new") {
            filters.push(["name", "!=", docName]);
        }

        // Use the constant defined at the top of the file
        const apiUrl = `${API_BASE_URL}/Expenditure`;

        const response = await axios.get(
            apiUrl,
            {
                params: {
                    filters: JSON.stringify(filters),
                    fields: JSON.stringify(["name"]),
                    limit_page_length: 1
                },
                headers: {
                    Authorization: `token ${apiKey}:${apiSecret}`,
                    "Content-Type": "application/json",
                },
                withCredentials: true,
            }
        );

        const data = response.data?.data;
        return !data || data.length === 0;
    } catch (error) {
        console.error("Failed to check bill number uniqueness:", error);
        return true;
    }
}
