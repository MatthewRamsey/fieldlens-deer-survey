import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Upland Wildlife Management Portal",
  description:
    "Upland Wildlife Management Portal for landowner reporting, buck galleries, and year-based property archives.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
