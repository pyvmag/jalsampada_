import type { Metadata } from "next";
import ClientLayout from "./ClientLayout";

// This is allowed now because there is no "use client" in this file
export const metadata: Metadata = {
  title: "Jalsampada | Asset Management",
  description: "Water Resource Department ERP System",
  icons: {
    icon: "/maharashtra.png", 
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClientLayout>
            {children}
        </ClientLayout>
      </body>
    </html>
  );
}