export type Role = "client" | "warehouse_worker" | "manager" | "admin";
export type Tier = "new" | "regular" | "vip";
export type OrderStatus =
  | "new"
  | "accepted"
  | "picking"
  | "ready"
  | "manager"
  | "shipped"
  | "completed";
export type Priority = "normal" | "urgent" | "vip";

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  warehouseIds: string[];
  active: boolean;
  storeName: string;
  phone: string;
  address: string;
  tier: Tier;
  permissions: {
    manageUsers: boolean;
    manageWarehouses: boolean;
    manageProducts: boolean;
  };
}

export interface Warehouse {
  id: string;
  name: string;
  categories: string[];
  color: string;
  rows: string[];
}

export interface StockProduct {
  id: string;
  name: string;
  category: string;
  warehouseId: string;
  price: number;
  stock: number;
  unit: string;
  image: string;
  location: { rack: string; shelf: number };
  available: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  image: string;
  unit: string;
  warehouseId: string;
  quantity: number;
  price: number;
  picked: number;
  missing: number;
}

export interface WarehouseTask {
  id: string;
  warehouseId: string;
  status: "new" | "accepted" | "picking" | "done";
  assignedTo?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Order {
  id: string;
  number: number;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  priority: Priority;
  items: OrderItem[];
  tasks: WarehouseTask[];
  total: number;
  address: string;
  comment: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actorId: string;
  message: string;
  orderId?: string;
  warehouseId?: string;
}

export interface Notice {
  id: string;
  userId: string;
  message: string;
  at: string;
  read: boolean;
  orderId?: string;
}

export interface State {
  version: number;
  users: User[];
  warehouses: Warehouse[];
  products: StockProduct[];
  orders: Order[];
  events: AuditEvent[];
  notifications: Notice[];
  carts: Record<string, Record<string, number>>;
  sessionUserId: string | null;
}

export type ProfilePatch = Partial<
  Pick<User, "name" | "email" | "password" | "storeName" | "phone" | "address">
>;
export type UserInput = Omit<User, "id"> & { id?: string };
export type WarehouseInput = Omit<Warehouse, "id"> & { id?: string };
export type ProductInput = Omit<StockProduct, "id"> & { id?: string };

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}
