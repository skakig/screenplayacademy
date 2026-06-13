import { t } from "@/lib/i18n/t";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssignmentStatus } from "@/lib/assignments";
import type { I18nKey } from "@/lib/i18n/keys";

const STATUS_ORDER: AssignmentStatus[] = [
  "assigned",
  "in_progress",
  "ready_for_review",
  "approved",
  "blocked",
  "unassigned",
];

const STATUS_LABEL: Record<AssignmentStatus, I18nKey> = {
  assigned: "collab.assignmentStatus.assigned",
  in_progress: "collab.assignmentStatus.inProgress",
  ready_for_review: "collab.assignmentStatus.readyForReview",
  approved: "collab.assignmentStatus.approved",
  blocked: "collab.assignmentStatus.blocked",
  unassigned: "collab.assignmentStatus.unassigned",
};

export function statusLabel(status: AssignmentStatus): string {
  return t(STATUS_LABEL[status]);
}

interface Props {
  value: AssignmentStatus;
  onChange: (value: AssignmentStatus) => void;
  disabled?: boolean;
  className?: string;
}

export function AssignmentStatusSelect({
  value,
  onChange,
  disabled,
  className,
}: Props) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as AssignmentStatus)}
      disabled={disabled}
    >
      <SelectTrigger className={className ?? "h-8 w-[180px] text-xs"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_ORDER.map((s) => (
          <SelectItem key={s} value={s} className="text-sm">
            {statusLabel(s)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
