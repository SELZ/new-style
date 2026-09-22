import {
  invalidResponse, record, list, text, requiredText, number, nonnegativeNumber,
} from "../../../shared/api/index.ts";
import type { Product, Category, Catalog, ProductDetail } from "../model/types.ts";

function actionId(value: unknown): string {
  const result = text(value);
  return result === "0" ? "" : result;
}

function normalizeProduct(value: unknown): Product {
  const row = record(value);
  const ratio = nonnegativeNumber(row.ratio);
  const action = actionId(row.aid);
  return {
    id: requiredText(row.id),
    name: requiredText(row.name),
    image: text(row.image),
    price: nonnegativeNumber(row.price),
    ratio: ratio !== null && ratio > 0 ? ratio : null,
    unit: text(row.ediz),
    priceOne: nonnegativeNumber(row.price_one),
    wholesalePrice: nonnegativeNumber(row.opt),
    wholesalePriceOne: nonnegativeNumber(row.opt_one),
    actionId: action,
    actionPrice: action ? nonnegativeNumber(row.aprice) : null,
    marked: (number(row.mark) ?? 0) > 0,
    bonus: nonnegativeNumber(row.bonus),
  };
}

function normalizeCategory(value: unknown): Category {
  const row = record(value);
  return {
    id: requiredText(row.id),
    name: requiredText(row.name),
    image: text(row.image),
    parent: text(row.parent),
  };
}

export function normalizeCatalog(value: unknown, search: boolean): Catalog {
  const row = record(value);
  // A valid empty response still contains these keys; {} is not an empty catalog.
  if (!("products" in row) || (!search && !("group" in row))) invalidResponse();
  return {
    categories: search ? [] : list(row.group).map(normalizeCategory),
    products: list(row.products).map(normalizeProduct),
    tags: list(row.tags).map((tag) => requiredText(record(tag).vid)),
  };
}

export function normalizeDetail(value: unknown): ProductDetail {
  const row = record(value);
  const images = list(row.img).map((value) => {
    const image = record(value);
    return { id: requiredText(image.id), url: requiredText(image.href) };
  });
  const product = normalizeProduct(row.product);
  if (!product.image) product.image = images[0]?.url ?? "";
  return {
    product,
    images,
    similars: list(row.similars).map(normalizeProduct),
  };
}

