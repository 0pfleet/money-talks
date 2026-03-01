import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "money-talks",
  description: "Ask your money questions in plain English",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
