import type { Metadata, Viewport } from "next";
import { Gowun_Batang, Gowun_Dodum } from "next/font/google";
import "./globals.css";

const dodum = Gowun_Dodum({
  weight: "400",
  subsets: ["latin"],
  preload: false,
  variable: "--font-body",
});

const batang = Gowun_Batang({
  weight: ["400", "700"],
  subsets: ["latin"],
  preload: false,
  variable: "--font-title",
});

export const metadata: Metadata = {
  title: "Lacquer & Pearl — 나전칠기 : 전통 공예 장인",
  description: "옻칠하고, 자개를 오려 붙이고, 갈아내어 나만의 나전칠기를 만드는 힐링 공예 게임",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Lacquer & Pearl", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f6efe3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${dodum.variable} ${batang.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
