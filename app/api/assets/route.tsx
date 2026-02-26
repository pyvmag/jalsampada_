import { NextResponse } from "next/server";

export async function GET() {
  try {
    // This fetch runs on YOUR server, so there is no CORS error
    const response = await fetch("http://103.219.3.169:2223//api/resource/Asset", {
      cache: 'no-store', // Ensures you always get fresh data
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from Frappe: ${response.statusText}`);
    }

    const data = await response.json();

    // Send the data back to your page
    return NextResponse.json(data);

  } catch (error) {
    console.error("API Error:", error);
    // Send a clear error message back to the page
    return NextResponse.json(
      { error: "Failed to fetch data from Frappe API" },
      { status: 500 }
    );
  }
}