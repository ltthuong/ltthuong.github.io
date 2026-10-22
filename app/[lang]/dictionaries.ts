const en = {
  meta: {
    description:
      "Full-stack engineer building web and mobile products end to end, from database to pixel. 7 years shipping EdTech. Available for remote and freelance work.",
    ogLocale: "en_US",
  },
  langSwitch: { label: "Tiếng Việt", short: "VI" },
  hero: { tagline: '/tʰɨəŋ/ - means "reward"', social: "Social links" },
};

export type Dictionary = typeof en;

const vi: Dictionary = {
  meta: {
    description:
      "Kỹ sư full-stack làm sản phẩm web và mobile trọn vẹn, từ database đến từng pixel. 7 năm làm EdTech. Nhận việc remote và freelance.",
    ogLocale: "vi_VN",
  },
  langSwitch: { label: "English", short: "EN" },
  hero: { tagline: '/tʰɨəŋ/ - Thưởng trong "phần thưởng"', social: "Mạng xã hội" },
};

const dictionaries = { en, vi };

export type Locale = keyof typeof dictionaries;

export const LOCALES = Object.keys(dictionaries) as Locale[];

export function hasLocale(lang: string): lang is Locale {
  return lang in dictionaries;
}

export function getDictionary(lang: Locale): Dictionary {
  return dictionaries[lang];
}
