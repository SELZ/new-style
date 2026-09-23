import { Alert, Button } from "@mantine/core";
import { Link, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useWholesale, type Role } from "../entities/wholesale/index.ts";
import { lazy, Suspense } from "react";
import { Loader } from "@mantine/core";
import { SignInPage } from "../pages/sign-in/index.ts";
import { WorkspaceShell } from "../widgets/workspace-shell/index.ts";

const AdministrationPage = lazy(() =>
  import("../pages/administration/index.ts").then((m) => ({
    default: m.AdministrationPage,
  })),
);
const ClientCartPage = lazy(() =>
  import("../pages/client-cart/index.ts").then((m) => ({
    default: m.ClientCartPage,
  })),
);
const ClientProfilePage = lazy(() =>
  import("../pages/client-profile/index.ts").then((m) => ({
    default: m.ClientProfilePage,
  })),
);
const StorefrontPage = lazy(() =>
  import("../pages/storefront/index.ts").then((m) => ({
    default: m.StorefrontPage,
  })),
);
const DashboardPage = lazy(() =>
  import("../pages/operations/index.ts").then((m) => ({
    default: m.DashboardPage,
  })),
);
const OrdersPage = lazy(() =>
  import("../pages/operations/index.ts").then((m) => ({
    default: m.OrdersPage,
  })),
);
const OrderDetailPage = lazy(() =>
  import("../pages/operations/index.ts").then((m) => ({
    default: m.OrderDetailPage,
  })),
);
const TasksPage = lazy(() =>
  import("../pages/operations/index.ts").then((m) => ({
    default: m.TasksPage,
  })),
);
const TeamPage = lazy(() =>
  import("../pages/operations/index.ts").then((m) => ({ default: m.TeamPage })),
);
const WarehouseMapPage = lazy(() =>
  import("../pages/operations/index.ts").then((m) => ({
    default: m.WarehouseMapPage,
  })),
);
const ActivityPage = lazy(() =>
  import("../pages/operations/index.ts").then((m) => ({
    default: m.ActivityPage,
  })),
);

function Access({ roles }: { roles?: Role[] }) {
  const { user } = useWholesale();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return (
      <div className="access-denied">
        <Alert color="orange" title="Раздел недоступен">
          Этот раздел доступен другой роли. Вы можете сменить аккаунт через меню
          профиля.
        </Alert>
        <Button component={Link} to="/dashboard" mt="md">
          Вернуться в пространство
        </Button>
      </div>
    );
  return <Outlet />;
}
export function App() {
  return (
    <Suspense
      fallback={
        <div className="route-loading" role="status">
          <Loader size="sm" />
          Загружаем пространство…
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<SignInPage />} />
        <Route element={<Access />}>
          <Route element={<WorkspaceShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route element={<Access roles={["client"]} />}>
              <Route path="catalog" element={<StorefrontPage />} />
              <Route path="cart" element={<ClientCartPage />} />
              <Route path="profile" element={<ClientProfilePage />} />
            </Route>
            <Route element={<Access roles={["warehouse_worker"]} />}>
              <Route path="tasks" element={<TasksPage />} />
            </Route>
            <Route element={<Access roles={["manager", "admin"]} />}>
              <Route path="team" element={<TeamPage />} />
            </Route>
            <Route
              element={
                <Access roles={["warehouse_worker", "manager", "admin"]} />
              }
            >
              <Route path="warehouses" element={<WarehouseMapPage />} />
            </Route>
            <Route element={<Access roles={["manager", "admin"]} />}>
              <Route path="admin" element={<AdministrationPage />} />
            </Route>
            <Route
              path="*"
              element={
                <div className="empty-state">
                  <h1>Страница не найдена</h1>
                  <Button component={Link} to="/dashboard">
                    Перейти к обзору
                  </Button>
                </div>
              }
            />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
