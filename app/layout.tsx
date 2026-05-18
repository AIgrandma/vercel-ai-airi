import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI あいり",
  description: "LINE Bot - AI あいり",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
