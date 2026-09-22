export interface CartLine {
  key: string;
  productId: string;
  name: string;
  image: string;
  quantity: number;
  /** The PHP response already multiplies price by count. */
  lineTotal: number;
  unit: string;
  actionId: string;
  discount: number;
}

export interface Cart {
  items: CartLine[];
  amount: number;
  bonus: number | null;
}

