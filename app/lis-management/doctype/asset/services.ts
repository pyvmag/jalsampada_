import axios from 'axios';

const FRAPPE_BASE_URL = "http://103.219.3.169:2223";

export interface LogsheetData {
    name: string;
    water_level: number;
    pressure_guage: number;
    br: number;
    ry: number;
    yb: number;
    r: number;
    y: number;
    b: number;
    date: string;
    time: string;
}

export interface MaintenanceData {
    maintenance_task: string;
    maintenance_status: string;
    start_date: string;
    end_date: string;
    next_due_date: string;
    last_completion_date: string;
}

export const fetchLogsheetData = async (
    lisName: string,
    stageNo: string,
    assetName: string,
    apiKey: string,
    apiSecret: string
): Promise<LogsheetData[]> => {
    try {
        const response = await axios.get(
            `${FRAPPE_BASE_URL}/api/method/quantlis_management.api.get_logsheet_data`,
            {
                params: {
                    lis: lisName,
                    stage: stageNo,
                    asset: assetName
                },
                headers: { Authorization: `token ${apiKey}:${apiSecret}` }
            }
        );
        return response.data.message || [];
    } catch (err) {
        console.error('Failed to fetch logsheet data:', err);
        throw new Error('Failed to load logsheet data');
    }
};

export const fetchMaintenanceData = async (
    lisName: string,
    stageNo: string,
    assetName: string,
    apiKey: string,
    apiSecret: string
): Promise<MaintenanceData[]> => {
    try {
        const response = await axios.get(
            `${FRAPPE_BASE_URL}/api/method/quantlis_management.api.get_maintenance_data`,
            {
                params: {
                    lis: lisName,
                    stage: stageNo,
                    asset: assetName
                },
                headers: { Authorization: `token ${apiKey}:${apiSecret}` }
            }
        );
        return response.data.message || [];
    } catch (err) {
        console.error('Failed to fetch maintenance data:', err);
        throw new Error('Failed to load maintenance data');
    }
};