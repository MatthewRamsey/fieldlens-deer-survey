import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Upland Wildlife Management Portal",
  description:
    "Upland Wildlife Management Portal for landowner reports, Digital Buck Books, and year-based property archives.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={cn("font-sans", inter.variable)}>
      <body>{children}<Analytics /></body>
    </html>
  );
}
