import { Link } from "@tanstack/react-router";
import { HOME_CATEGORIES, type HomeCategory } from "@/lib/groobey-home-categories";
import { homeCategoryIcon } from "@/lib/groobey-home-category-icons";
import { SHOP_COMBOS_TILE } from "@/lib/groobey-shop-browse";
import { SHOW_CUSTOMER_PORTAL } from "@/lib/groobey-site-visibility";

export function GroobeyCategoryGrid() {
  return (
    <div className="groobey-category-grid">
      {HOME_CATEGORIES.map((category) => (
        <GroobeyCategoryCard key={category.id} category={category} />
      ))}
      <GroobeyCombosCategoryCard />
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

function GroobeyCombosCategoryCard() {
  const body = (
    <>
      <div className="groobey-category-card-media groobey-category-card-media--photo">
        <img
          src={SHOP_COMBOS_TILE.image}
          alt={SHOP_COMBOS_TILE.label}
          className="groobey-category-card-img"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="groobey-category-card-body">
        <h3 className="groobey-category-card-title">{SHOP_COMBOS_TILE.label}</h3>
        <p className="groobey-category-card-subtitle">{SHOP_COMBOS_TILE.subtitle}</p>
      </div>
    </>
  );

  if (!SHOW_CUSTOMER_PORTAL) {
    return <article className="groobey-category-card groobey-category-card--combos group">{body}</article>;
  }

  return (
    <Link
      to="/shop"
      search={{ category: "combos" }}
      className="groobey-category-card groobey-category-card--combos group block"
    >
      {body}
    </Link>
  );
}
