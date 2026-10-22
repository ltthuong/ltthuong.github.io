import { notFound } from "next/navigation";
import { Hero } from "@/components/hero";
import { getDictionary, hasLocale } from "./dictionaries";

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) {
    notFound();
  }
  const dict = getDictionary(lang);
  const other = lang === "en" ? "vi" : "en";

  return (
    <main>
      <Hero tagline={dict.hero.tagline} socialLabel={dict.hero.social} />
      <a
        href={`/${other}`}
        hrefLang={other}
        lang={other}
        aria-label={dict.langSwitch.label}
        className="fixed right-6 top-6 z-50 font-mono text-xs tracking-[0.16em] text-eggshell/55 transition-colors hover:text-gold"
      >
        {dict.langSwitch.short}
      </a>
    </main>
  );
}
