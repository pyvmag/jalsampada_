import axios from "axios";

const API_BASE_URL = "http://103.219.3.169:2223";

export interface RenameDocResponse {
    message: string;
    _server_messages: string;
}

export const renameDocument = async (
    apiKey: string,
    apiSecret: string,
    doctype: string,
    docname: string,
    newName: string
): Promise<RenameDocResponse> => {
    const formData = new FormData();
    formData.append('doctype', doctype);
    formData.append('docname', docname);
    formData.append('name', newName);
    formData.append('enqueue', 'true');
    formData.append('merge', '0');
    formData.append('freeze', 'true');
    formData.append('freeze_message', 'Updating related fields...');

    const response = await axios.post(
        `${API_BASE_URL}/api/method/frappe.model.rename_doc.update_document_title`,
        formData,
        {
            headers: {
                Authorization: `token ${apiKey}:${apiSecret}`,
            },
            withCredentials: true,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        }
    );

    return response.data;
};
