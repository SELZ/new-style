import { Badge } from "@mantine/core";

const colors: Record<string, string> = {
  new: "gray",
  accepted: "blue",
  picking: "cyan",
  ready: "teal",
  manager: "indigo",
  shipped: "blue",
  completed: "green",
  done: "teal",
  urgent: "orange",
  vip: "violet",
  normal: "gray",
};
export function StatusBadge({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <Badge
      variant="light"
      color={colors[value] ?? "gray"}
      radius="sm"
      size="sm"
      style={{ textTransform: "none", fontWeight: 600 }}
    >
      {label}
    </Badge>
  );
}
