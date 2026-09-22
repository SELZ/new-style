import {
  invalidResponse, record, list, text, requiredText, nonnegativeNumber, requiredNumber,
} from "../../../shared/api/index.ts";
import type { Cart, CartLine } from "../model/types.ts";

function actionId(value: unknown): string {
  const result = text(value);
  return result === "0" ? "" : result;
}

export function normalizeCart(value: unknown): Cart {
  const row = record(value);
  if (!("products" in row)) invalidResponse();
  const items = list(row.products).map((value, index): CartLine => {
    const item = record(value);
    const id = requiredText(item.id);
    const action = actionId(item.action);
    const quantity = requiredNumber(item.count);
    if (quantity <= 0) invalidResponse();
    return {
      // The same product can be split into regular and promotion lines by PHP.
      key: `${index}:${id}:${action}`,
      productId: id,
      name: requiredText(item.name),
      image: text(item.image),
      quantity,
      lineTotal: requiredNumber(item.price),
      unit: text(item.ediz),
      actionId: action,
      discount:
        item.discount === undefined ||
        item.discount === null ||
        item.discount === ""
          ? 0
          : requiredNumber(item.discount),
    };
  });
  return {
    items,
    amount: requiredNumber(row.amount),
    bonus: nonnegativeNumber(row.bonus),
  };
}

