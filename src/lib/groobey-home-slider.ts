/** Homepage banner spec - same asset works on mobile and desktop. */
export const HOME_SLIDER_IMAGE = {
  width: 1200,
  height: 400,
} as const;

export const HOME_SLIDER_BG = "#000000";

export type HomeSliderSlide = {
  src: string;
  alt: string;
};

export const HOME_SLIDER_SLIDES: HomeSliderSlide[] = [
  {
    src: "/home-slider/slider-1_grocery.png",
    alt: "Fresh groceries every day at TLD Groobey",
  },
  {
    src: "/home-slider/slider-2_nonveg.png",
    alt: "Non-veg and specialty picks at TLD Groobey",
  },
  {
    src: "/home-slider/slider-3_Pickles.png",
    alt: "Pickles and preserves at TLD Groobey",
  },
  {
    src: "/home-slider/slider-4_combo.png",
    alt: "Combo packs and value deals at TLD Groobey",
  },
];
