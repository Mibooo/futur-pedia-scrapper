import fs from "fs";

function escapeCsvField(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function writeCsv(filePath: string, fields: string[], rows: Record<string, string>[]): void {
  const lines = [fields.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(fields.map((f) => escapeCsvField(row[f])).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
}
