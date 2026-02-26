import axios from "axios";

const API_BASE_URL = "http://103.219.3.169:2223";

export interface FetchAssetsFromLisAndStageParams {
    custom_lis_name: string;
    custom_stage: string;
    custom_asset_category: string;
}

export interface FetchAssetsFromLisAndStageResponse {
    message: string[];
}

export async function fetchAssetsFromLisAndStage(
    params: FetchAssetsFromLisAndStageParams,
    apiKey: string,
    apiSecret: string
): Promise<string[]> {
    try {
        const response = await axios.post<FetchAssetsFromLisAndStageResponse>(
            `${API_BASE_URL}/api/method/quantlis_management.quantlis_utils.fetch_assets_from_lis_and_stage`,
            params,
            {
                headers: { Authorization: `token ${apiKey}:${apiSecret}` },
            }
        );

        return Array.isArray(response.data?.message) ? response.data.message : [];
    } catch (error) {
        console.error("Failed to fetch assets:", error);
        throw error;
    }
}

export interface FetchItemDetailsParams {
    item_code: string;
    material_request_type: string;
}

export interface FetchItemDetailsResponse {
    item_code: string;
    item_name: string;
    description: string;
    warehouse: string;
    uom: string;
    conversion_factor: number;
    rate: number;
    amount: number;
    item_group: string;
    qty: number;
}

export async function fetchItemDetails(
    params: FetchItemDetailsParams,
    apiKey: string,
    apiSecret: string
): Promise<FetchItemDetailsResponse | null> {
    try {
        const formData = new FormData();
        formData.append(
            "ctx",
            JSON.stringify({
                item_code: params.item_code,
                doctype: "Material Request",
                buying_price_list: "Standard Buying",
                currency: "INR",
                qty: 1,
                company: "quantbit",
                conversion_rate: 1,
                material_request_type: params.material_request_type || "Material Issue",
                plc_conversion_rate: 1,
                rate: 0,
                uom: ""
            })
        );
        formData.append("overwrite_warehouse", "true");

        const response = await axios.post(
            `${API_BASE_URL}/api/method/erpnext.stock.get_item_details.get_item_details`,
            formData,
            {
                headers: { Authorization: `token ${apiKey}:${apiSecret}` }
            }
        );

        return response.data?.message || null;
    } catch (error) {
        console.error("Failed to fetch item details:", error);
        throw error;
    }
}