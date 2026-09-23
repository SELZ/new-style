import { useState } from "react";
import type { FormEvent } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Group,
  MultiSelect,
  PasswordInput,
  Select,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import {
  ROLE_LABELS,
  TIER_LABELS,
  store,
} from "../../../entities/wholesale/index.ts";
import type {
  Role,
  Tier,
  User,
  UserInput,
  Warehouse,
} from "../../../entities/wholesale/index.ts";

interface Props {
  initial: User | null;
  actor: User;
  warehouses: Warehouse[];
  onCancel: () => void;
  onSaved: () => void;
}

export function UserEditor({
  initial,
  actor,
  warehouses,
  onCancel,
  onSaved,
}: Props) {
  const [form, setForm] = useState<UserInput>(() =>
    initial
      ? {
          ...initial,
          warehouseIds: [...initial.warehouseIds],
          permissions: { ...initial.permissions },
        }
      : {
          name: "",
          email: "",
          password: "",
          role: "client",
          warehouseIds: [],
          active: true,
          storeName: "",
          phone: "",
          address: "",
          tier: "new",
          permissions: {
            manageUsers: false,
            manageWarehouses: false,
            manageProducts: false,
          },
        },
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const admin = actor.role === "admin";
  const roles = (Object.keys(ROLE_LABELS) as Role[]).filter(
    (role) => admin || role === "client" || role === "warehouse_worker",
  );
  const change = <K extends keyof UserInput>(key: K, value: UserInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError("");
    const secret = password || initial?.password || "";
    if (!form.name.trim()) return setError("Укажите имя пользователя.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return setError("Введите корректный email.");
    if (secret.length < 6)
      return setError("Пароль должен содержать минимум 6 символов.");
    if (form.role === "warehouse_worker" && !form.warehouseIds.length)
      return setError("Назначьте сборщику хотя бы один склад.");
    if (form.role === "client" && !form.storeName.trim())
      return setError("Укажите название магазина клиента.");
    setSaving(true);
    try {
      await store.saveUser({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        password: secret,
        storeName: form.storeName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        warehouseIds: form.role === "warehouse_worker" ? form.warehouseIds : [],
        permissions:
          form.role === "admin" || form.role === "manager"
            ? form.permissions
            : {
                manageUsers: false,
                manageWarehouses: false,
                manageProducts: false,
              },
      });
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось сохранить пользователя.",
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
        <div className="admin-form-grid">
          <TextInput
            label="Имя и фамилия"
            value={form.name}
            onChange={(event) => change("name", event.currentTarget.value)}
            required
            maxLength={120}
          />
          <TextInput
            label="Email"
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={(event) => change("email", event.currentTarget.value)}
            required
            maxLength={160}
          />
        </div>
        <Select
          label="Роль"
          value={form.role}
          onChange={(value) => value && change("role", value as Role)}
          data={roles.map((role) => ({
            value: role,
            label: ROLE_LABELS[role],
          }))}
          allowDeselect={false}
          required
        />
        <PasswordInput
          label={initial ? "Новый пароль" : "Пароль"}
          description={
            initial
              ? "Оставьте пустым, чтобы сохранить текущий пароль."
              : "Минимум 6 символов. Для демонстрационного аккаунта."
          }
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          required={!initial}
          minLength={6}
        />
        {form.role === "warehouse_worker" && (
          <MultiSelect
            label="Назначенные склады"
            placeholder="Выберите склады"
            data={warehouses.map((warehouse) => ({
              value: warehouse.id,
              label: warehouse.name,
            }))}
            value={form.warehouseIds}
            onChange={(value) => change("warehouseIds", value)}
            searchable
            required
          />
        )}
        {form.role === "client" && (
          <>
            <TextInput
              label="Название магазина"
              value={form.storeName}
              onChange={(event) =>
                change("storeName", event.currentTarget.value)
              }
              required
              maxLength={160}
            />
            <div className="admin-form-grid">
              <TextInput
                label="Телефон"
                type="tel"
                value={form.phone}
                onChange={(event) => change("phone", event.currentTarget.value)}
                maxLength={40}
              />
              <Select
                label="Статус клиента"
                value={form.tier}
                onChange={(value) => value && change("tier", value as Tier)}
                data={(Object.keys(TIER_LABELS) as Tier[]).map((tier) => ({
                  value: tier,
                  label: TIER_LABELS[tier],
                }))}
                allowDeselect={false}
              />
            </div>
            <TextInput
              label="Адрес доставки"
              value={form.address}
              onChange={(event) => change("address", event.currentTarget.value)}
              maxLength={250}
            />
          </>
        )}
        {admin && (form.role === "manager" || form.role === "admin") && (
          <fieldset className="admin-permissions">
            <legend>Права управления</legend>
            {form.role === "admin" && (
              <p className="muted">
                Администратору доступны все разделы управления.
              </p>
            )}
            <Stack gap="sm">
              <Checkbox
                label="Пользователи"
                checked={form.role === "admin" || form.permissions.manageUsers}
                disabled={form.role === "admin"}
                onChange={(event) =>
                  change("permissions", {
                    ...form.permissions,
                    manageUsers: event.currentTarget.checked,
                  })
                }
              />
              <Checkbox
                label="Склады"
                checked={
                  form.role === "admin" || form.permissions.manageWarehouses
                }
                disabled={form.role === "admin"}
                onChange={(event) =>
                  change("permissions", {
                    ...form.permissions,
                    manageWarehouses: event.currentTarget.checked,
                  })
                }
              />
              <Checkbox
                label="Товары"
                checked={
                  form.role === "admin" || form.permissions.manageProducts
                }
                disabled={form.role === "admin"}
                onChange={(event) =>
                  change("permissions", {
                    ...form.permissions,
                    manageProducts: event.currentTarget.checked,
                  })
                }
              />
            </Stack>
          </fieldset>
        )}
        <Switch
          label="Аккаунт активен"
          checked={form.active}
          onChange={(event) => change("active", event.currentTarget.checked)}
        />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onCancel} disabled={saving}>
            Отмена
          </Button>
          <Button type="submit" loading={saving}>
            Сохранить пользователя
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
