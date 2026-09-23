import { useState } from "react";
import { Alert, Button, Group, Modal } from "@mantine/core";
import { Check, CloudUpload, Download, HardDrive } from "lucide-react";
import { downloadWorkspace, fileSync, useFileSync, useWholesale } from "../../../entities/wholesale/index.ts";

export function StorageStatus() {
  const sync = useFileSync();
  const {user} = useWholesale();
  const [reloadOpened, setReloadOpened] = useState(false);
  const problem = sync.status === "error" || sync.status === "conflict";
  return <div className="storage-status-area">
    {problem && <Alert color="orange" title="Не все изменения записаны в файл" mb="sm" role="alert">
      <p>{sync.message}</p>
      <Group mt="sm" gap="xs">
        {sync.status !== "conflict" && <Button variant="light" size="xs" onClick={() => void fileSync.retry()}>Повторить сохранение</Button>}
        {sync.status === "conflict" && <Button variant="light" size="xs" onClick={() => setReloadOpened(true)}>Загрузить из файла</Button>}
        {user?.role === "admin" && <Button variant="default" size="xs" onClick={downloadWorkspace}>Скачать копию</Button>}
      </Group>
    </Alert>}
    <div className="storage-status" role="status" aria-live="polite">
      <span>{sync.status === "saving" ? <CloudUpload size={15}/> : sync.status === "saved" ? <Check size={15}/> : <HardDrive size={15}/>} {sync.message}</span>
      {user?.role === "admin" && <Button variant="subtle" size="compact-xs" leftSection={<Download size={13}/>} onClick={downloadWorkspace}>Скачать данные</Button>}
    </div>
    <Modal opened={reloadOpened} onClose={() => setReloadOpened(false)} title="Загрузить данные из файла?" centered>
      <p>Изменения, которые ещё не записаны в файл, будут заменены его текущим содержимым. {user?.role === "admin" ? "Перед загрузкой можно скачать копию текущих данных." : "Администратор может скачать копию текущих данных."}</p>
      <Group mt="lg" justify="flex-end"><Button variant="default" onClick={() => setReloadOpened(false)}>Отмена</Button><Button onClick={() => { void fileSync.reloadFromFile(); setReloadOpened(false); }}>Загрузить данные</Button></Group>
    </Modal>
  </div>;
}
