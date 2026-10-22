export const INTRO_KEY = "thuong:intro";

/* Runs in <head> before first paint: repeat visits and reduced motion skip the preloader. */
export const INTRO_SKIP_SCRIPT = `try{if(sessionStorage.getItem("${INTRO_KEY}")||matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.dataset.intro="done"}}catch(e){document.documentElement.dataset.intro="done"}`;

export function introStarted() {
  return document.documentElement.dataset.intro !== undefined;
}
