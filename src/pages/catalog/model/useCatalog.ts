import { useEffect, useMemo, useState } from "react";
import { productApi, type Catalog, type Category } from "../../../entities/product/index.ts";
import { getErrorMessage } from "../../../shared/api/index.ts";

type CatalogRequest = { group: string; query: string; attempt: number };
export type CatalogSort = "name" | "price-asc" | "price-desc";

export function useCatalog(token: string) {
  const [trail, setTrail] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CatalogSort>("name");
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [promotionOnly, setPromotionOnly] = useState(false);
  const [result, setResult] = useState<{
    key: CatalogRequest;
    data: Catalog;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: CatalogRequest;
    message: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const group = trail.at(-1)?.id ?? "0";
  const requestKey = useMemo(
    () => ({ group, query, attempt }),
    [group, query, attempt],
  );
  const normalizedSearch = search.trim().replace(/\s+/g, " ");
  const searching = normalizedSearch !== query;
  const invalidQuery = query.split(" ").length > 5;
  const data = !searching && result?.key === requestKey ? result.data : null;
  const error = searching
    ? ""
    : invalidQuery
      ? "Введите не больше пяти слов для поиска."
      : !data && failure?.key === requestKey
        ? failure.message
        : "";
  const loading = !data && !error;
  const products = data?.products ?? [];
  const categories = data?.categories ?? [];

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(normalizedSearch), 350);
    return () => window.clearTimeout(timeout);
  }, [normalizedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    if (invalidQuery) return () => controller.abort();
    const request = query
      ? productApi.search(token, query, controller.signal)
      : productApi.catalog(token, group, controller.signal);
    request
      .then((response) => {
        if (!controller.signal.aborted)
          setResult({ key: requestKey, data: response });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setFailure({ key: requestKey, message: getErrorMessage(cause) });
      });
    return () => controller.abort();
  }, [token, group, query, requestKey, invalidQuery]);

  const priceLimit = Math.max(
    1,
    Math.ceil(
      products.reduce(
        (highest, product) => Math.max(highest, product.price ?? 0),
        0,
      ),
    ),
  );
  const priceMax =
    maxPrice === null ? priceLimit : Math.min(maxPrice, priceLimit);
  const priceMin = Math.min(minPrice, priceMax);
  const hasPriceFilter = minPrice > 0 || maxPrice !== null;
  const visibleProducts = products
    .filter(
      (product) =>
        (!hasPriceFilter ||
          (product.price !== null &&
            product.price >= priceMin &&
            product.price <= priceMax)) &&
        (!promotionOnly || Boolean(product.actionId)),
    )
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "ru");
      if (a.price === null) return b.price === null ? 0 : 1;
      if (b.price === null) return -1;
      return sort === "price-asc" ? a.price - b.price : b.price - a.price;
    });
  const filtersCount = Number(hasPriceFilter) + Number(promotionOnly);

  function resetFilters() {
    setMinPrice(0);
    setMaxPrice(null);
    setPromotionOnly(false);
  }

  function navigate(nextTrail: Category[]) {
    setTrail(nextTrail);
    setSearch("");
    setQuery("");
    resetFilters();
  }

  function updateSearch(value: string) {
    setSearch(value);
    resetFilters();
  }

  return {
    trail, search, query, sort, setSort, data, products, categories,
    loading, error, invalidQuery, visibleProducts, priceMin, priceMax, priceLimit,
    setMinPrice, setMaxPrice, promotionOnly, setPromotionOnly, filtersCount,
    resetFilters, navigate, updateSearch,
    retry: () => setAttempt((current) => current + 1),
  };
}

export type CatalogModel = ReturnType<typeof useCatalog>;
