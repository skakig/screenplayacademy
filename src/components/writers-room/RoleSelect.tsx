import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INVITABLE_ROLES,
  ROLE_ORDER,
  type ProjectRole,
  roleDescription,
  roleLabel,
} from "./roles";

interface Props {
  value: ProjectRole | string;
  onChange: (role: ProjectRole) => void;
  excludeOwner?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function RoleSelect({
  value,
  onChange,
  excludeOwner = true,
  disabled,
  className,
  id,
}: Props) {
  const options = excludeOwner ? INVITABLE_ROLES : ROLE_ORDER;
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as ProjectRole)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((r) => (
          <SelectItem key={r} value={r}>
            <span className="font-medium">{roleLabel(r)}</span>
            <span className="text-muted-foreground"> — {roleDescription(r)}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
