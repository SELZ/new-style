import { Icon } from "../../../shared/ui/icon/index.ts";
import type { CatalogModel } from "../model/useCatalog.ts";
import PriceFilter from "./PriceFilter.tsx";

export function CatalogFilters({ catalog }: { catalog: CatalogModel }) {
  const { trail, query, products, categories, filtersCount, resetFilters, navigate, priceMin, priceMax, priceLimit, setMinPrice, setMaxPrice, promotionOnly, setPromotionOnly } = catalog;
    return (
      <>
        <div className="filter-heading">
          <h3>Фильтры</h3>
          <button
            className="text-button"
            disabled={!filtersCount}
            onClick={resetFilters}
          >
            Сбросить
          </button>
        </div>
        <fieldset className="filter-section">
          <legend>Категории</legend>
          <div className="category-options">
            <button
              className={`category-option ${!trail.length && !query ? "is-active" : ""}`}
              onClick={() => navigate([])}
            >
              <Icon name="grid" size={18} />
              <span>Все категории</span>
            </button>
            {trail.length > 0 && (
              <button
                className="category-option"
                onClick={() => navigate(trail.slice(0, -1))}
              >
                <Icon name="return" size={18} />
                <span>На уровень выше</span>
              </button>
            )}
            {categories.map((category) => (
              <button
                key={category.id}
                className="category-option"
                onClick={() => navigate([...trail, category])}
              >
                <Icon name="grid" size={18} />
                <span>{category.name}</span>
                <Icon name="chevron" size={12} />
              </button>
            ))}
          </div>
        </fieldset>
        {products.length > 0 && (
          <>
            <PriceFilter
              min={priceMin}
              max={priceMax}
              limit={priceLimit}
              onChange={(min, max) => {
                setMinPrice(min);
                setMaxPrice(max === priceLimit ? null : max);
              }}
            />
            <fieldset className="filter-section special-filter">
              <legend>Подборка</legend>
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={promotionOnly}
                  onChange={(event) => setPromotionOnly(event.target.checked)}
                />
                <span>Участвует в акции</span>
                <span className="tiny-label">%</span>
              </label>
            </fieldset>
            <p className="filter-explanation">
              Цена и сортировка применяются к товарам текущей подборки.
            </p>
          </>
        )}
      </>
    );
  }

