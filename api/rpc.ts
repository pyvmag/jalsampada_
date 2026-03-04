// api/rpc.ts
import axios from "axios";

export async function bulkDeleteRPC(
  doctype: string,
  ids: string[],
  baseUrl: string,
  apiKey: string,
  apiSecret: string
) {
  // Frappe RPC endpoint for deleting items
  const url = `${baseUrl}/api/method/frappe.desk.reportview.delete_items`;

  // Payload must be Form Data with "items" as a stringified array
  const params = new URLSearchParams();
  params.append("items", JSON.stringify(ids));
  params.append("doctype", doctype);

  const response = await axios.post(url, params, {
    headers: {
      Authorization: `token ${apiKey}:${apiSecret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    withCredentials: true,
  });

  return response.data;
}

export async function checkProjectExtension(
  projectName: string,
  baseUrl: string,
  apiKey: string,
  apiSecret: string
) {
  const url = `${baseUrl}/api/method/check_project_extension`;

  const params = new URLSearchParams();
  params.append("project_name", projectName);

  const response = await axios.post(url, params, {
    headers: {
      Authorization: `token ${apiKey}:${apiSecret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    withCredentials: true,
  });

  return response.data;
}
// Add to api/rpc.ts

export async function fetchDocumentTimeline(
  doctype: string,
  docname: string,
  baseUrl: string,
  apiKey: string,
  apiSecret: string
) {
  // We use GET here because this specific RPC method accepts URL parameters
  const url = `${baseUrl}/api/method/frappe.desk.form.load.getdoc`;

  const response = await axios.get(url, {
    params: {
      doctype: doctype,
      name: docname,
    },
    headers: {
      Authorization: `token ${apiKey}:${apiSecret}`,
    },
    withCredentials: true,
  });

  return response.data;
}

export async function addCommentRPC(
  doctype: string,
  docname: string,
  content: string,
  baseUrl: string,
  apiKey: string,
  apiSecret: string
) {
  // Use the standard REST API to create a Comment record
  const url = `${baseUrl}/api/resource/Comment`;

  const payload = {
    comment_type: "Comment",
    reference_doctype: doctype,
    reference_name: docname,
    content: content,
  };

  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `token ${apiKey}:${apiSecret}`,
      "Content-Type": "application/json",
    },
    withCredentials: true,
  });

  return response.data;
}

export async function updateCommentRPC(
  commentId: string,
  content: string,
  baseUrl: string,
  apiKey: string,
  apiSecret: string
) {
  const url = `${baseUrl}/api/resource/Comment/${commentId}`;
  const payload = { content: content };

  const response = await axios.put(url, payload, {
    headers: {
      Authorization: `token ${apiKey}:${apiSecret}`,
      "Content-Type": "application/json",
    },
    withCredentials: true,
  });

  return response.data;
}

export async function deleteCommentRPC(
  commentId: string,
  baseUrl: string,
  apiKey: string,
  apiSecret: string
) {
  const url = `${baseUrl}/api/resource/Comment/${commentId}`;

  const response = await axios.delete(url, {
    headers: {
      Authorization: `token ${apiKey}:${apiSecret}`,
    },
    withCredentials: true,
  });

  return response.data;
}
