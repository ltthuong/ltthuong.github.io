import { INTRO_KEY } from "@/lib/intro";

const HOLD_MS = 1100;
const EXIT_MS = 750;

/* Plain script, not React: it runs at parse time and only flips html[data-intro];
   CSS draws the line, wipes the cover and hides it. */
const EXIT_SCRIPT = `(function(){var h=document.documentElement;if(h.dataset.intro){return}
setTimeout(function(){try{sessionStorage.setItem("${INTRO_KEY}","1")}catch(e){}
h.dataset.intro="go";setTimeout(function(){h.dataset.intro="done"},${EXIT_MS})},${HOLD_MS})})()`;

export function Preloader() {
  return (
    <div aria-hidden className="preloader fixed inset-0 z-[90] grid place-items-center bg-lacquer">
      <span className="preload-line block h-px w-[min(40vw,320px)] origin-left bg-gold" />
      <script dangerouslySetInnerHTML={{ __html: EXIT_SCRIPT }} />
    </div>
  );
}
