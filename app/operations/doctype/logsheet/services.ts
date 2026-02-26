import { UseFormReturn } from "react-hook-form";

const API_BASE_URL = "http://103.219.3.169:2223";

export interface TemperatureRow {
    temperature: string;
    temp_value: number | null;
}

export interface UserInfo {
    user: string;
    full_name: string;
}

export const fetchCurrentUserInfo = async (
    apiKey: string,
    apiSecret: string
): Promise<UserInfo | null> => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/method/quantlis_management.api.get_current_user_info`,
            {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    Authorization: `token ${apiKey}:${apiSecret}`,
                },
            }
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        return data.message || null;
    } catch (error) {
        console.error("Error fetching user info:", error);
        return null;
    }
};

export const fetchTemperatureNames = async (
    apiKey: string,
    apiSecret: string
): Promise<TemperatureRow[]> => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/method/quantlis_management.operations.doctype.log_sheet.log_sheet.get_temperature_names`,
            {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    Authorization: `token ${apiKey}:${apiSecret}`,
                },
            }
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const temperatureNames = data.message || [];

        // Transform temperature names into table rows
        return temperatureNames.map((name: string) => ({
            temperature: name,
            temp_value: null
        }));
    } catch (error) {
        console.error("Error fetching temperature names:", error);
        return [];
    }
};

export const populateUserInfo = (
    userInfo: UserInfo | null,
    formMethods: UseFormReturn<any> | null
) => {
    if (userInfo?.user && userInfo?.full_name && formMethods) {
        formMethods.setValue("operator_id", userInfo.user);
        formMethods.setValue("operator_name", userInfo.full_name);
    }
};

export const populateTemperatureReadings = (
    temperatureRows: TemperatureRow[],
    formMethods: UseFormReturn<any> | null
) => {
    if (formMethods) {
        formMethods.setValue("temperature_readings", temperatureRows);
    }
};