export interface Product {
  id: string;
  name: string;
  image: string;
  price: number | null;
  ratio: number | null;
  unit: string;
  priceOne: number | null;
  wholesalePrice: number | null;
  wholesalePriceOne: number | null;
  actionId: string;
  actionPrice: number | null;
  marked: boolean;
  bonus: number | null;
}

export interface Category {
  id: string;
  name: string;
  image: string;
  parent: string;
}

export interface Catalog {
  categories: Category[];
  products: Product[];
  tags: string[];
}

export interface ProductDetail {
  product: Product;
  images: { id: string; url: string }[];
  similars: Product[];
}

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

export interface Session {
  token: string;
  kkt: string;
}
