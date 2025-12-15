import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Book Your Show - Sri Lanka Events Booking",
  description: "Reserve seats for live events in Sri Lanka",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
