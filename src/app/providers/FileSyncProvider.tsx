import { useEffect, type ReactNode } from "react";
import { Alert, Button, Loader, Stack } from "@mantine/core";
import { fileSync, useFileSync } from "../../entities/wholesale/index.ts";

export function FileSyncProvider({ children }: { children: ReactNode }) {
  const sync = useFileSync();
  useEffect(() => {
    void fileSync.start();
  }, []);
  if (!sync.initialized)
    return (
      <div className="route-loading">
        <Stack align="center" maw={500} p="lg">
          {sync.status === "error" ? (
            <>
              <Alert color="red" title="Не удалось загрузить данные">
                {sync.message}
              </Alert>
              <Button onClick={() => void fileSync.retry()}>
                Повторить загрузку
              </Button>
            </>
          ) : (
            <>
              <Loader size="sm" />
              <span>{sync.message}</span>
            </>
          )}
        </Stack>
      </div>
    );
  return children;
}
