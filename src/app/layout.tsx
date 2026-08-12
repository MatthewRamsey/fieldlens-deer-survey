import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Upland Wildlife Management",
  description:
    "A branded deer camera survey and reporting portal for Upland Wildlife Management, built for landowner reporting, buck galleries, and year-based property archives.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
