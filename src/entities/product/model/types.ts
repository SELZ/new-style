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

