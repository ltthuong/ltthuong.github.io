import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Be_Vietnam_Pro, Geist_Mono, Fraunces } from "next/font/google";
import { Cursor } from "@/components/cursor";
import { Preloader } from "@/components/preloader";
import { INTRO_SKIP_SCRIPT } from "@/lib/intro";
import { LOCALES, getDictionary, hasLocale } from "./dictionaries";
import "../globals.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500"],
  display: "swap",
});
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const TITLE = "Thưởng";

type Params = { params: Promise<{ lang: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) {
    notFound();
  }
  const { meta } = getDictionary(lang);
  return {
    metadataBase: new URL("https://thuo.ng"),
    title: TITLE,
    description: meta.description,
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
    alternates: {
      canonical: `/${lang}`,
      languages: { en: "/en", vi: "/vi", "x-default": "/" },
    },
    openGraph: {
      title: TITLE,
      description: meta.description,
      url: `https://thuo.ng/${lang}`,
      siteName: "thuo.ng",
      type: "website",
      locale: meta.ogLocale,
    },
    twitter: { card: "summary_large_image", title: TITLE, description: meta.description },
  };
}

export const viewport: Viewport = { themeColor: "#0b0807" };

export default async function RootLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode }> & Params) {
  const { lang } = await params;
  if (!hasLocale(lang)) {
    notFound();
  }

  return (
    <html
      lang={lang}
      className={`${beVietnam.variable} ${geistMono.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: INTRO_SKIP_SCRIPT }} />
      </head>
      <body className="bg-bg text-ink font-sans antialiased">
        <Preloader />
        <div className="grain" aria-hidden />
        {children}
        <Cursor />
      </body>
    </html>
  );
}
