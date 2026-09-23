import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Alert,
  Button,
  FileButton,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import { ImagePlus, Package } from "lucide-react";
import { store } from "../../../entities/wholesale/index.ts";
import type {
  ProductInput,
  StockProduct,
  Warehouse,
} from "../../../entities/wholesale/index.ts";

export function ProductEditor({
  initial,
  warehouses,
  onCancel,
  onSaved,
}: {
  initial: StockProduct | null;
  warehouses: Warehouse[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProductInput>(() =>
    initial
      ? { ...initial, location: { ...initial.location } }
      : {
          name: "",
          category: warehouses[0]?.categories[0] ?? "",
          warehouseId: warehouses[0]?.id ?? "",
          price: 0,
          stock: 0,
          unit: "шт",
          image: "",
          location: { rack: warehouses[0]?.rows[0] ?? "", shelf: 1 },
          available: true,
        },
  );
  const [price, setPrice] = useState<string | number>(form.price);
  const [stock, setStock] = useState<string | number>(form.stock);
  const [shelf, setShelf] = useState<string | number>(form.location.shelf);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const readerRef = useRef<FileReader | null>(null);
  const warehouse = warehouses.find((item) => item.id === form.warehouseId);
  useEffect(
    () => () => {
      readerRef.current?.abort();
    },
    [],
  );

  function upload(file: File | null) {
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return setError("Поддерживаются фотографии JPG, PNG и WebP.");
    if (file.size > 500 * 1024)
      return setError("Выберите фотографию размером до 500 КБ.");
    readerRef.current?.abort();
    const reader = new FileReader();
    readerRef.current = reader;
    setReading(true);
    reader.onload = () => {
      if (readerRef.current !== reader) return;
      if (typeof reader.result === "string")
        setForm((current) => ({ ...current, image: reader.result as string }));
      setReading(false);
    };
    reader.onerror = () => {
      if (readerRef.current === reader) {
        setError("Не удалось прочитать фотографию.");
        setReading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || reading) return;
    setError("");
    const numericPrice = Number(price);
    const numericStock = Number(stock);
    const numericShelf = Number(shelf);
    if (!form.name.trim()) return setError("Укажите название товара.");
    if (!warehouse) return setError("Выберите склад товара.");
    if (!warehouse.categories.includes(form.category))
      return setError("Выберите категорию выбранного склада.");
    if (price === "" || !Number.isFinite(numericPrice) || numericPrice <= 0)
      return setError("Цена должна быть больше нуля.");
    if (stock === "" || !Number.isSafeInteger(numericStock) || numericStock < 0)
      return setError("Остаток должен быть целым неотрицательным числом.");
    if (!form.unit.trim()) return setError("Укажите единицу измерения.");
    if (
      !form.location.rack.trim() ||
      shelf === "" ||
      !Number.isSafeInteger(numericShelf) ||
      numericShelf < 1
    )
      return setError("Укажите стеллаж и номер полки от 1.");
    const image = form.image.trim();
    if (image.startsWith("data:") && image.length > 700 * 1024)
      return setError("Фотография слишком большая. Загрузите файл до 500 КБ.");
    if (
      image &&
      !/^\/(?!\/)/.test(image) &&
      !/^data:image\/(?:jpeg|png|webp);base64,/i.test(image)
    ) {
      try {
        const url = new URL(image);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        return setError(
          "Для фотографии используйте ссылку http/https или загрузите файл.",
        );
      }
    }
    setSaving(true);
    try {
      await store.saveProduct({
        ...form,
        name: form.name.trim(),
        image,
        price: numericPrice,
        stock: numericStock,
        unit: form.unit.trim(),
        location: { rack: form.location.rack.trim(), shelf: numericShelf },
      });
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось сохранить товар.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        <TextInput
          label="Название товара"
          value={form.name}
          onChange={(event) =>
            setForm({ ...form, name: event.currentTarget.value })
          }
          required
          maxLength={180}
        />
        <div className="admin-image-control">
          <div className="admin-image-preview">
            {form.image ? (
              <img
                src={form.image}
                alt="Фото товара"
                onError={(event) => {
                  event.currentTarget.style.visibility = "hidden";
                }}
                key={form.image}
              />
            ) : (
              <Package size={28} />
            )}
          </div>
          <div>
            <FileButton
              onChange={upload}
              accept="image/png,image/jpeg,image/webp"
            >
              {(props) => (
                <Button
                  {...props}
                  variant="light"
                  leftSection={<ImagePlus size={16} />}
                  loading={reading}
                >
                  Загрузить фото
                </Button>
              )}
            </FileButton>
            <p className="muted">JPG, PNG или WebP, до 500 КБ</p>
          </div>
          {form.image && (
            <Button
              variant="subtle"
              color="gray"
              disabled={reading}
              onClick={() => setForm({ ...form, image: "" })}
            >
              Убрать
            </Button>
          )}
        </div>
        <TextInput
          label="Или ссылка на фотографию"
          placeholder="https://…"
          value={form.image.startsWith("data:") ? "" : form.image}
          disabled={reading}
          maxLength={4096}
          onChange={(event) =>
            setForm({ ...form, image: event.currentTarget.value })
          }
        />
        <div className="admin-form-grid">
          <Select
            label="Склад"
            data={warehouses.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            value={form.warehouseId}
            onChange={(value) => {
              const next = warehouses.find((item) => item.id === value);
              if (next)
                setForm({
                  ...form,
                  warehouseId: next.id,
                  category: next.categories.includes(form.category)
                    ? form.category
                    : (next.categories[0] ?? ""),
                  location: { ...form.location, rack: next.rows[0] ?? "" },
                });
            }}
            allowDeselect={false}
            required
          />
          <Select
            label="Категория"
            data={warehouse?.categories ?? []}
            value={form.category}
            onChange={(value) => value && setForm({ ...form, category: value })}
            searchable
            allowDeselect={false}
            required
          />
          <NumberInput
            label="Цена, ₽"
            value={price}
            onChange={setPrice}
            min={0}
            decimalScale={2}
            required
          />
          <NumberInput
            label="Остаток"
            value={stock}
            onChange={setStock}
            min={0}
            allowDecimal={false}
            required
          />
          <TextInput
            label="Единица измерения"
            placeholder="шт, упак, кг"
            value={form.unit}
            onChange={(event) =>
              setForm({ ...form, unit: event.currentTarget.value })
            }
            required
            maxLength={20}
          />
          <Select
            label="Стеллаж"
            data={warehouse?.rows ?? []}
            value={form.location.rack}
            onChange={(rack) =>
              rack && setForm({ ...form, location: { ...form.location, rack } })
            }
            allowDeselect={false}
            required
          />
          <NumberInput
            label="Полка"
            value={shelf}
            onChange={setShelf}
            min={1}
            allowDecimal={false}
            required
          />
        </div>
        <Switch
          label="Доступен для заказа"
          checked={form.available}
          onChange={(event) =>
            setForm({ ...form, available: event.currentTarget.checked })
          }
        />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onCancel} disabled={saving}>
            Отмена
          </Button>
          <Button
            type="submit"
            loading={saving}
            disabled={reading || !warehouses.length}
          >
            Сохранить товар
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
