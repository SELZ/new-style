import { useState } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Group,
  Modal,
  Table,
  Tabs,
  TextInput,
} from "@mantine/core";
import {
  CheckCircle2,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import {
  ROLE_LABELS,
  TIER_LABELS,
  money,
  store,
  useWholesale,
} from "../../../entities/wholesale/index.ts";
import type {
  StockProduct,
  User,
  Warehouse,
} from "../../../entities/wholesale/index.ts";
import { ProductEditor } from "./ProductEditor.tsx";
import { UserEditor } from "./UserEditor.tsx";
import { WarehouseEditor } from "./WarehouseEditor.tsx";
import "./administration.css";

type Section = "users" | "warehouses" | "products";
const headings: Record<
  Section,
  { title: string; create: string; placeholder: string }
> = {
  users: {
    title: "Пользователи",
    create: "Добавить пользователя",
    placeholder: "Имя, email или магазин",
  },
  warehouses: {
    title: "Склады",
    create: "Добавить склад",
    placeholder: "Название или категория склада",
  },
  products: {
    title: "Товары",
    create: "Добавить товар",
    placeholder: "Название, категория или склад",
  },
};

export function AdministrationPage() {
  const { state, user } = useWholesale();
  const [tab, setTab] = useState<Section>("users");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [resetOpened, setResetOpened] = useState(false);
  const [userEditor, setUserEditor] = useState<User | "new" | null>(null);
  const [warehouseEditor, setWarehouseEditor] = useState<
    Warehouse | "new" | null
  >(null);
  const [productEditor, setProductEditor] = useState<
    StockProduct | "new" | null
  >(null);
  const admin = user?.role === "admin";
  const canUsers = Boolean(
    admin || (user?.role === "manager" && user.permissions.manageUsers),
  );
  const canWarehouses = Boolean(
    admin || (user?.role === "manager" && user.permissions.manageWarehouses),
  );
  const canProducts = Boolean(
    admin || (user?.role === "manager" && user.permissions.manageProducts),
  );
  const allowed: Section[] = [
    canUsers && "users",
    canWarehouses && "warehouses",
    canProducts && "products",
  ].filter((value): value is Section => Boolean(value));
  const active = allowed.includes(tab) ? tab : allowed[0];
  const query = search.trim().toLocaleLowerCase("ru");
  const matches = (...values: string[]) =>
    values.join(" ").toLocaleLowerCase("ru").includes(query);
  const warehouseName = (id: string) =>
    state.warehouses.find((warehouse) => warehouse.id === id)?.name ??
    "Склад не найден";
  const users = state.users.filter((item) =>
    matches(
      item.name,
      item.email,
      item.storeName,
      item.phone,
      ROLE_LABELS[item.role],
    ),
  );
  const warehouses = state.warehouses.filter((item) =>
    matches(item.name, ...item.categories),
  );
  const products = state.products.filter((item) =>
    matches(item.name, item.id, item.category, warehouseName(item.warehouseId)),
  );
  const mayEditUser = (target: User) =>
    canUsers &&
    (admin || target.role === "client" || target.role === "warehouse_worker");

  function saved(message: string) {
    setNotice(message);
    setUserEditor(null);
    setWarehouseEditor(null);
    setProductEditor(null);
  }

  function create() {
    setNotice("");
    if (active === "users") setUserEditor("new");
    if (active === "warehouses") setWarehouseEditor("new");
    if (active === "products") setProductEditor("new");
  }

  if (!user || !active)
    return (
      <section className="administration-page">
        <div className="empty-state">
          <ShieldCheck size={36} />
          <h1>Управление недоступно</h1>
          <p>
            Для этого раздела нужны права управления пользователями, складами
            или товарами.
          </p>
        </div>
      </section>
    );

  return (
    <section className="administration-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">НАСТРОЙКИ СИСТЕМЫ</span>
          <h1>Администрирование</h1>
          <p>Команда, складская структура и единый справочник товаров.</p>
        </div>
        {admin && (
          <Button
            variant="default"
            leftSection={<RotateCcw size={16} />}
            onClick={() => setResetOpened(true)}
          >
            Сбросить демоданные
          </Button>
        )}
      </div>
      <div className="stat-grid admin-stats">
        {canUsers && (
          <div className="stat-card">
            <span className="admin-stat-icon">
              <Users size={20} />
            </span>
            <span className="muted">Пользователи</span>
            <strong>{state.users.length}</strong>
            <small>
              {state.users.filter((item) => item.active).length} активных
              аккаунтов
            </small>
          </div>
        )}
        {canWarehouses && (
          <div className="stat-card">
            <span className="admin-stat-icon">
              <WarehouseIcon size={20} />
            </span>
            <span className="muted">Склады</span>
            <strong>{state.warehouses.length}</strong>
            <small>Единая структура хранения</small>
          </div>
        )}
        {canProducts && (
          <div className="stat-card">
            <span className="admin-stat-icon">
              <Package size={20} />
            </span>
            <span className="muted">Товары</span>
            <strong>{state.products.length}</strong>
            <small>
              {
                state.products.filter(
                  (item) => item.available && item.stock > 0,
                ).length
              }{" "}
              доступны для заказа
            </small>
          </div>
        )}
      </div>
      {notice && (
        <Alert
          className="admin-notice"
          color="teal"
          icon={<CheckCircle2 size={18} />}
          withCloseButton
          onClose={() => setNotice("")}
          role="status"
        >
          {notice}
        </Alert>
      )}
      <div className="panel admin-panel">
        <Tabs
          value={active}
          onChange={(value) => {
            if (value) {
              setTab(value as Section);
              setSearch("");
            }
          }}
        >
          <Tabs.List className="admin-tabs">
            {canUsers && (
              <Tabs.Tab value="users" leftSection={<Users size={17} />}>
                Пользователи
              </Tabs.Tab>
            )}
            {canWarehouses && (
              <Tabs.Tab
                value="warehouses"
                leftSection={<WarehouseIcon size={17} />}
              >
                Склады
              </Tabs.Tab>
            )}
            {canProducts && (
              <Tabs.Tab value="products" leftSection={<Package size={17} />}>
                Товары
              </Tabs.Tab>
            )}
          </Tabs.List>
          <div className="admin-toolbar">
            <TextInput
              aria-label={`Поиск: ${headings[active].title}`}
              placeholder={headings[active].placeholder}
              leftSection={<Search size={17} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <Button
              leftSection={<Plus size={17} />}
              onClick={create}
              disabled={active === "products" && state.warehouses.length === 0}
            >
              {headings[active].create}
            </Button>
          </div>
          {active === "products" && !state.warehouses.length && (
            <Alert color="yellow" mx="lg" mb="md">
              Сначала добавьте склад и категории товаров.
            </Alert>
          )}

          <Tabs.Panel value="users">
            <div className="table-scroll">
              <Table
                className="admin-table"
                verticalSpacing="md"
                highlightOnHover
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Пользователь</Table.Th>
                    <Table.Th>Роль</Table.Th>
                    <Table.Th>Магазин / склады</Table.Th>
                    <Table.Th>Статус</Table.Th>
                    <Table.Th>
                      <span className="admin-visually-hidden">Действия</span>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {users.map((item) => (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Group wrap="nowrap" gap="sm">
                          <Avatar color="teal" radius="xl">
                            {item.name
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((word) => word[0])
                              .join("")}
                          </Avatar>
                          <div>
                            <strong>{item.name}</strong>
                            <span className="admin-cell-detail">
                              {item.email}
                            </span>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          variant="light"
                          color={
                            item.role === "admin"
                              ? "grape"
                              : item.role === "manager"
                                ? "blue"
                                : item.role === "warehouse_worker"
                                  ? "orange"
                                  : "gray"
                          }
                        >
                          {ROLE_LABELS[item.role]}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {item.role === "client" ? (
                          <>
                            <span>{item.storeName || "—"}</span>
                            <span className="admin-cell-detail">
                              {TIER_LABELS[item.tier]}
                            </span>
                          </>
                        ) : item.role === "warehouse_worker" ? (
                          item.warehouseIds.map(warehouseName).join(", ") ||
                          "Не назначен"
                        ) : (
                          "Управление системой"
                        )}
                      </Table.Td>
                      <Table.Td>
                        <span
                          className={`admin-state ${item.active ? "is-active" : "is-inactive"}`}
                        >
                          <i />
                          {item.active ? "Активен" : "Отключен"}
                        </span>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          variant="subtle"
                          color="gray"
                          size="xs"
                          leftSection={<Pencil size={14} />}
                          disabled={!mayEditUser(item)}
                          aria-label={`Редактировать пользователя ${item.name}`}
                          onClick={() => {
                            setNotice("");
                            setUserEditor(item);
                          }}
                        >
                          Изменить
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
            {!users.length && <EmptySearch label="Пользователи не найдены" />}
            <p className="admin-table-foot">
              Показано {users.length} из {state.users.length} пользователей
            </p>
          </Tabs.Panel>

          <Tabs.Panel value="warehouses">
            <div className="table-scroll">
              <Table
                className="admin-table"
                verticalSpacing="md"
                highlightOnHover
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Склад</Table.Th>
                    <Table.Th>Категории</Table.Th>
                    <Table.Th>Ряды хранения</Table.Th>
                    <Table.Th>Товары</Table.Th>
                    <Table.Th>
                      <span className="admin-visually-hidden">Действия</span>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {warehouses.map((item) => (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Group wrap="nowrap" gap="sm">
                          <span
                            className="admin-warehouse-symbol"
                            style={{ color: item.color }}
                          >
                            <WarehouseIcon size={21} />
                          </span>
                          <strong>{item.name}</strong>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={5}>
                          {item.categories.map((category) => (
                            <Badge
                              key={category}
                              color="gray"
                              variant="light"
                              size="sm"
                            >
                              {category}
                            </Badge>
                          ))}
                        </Group>
                      </Table.Td>
                      <Table.Td>{item.rows.join(", ") || "—"}</Table.Td>
                      <Table.Td>
                        {
                          state.products.filter(
                            (product) => product.warehouseId === item.id,
                          ).length
                        }{" "}
                        позиций
                      </Table.Td>
                      <Table.Td>
                        <Button
                          variant="subtle"
                          color="gray"
                          size="xs"
                          leftSection={<Pencil size={14} />}
                          disabled={!canWarehouses}
                          aria-label={`Редактировать склад ${item.name}`}
                          onClick={() => {
                            setNotice("");
                            setWarehouseEditor(item);
                          }}
                        >
                          Изменить
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
            {!warehouses.length && <EmptySearch label="Склады не найдены" />}
            <p className="admin-table-foot">
              Показано {warehouses.length} из {state.warehouses.length} складов
            </p>
          </Tabs.Panel>

          <Tabs.Panel value="products">
            <div className="table-scroll">
              <Table
                className="admin-table"
                verticalSpacing="md"
                highlightOnHover
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Товар</Table.Th>
                    <Table.Th>Склад / место</Table.Th>
                    <Table.Th>Цена</Table.Th>
                    <Table.Th>Остаток</Table.Th>
                    <Table.Th>Доступность</Table.Th>
                    <Table.Th>
                      <span className="admin-visually-hidden">Действия</span>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {products.map((item) => (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <Avatar
                            src={item.image || null}
                            radius="md"
                            size={44}
                          >
                            <Package size={20} />
                          </Avatar>
                          <div>
                            <strong>{item.name}</strong>
                            <span className="admin-cell-detail">
                              {item.category}
                            </span>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {warehouseName(item.warehouseId)}
                        <span className="admin-cell-detail">
                          {item.location.rack} · полка {item.location.shelf}
                        </span>
                      </Table.Td>
                      <Table.Td className="admin-nowrap">
                        {money(item.price)}
                        <span className="admin-cell-detail">
                          за {item.unit}
                        </span>
                      </Table.Td>
                      <Table.Td>
                        <strong
                          className={item.stock === 0 ? "admin-stock-zero" : ""}
                        >
                          {item.stock}
                        </strong>{" "}
                        <span className="muted">{item.unit}</span>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            item.available && item.stock > 0 ? "teal" : "gray"
                          }
                          variant="light"
                        >
                          {!item.available
                            ? "Скрыт"
                            : item.stock > 0
                              ? "В продаже"
                              : "Нет остатка"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          variant="subtle"
                          color="gray"
                          size="xs"
                          leftSection={<Pencil size={14} />}
                          disabled={!canProducts}
                          aria-label={`Редактировать товар ${item.name}`}
                          onClick={() => {
                            setNotice("");
                            setProductEditor(item);
                          }}
                        >
                          Изменить
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
            {!products.length && <EmptySearch label="Товары не найдены" />}
            <p className="admin-table-foot">
              Показано {products.length} из {state.products.length} товаров
            </p>
          </Tabs.Panel>
        </Tabs>
      </div>

      <Modal
        opened={userEditor !== null && canUsers}
        onClose={() => setUserEditor(null)}
        title={
          userEditor === "new"
            ? "Новый пользователь"
            : "Редактирование пользователя"
        }
        size="lg"
        centered
      >
        {userEditor !== null && (
          <UserEditor
            key={userEditor === "new" ? "new" : userEditor.id}
            initial={userEditor === "new" ? null : userEditor}
            actor={user}
            warehouses={state.warehouses}
            onCancel={() => setUserEditor(null)}
            onSaved={() =>
              saved("Пользователь сохранён. Изменения вступили в силу.")
            }
          />
        )}
      </Modal>
      <Modal
        opened={warehouseEditor !== null && canWarehouses}
        onClose={() => setWarehouseEditor(null)}
        title={
          warehouseEditor === "new" ? "Новый склад" : "Редактирование склада"
        }
        size="lg"
        centered
      >
        {warehouseEditor !== null && (
          <WarehouseEditor
            key={warehouseEditor === "new" ? "new" : warehouseEditor.id}
            initial={warehouseEditor === "new" ? null : warehouseEditor}
            onCancel={() => setWarehouseEditor(null)}
            onSaved={() =>
              saved("Склад сохранён. Структура хранения обновлена.")
            }
          />
        )}
      </Modal>
      <Modal
        opened={productEditor !== null && canProducts}
        onClose={() => setProductEditor(null)}
        title={
          productEditor === "new" ? "Новый товар" : "Редактирование товара"
        }
        size="lg"
        centered
      >
        {productEditor !== null && (
          <ProductEditor
            key={productEditor === "new" ? "new" : productEditor.id}
            initial={productEditor === "new" ? null : productEditor}
            warehouses={state.warehouses}
            onCancel={() => setProductEditor(null)}
            onSaved={() =>
              saved("Товар сохранён. Каталог и складские данные обновлены.")
            }
          />
        )}
      </Modal>
      <Modal
        opened={resetOpened}
        onClose={() => setResetOpened(false)}
        title="Начать демонстрацию заново?"
        centered
      >
        <p>
          Добавленные заказы, товары, склады и пользователи будут удалены из
          этого браузера. Восстановятся исходные примеры и тестовые аккаунты.
        </p>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setResetOpened(false)}>
            Отмена
          </Button>
          <Button
            color="red"
            onClick={() => {
              store.resetDemo();
              setResetOpened(false);
              setSearch("");
              saved("Исходные демоданные восстановлены.");
            }}
          >
            Восстановить демоданные
          </Button>
        </Group>
      </Modal>
    </section>
  );
}

function EmptySearch({ label }: { label: string }) {
  return (
    <div className="empty-state admin-empty">
      <Search size={30} />
      <h3>{label}</h3>
      <p>Измените запрос или добавьте новую запись.</p>
    </div>
  );
}
