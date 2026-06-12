import { Link } from "@tanstack/react-router";
import { ShoppingBasket } from "lucide-react";

import { HOME_CATEGORIES, type HomeCategory } from "@/lib/groobey-home-categories";
import { homeCategoryIcon } from "@/lib/groobey-home-category-icons";
import { SHOW_CUSTOMER_PORTAL } from "@/lib/groobey-site-visibility";

export function GroobeyCategoryGrid() {
  return (
    <div className="groobey-category-grid">
      {HOME_CATEGORIES.map((category) => (
        <GroobeyCategoryCard key={category.id} category={category} />
      ))}
    </div>
  );
}

function GroobeyCategoryCard({ category }: { category: HomeCategory }) {
  const PlaceholderIcon = homeCategoryIcon(category.id);

  const body = (
    <>
      <div
        className={
          category.image ?
            "groobey-category-card-media groobey-category-card-media--photo"
          : "groobey-category-card-media"
        }
      >
        {category.image ?
          <img
            src={category.image}
            alt={category.label}
            className="groobey-category-card-img"
            loading="lazy"
            decoding="async"
          />
        : <div className="groobey-category-card-placeholder" aria-hidden>
            <PlaceholderIcon className="size-10 text-primary/70 sm:size-12" strokeWidth={1.75} />
          </div>
        }
      </div>
      <div className="groobey-category-card-body">
        <h3 className="groobey-category-card-title">{category.label}</h3>
        <p className="groobey-category-card-subtitle">{category.subtitle}</p>
      </div>
    </>
  );

  if (!SHOW_CUSTOMER_PORTAL) {
    return <article className="groobey-category-card group">{body}</article>;
  }

  return (
    <Link
      to="/shop"
      search={{ category: category.id }}
      className="groobey-category-card group block"
    >
      {body}
    </Link>
  );
}
