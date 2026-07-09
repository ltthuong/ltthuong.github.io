import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://thuo.ng"),
  title: {
    default: "Thưởng — Full-stack Engineer",
    template: "%s · thuo.ng",
  },
  description:
    "Full-stack engineer building web & mobile products end to end — from database to pixel. 7 years shipping EdTech. Available for remote & freelance.",
  keywords: [
    "Full-stack engineer",
    "React",
    "React Native",
    "Node.js",
    "DevOps",
    "Vietnam",
    "Hà Nội",
    "Thưởng",
  ],
  authors: [{ name: "Thưởng" }],
  openGraph: {
    title: "Thưởng — Full-stack Engineer",
    description: "Web & mobile products, end to end. From database to pixel.",
    url: "https://thuo.ng",
    siteName: "thuo.ng",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Thưởng — Full-stack Engineer",
    description: "Web & mobile products, end to end.",
  },
};

export const viewport: Viewport = { themeColor: "#050506" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-bg text-ink font-sans antialiased">
        <div className="grain" aria-hidden />
        {children}
      </body>
    </html>
  );
}
