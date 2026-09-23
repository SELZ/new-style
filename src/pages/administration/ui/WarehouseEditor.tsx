import { useState } from "react";
import type { FormEvent } from "react";
import {
  Alert,
  Button,
  ColorInput,
  Group,
  Stack,
  TagsInput,
  TextInput,
} from "@mantine/core";
import { store } from "../../../entities/wholesale/index.ts";
import type {
  Warehouse,
  WarehouseInput,
} from "../../../entities/wholesale/index.ts";

export function WarehouseEditor({
  initial,
  onCancel,
  onSaved,
}: {
  initial: Warehouse | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<WarehouseInput>(() =>
    initial
      ? {
          ...initial,
          categories: [...initial.categories],
          rows: [...initial.rows],
        }
      : { name: "", categories: [], rows: ["A", "B", "C"], color: "#137c66" },
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const unique = (values: string[]) => [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError("");
    const categories = unique(form.categories);
    const rows = unique(form.rows);
    if (!form.name.trim()) return setError("Укажите название склада.");
    if (!categories.length)
      return setError("Добавьте хотя бы одну категорию товаров.");
    if (!rows.length) return setError("Добавьте хотя бы один ряд хранения.");
    if (!/^#[\da-f]{6}$/i.test(form.color))
      return setError("Выберите цвет в формате #137c66.");
    setSaving(true);
    try {
      await store.saveWarehouse({
        ...form,
        name: form.name.trim(),
        categories,
        rows,
      });
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось сохранить склад.",
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
          label="Название склада"
          placeholder="Например, Основной склад"
          value={form.name}
          onChange={(event) =>
            setForm({ ...form, name: event.currentTarget.value })
          }
          required
          maxLength={120}
        />
        <TagsInput
          label="Категории товаров"
          description="Введите название и нажмите Enter."
          placeholder="Новая категория"
          value={form.categories}
          onChange={(categories) => setForm({ ...form, categories })}
          maxTags={30}
          required
        />
        <TagsInput
          label="Ряды хранения"
          description="Обозначения рядов на схеме склада."
          placeholder="Например, A"
          value={form.rows}
          onChange={(rows) => setForm({ ...form, rows })}
          maxTags={30}
          required
        />
        <ColorInput
          label="Цвет склада"
          format="hex"
          value={form.color}
          onChange={(color) => setForm({ ...form, color })}
          swatches={["#137c66", "#4079c7", "#ae7130", "#855bc1", "#bf5767"]}
        />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onCancel} disabled={saving}>
            Отмена
          </Button>
          <Button type="submit" loading={saving}>
            Сохранить склад
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
