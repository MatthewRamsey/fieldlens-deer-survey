import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FieldLens Deer Survey",
  description:
    "A multi-client deer camera survey platform for wildlife biologists with AI review, mapping, dashboards, and printable buck books.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
