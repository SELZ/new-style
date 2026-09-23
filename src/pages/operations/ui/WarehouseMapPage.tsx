import { useState } from "react";
import { Badge, Modal, Paper, Select } from "@mantine/core";
import { Boxes, MapPin, Warehouse } from "lucide-react";
import {
  money,
  useWholesale,
  type StockProduct,
} from "../../../entities/wholesale/index.ts";
export function WarehouseMapPage() {
  const { state, user } = useWholesale();
  const [selected, setSelected] = useState<string | null>(null);
  const [product, setProduct] = useState<StockProduct | null>(null);
  if (!user) return null;
  const warehouses = state.warehouses.filter(
    (w) => user.role !== "warehouse_worker" || user.warehouseIds.includes(w.id),
  );
  const warehouse = warehouses.find((w) => w.id === selected) ?? warehouses[0];
  const products = state.products.filter(
    (p) => p.warehouseId === warehouse?.id,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ВСЁ НА СВОЁМ МЕСТЕ</span>
          <h1>
            Карта складов<span className="heading-dot">.</span>
          </h1>
          <p>
            Выберите стеллаж и товар, чтобы посмотреть остатки и место хранения.
          </p>
        </div>
        <Select
          aria-label="Выбрать склад"
          value={warehouse?.id ?? null}
          onChange={setSelected}
          data={warehouses.map((w) => ({ value: w.id, label: w.name }))}
          allowDeselect={false}
        />
      </div>
      {warehouse ? (
        <>
          <div className="warehouse-overview">
            <Paper className="panel">
              <Warehouse size={23} />
              <div>
                <strong>{warehouse.name}</strong>
                <span>{warehouse.categories.join(" · ")}</span>
              </div>
            </Paper>
            <Paper className="panel">
              <Boxes size={23} />
              <div>
                <strong>{products.length} наименований</strong>
                <span>
                  {products.reduce((s, p) => s + p.stock, 0)} единиц в наличии
                </span>
              </div>
            </Paper>
            <Paper className="panel">
              <MapPin size={23} />
              <div>
                <strong>{warehouse.rows.length} стеллажа</strong>
                <span>Адресное хранение</span>
              </div>
            </Paper>
          </div>
          <Paper className="panel warehouse-map">
            <div className="map-caption">
              <span>
                <i className="status-dot" />
                Товар в наличии
              </span>
              <span>
                <i className="warning-dot" />
                Остаток менее 20
              </span>
              <span>Нажмите на товар для деталей</span>
            </div>
            <div className="warehouse-entrance">
              ЗОНА ПРИЁМКИ И ОТГРУЗКИ <ArrowSymbol />
            </div>
            <div className="rack-grid">
              {warehouse.rows.map((rack) => (
                <div className="rack" key={rack}>
                  <header>
                    <Warehouse size={19} />
                    <strong>{rack}</strong>
                    <span>Стеллаж</span>
                  </header>
                  {[
                    ...new Set([
                      1,
                      2,
                      3,
                      ...products
                        .filter((p) => p.location.rack === rack)
                        .map((p) => p.location.shelf),
                    ]),
                  ]
                    .sort((a, b) => a - b)
                    .map((shelf) => (
                      <div className="rack-shelf" key={shelf}>
                        <span className="shelf-label">Полка {shelf}</span>
                        {products
                          .filter(
                            (p) =>
                              p.location.rack === rack &&
                              p.location.shelf === shelf,
                          )
                          .map((p) => (
                            <button
                              key={p.id}
                              className={`map-product ${p.stock < 20 ? "low-stock" : ""}`}
                              onClick={() => setProduct(p)}
                            >
                              <img src={p.image} alt="" />
                              <span>
                                <strong>{p.name}</strong>
                                <small>
                                  {p.stock} {p.unit}
                                </small>
                              </span>
                            </button>
                          ))}
                        {!products.some(
                          (p) =>
                            p.location.rack === rack &&
                            p.location.shelf === shelf,
                        ) && <span className="empty-shelf">Свободно</span>}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </Paper>
        </>
      ) : (
        <Paper className="panel empty-state">
          <Warehouse />
          <h3>Нет назначенных складов</h3>
          <p>Администратор может назначить вам склад.</p>
        </Paper>
      )}
      <Modal
        opened={!!product}
        onClose={() => setProduct(null)}
        title="Место хранения"
        centered
      >
        {product && (
          <div className="map-product-detail">
            <img src={product.image} alt={product.name} />
            <h2>{product.name}</h2>
            <p>
              {warehouse?.name} · Стеллаж {product.location.rack} · Полка{" "}
              {product.location.shelf}
            </p>
            <Badge size="lg" variant="light" mt="md">
              В наличии: {product.stock} {product.unit}
            </Badge>
            <p className="muted">Цена: {money(product.price)}</p>
          </div>
        )}
      </Modal>
    </>
  );
}
function ArrowSymbol() {
  return <span aria-hidden="true">↕</span>;
}
