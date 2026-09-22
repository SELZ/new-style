import { useRef } from "react";
import type { ReactNode } from "react";
import { ProductCard, type Product } from "../../../entities/product/index.ts";
import type { CartController } from "../../../features/manage-cart/index.ts";
import { Icon } from "../../../shared/ui/icon/index.ts";
import type { CatalogModel, CatalogSort } from "../model/useCatalog.ts";
import { CatalogFilters } from "./CatalogFilters.tsx";

type Props = {
  catalog: CatalogModel;
  cart: CartController;
  onOpen: (product: Product) => void;
  renderProductAction: (product: Product) => ReactNode;
};

export function CatalogContent({ catalog, cart, onOpen, renderProductAction }: Props) {
  const filterDialog = useRef<HTMLDialogElement>(null);
  const { trail, query, products, categories, search, sort, setSort, data, loading, error, invalidQuery, visibleProducts, filtersCount, resetFilters, navigate, updateSearch, retry } = catalog;
  return <>
      <main className="page-shell">
        <section className="catalog-intro">
          <span className="eyebrow">ВАШ АССОРТИМЕНТ</span>
          <h1>
            Товары для
            <br />
            <span>вашего дела.</span>
          </h1>
          <p>Выберите категорию или найдите нужный товар по названию.</p>
        </section>
        <nav className="catalog-breadcrumb" aria-label="Путь в каталоге">
          <button onClick={() => navigate([])}>Каталог</button>
          {trail.map((category, index) => (
            <span className="breadcrumb-part" key={category.id}>
              <Icon name="chevron" size={12} />
              <button onClick={() => navigate(trail.slice(0, index + 1))}>
                {category.name}
              </button>
            </span>
          ))}
          {query && (
            <span className="breadcrumb-part">
              <Icon name="chevron" size={12} />
              <span>Поиск по всему каталогу</span>
            </span>
          )}
        </nav>
        <section
          id="catalog"
          className="catalog"
          aria-labelledby="catalog-title"
        >
          <div className="catalog-heading">
            <div className="catalog-title-row">
              <h2 id="catalog-title">
                {query
                  ? "Результаты поиска"
                  : (trail.at(-1)?.name ?? "Каталог товаров")}
                <span className="title-period">.</span>
              </h2>
              {data && <span className="total-count">{products.length}</span>}
            </div>
          </div>
          <div className="catalog-layout">
            <aside className="filter-sidebar" aria-label="Фильтры товаров">
              <CatalogFilters catalog={catalog} />
            </aside>
            <div className="catalog-results">
              <div className="catalog-toolbar">
                <label className="search-field">
                  <Icon name="search" size={19} />
                  <input
                    type="search"
                    placeholder="Название товара"
                    aria-label="Поиск по всему каталогу"
                    value={search}
                    onChange={(event) => updateSearch(event.target.value)}
                  />
                  {search && (
                    <button
                      aria-label="Очистить поиск"
                      onClick={() => updateSearch("")}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </label>
                <label className="sort-field">
                  <span className="sr-only">Сортировка</span>
                  <Icon name="sliders" size={16} />
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as CatalogSort)}
                  >
                    <option value="name">По названию</option>
                    <option value="price-asc">Сначала дешевле</option>
                    <option value="price-desc">Сначала дороже</option>
                  </select>
                </label>
              </div>
              <div className="results-meta">
                <p aria-live="polite">
                  {loading
                    ? "Загружаем каталог…"
                    : data
                      ? `Товаров: ${visibleProducts.length}`
                      : "Не удалось загрузить каталог"}
                </p>
                <button
                  className="mobile-filter-button"
                  onClick={() => filterDialog.current?.showModal()}
                >
                  <Icon name="sliders" size={16} />
                  Фильтры{filtersCount > 0 && <span>{filtersCount}</span>}
                </button>
              </div>
              {cart.error && (
                <div className="inline-status" role="alert">
                  <p>Корзина: {cart.error}</p>
                  <button
                    className="text-button"
                    onClick={() => void cart.reload()}
                    disabled={cart.loading || cart.busy}
                  >
                    Обновить корзину
                  </button>
                </div>
              )}
              <div aria-busy={loading}>
                {loading ? (
                  <div className="catalog-loading" role="status">
                    <span className="loading-spinner" />
                    Загружаем товары и категории…
                  </div>
                ) : error ? (
                  <div className="empty-results" role="alert">
                    <Icon name="return" size={32} />
                    <h3>
                      {invalidQuery ? "Уточните запрос" : "Каталог недоступен"}
                    </h3>
                    <p>{error}</p>
                    <button
                      className="primary-button"
                      onClick={retry}
                    >
                      Повторить запрос
                    </button>
                  </div>
                ) : (
                  <>
                    {categories.length > 0 && (
                      <div
                        className="category-grid"
                        aria-label="Разделы каталога"
                      >
                        {categories.map((category) => (
                          <button
                            key={category.id}
                            className="category-tile"
                            onClick={() => navigate([...trail, category])}
                          >
                            <Icon name="grid" size={23} />
                            <span>{category.name}</span>
                            <Icon name="arrow-up-right" size={17} />
                          </button>
                        ))}
                      </div>
                    )}
                    {visibleProducts.length > 0 ? (
                      <div className="product-grid">
                        {visibleProducts.map((product, index) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            index={index}
                            onOpen={onOpen}
                            action={renderProductAction(product)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="empty-results">
                        <Icon
                          name={categories.length ? "grid" : "search"}
                          size={32}
                        />
                        <h3>
                          {categories.length
                            ? "Выберите раздел"
                            : filtersCount
                              ? "Нет товаров по этим фильтрам"
                              : query
                                ? "Ничего не найдено"
                                : "В этом разделе пока нет товаров"}
                        </h3>
                        <p>
                          {categories.length
                            ? "Откройте категорию, чтобы увидеть её товары."
                            : query
                              ? "Попробуйте изменить поисковый запрос."
                              : "Попробуйте другую категорию или измените фильтры."}
                        </p>
                        {filtersCount > 0 && (
                          <button
                            className="primary-button"
                            onClick={resetFilters}
                          >
                            Сбросить фильтры
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>      <dialog
        className="filter-dialog"
        ref={filterDialog}
        aria-label="Фильтры товаров"
        onClick={(event) => {
          if (event.target === event.currentTarget)
            filterDialog.current?.close();
        }}
      >
        <div className="filter-dialog-content">
          <div className="mobile-dialog-heading">
            <span>Ваша подборка</span>
            <button
              className="icon-button"
              aria-label="Закрыть фильтры"
              onClick={() => filterDialog.current?.close()}
            >
              <Icon name="close" />
            </button>
          </div>
          <CatalogFilters catalog={catalog} />
          <button
            className="primary-button apply-filters"
            onClick={() => filterDialog.current?.close()}
          >
            Показать товары
            <Icon name="arrow" size={18} />
          </button>
        </div>
      </dialog>
  </>;
}
