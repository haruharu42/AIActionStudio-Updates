"use client";

export function SalesSelectSetting({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange(value: boolean): void;
  title: string;
  description: string;
}) {
  return (
    <label className="sales-setting-row sales-setting-select">
      <span><strong>{title}</strong><small>{description}</small></span>
      <select value={checked ? "on" : "off"} onChange={(event) => onChange(event.target.value === "on")}>
        <option value="on">受付する / ON</option>
        <option value="off">停止する / OFF</option>
      </select>
    </label>
  );
}
