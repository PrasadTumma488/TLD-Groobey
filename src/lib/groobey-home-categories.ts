export type HomeCategory = {
  id: string;
  label: string;
  subtitle: string;
  /** Public URL under `/home-categories/` when the asset exists. */
  image?: string;
};

export const HOME_CATEGORIES: HomeCategory[] = [
  {
    id: "groceries",
    label: "Groceries",
    subtitle: "Rice, dal, oil & daily essentials",
    image: "/home-categories/groceries.png",
  },
  {
    id: "vegetables",
    label: "Vegetables",
    subtitle: "Farm-fresh seasonal picks",
    image: "/home-categories/vegetables.png",
  },
  {
    id: "fruits",
    label: "Fruits",
    subtitle: "Sweet & ripe selections",
    image: "/home-categories/fruits.png",
  },
  {
    id: "pickles-non-veg",
    label: "Veg & Non-Veg Pickles",
    subtitle: "Veg pickles & non-veg pickles",
    image: "/home-categories/pickles-non-veg.png",
  },
  {
    id: "papads-crisps",
    label: "Papads & crisps",
    subtitle: "Crunchy snacks & papads",
    image: "/home-categories/papads-crisps.png",
  },
  {
    id: "veg-non-veg",
    label: "Chicken & Mutton",
    subtitle: "Fresh meat - chicken & mutton",
    image: "/home-categories/veg-non-veg.png",
  },
];
