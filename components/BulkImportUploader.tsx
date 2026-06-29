"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { parseEmployeeRow, parseKPIRow, EmployeeImportRow, KPIImportRow } from "@/lib/bulkImport";

type ImportRow = EmployeeImportRow | KPIImportRow;

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  newAccounts?: { name: string; email: string; temporaryPassword: string }[];
}

// Add this type for raw Excel data
type RawExcelRow = Record<string, string | number | boolean | null | undefined>;

const TEMPLATES: Record<string, { headers: string[]; sample: Record<string, string> }> = {
  employees: {
    headers: ["Full Name", "Email", "Phone", "Role", "Department"],
     sample: { "Full Name": "Jane Doe", Email: "jane@landbookbyharmony.com", Phone: "0801234567", Role: "Staff", Department: "Sales" },
  },
  kpis: {
    headers: ["Employee Email", "KPI Name", "Description", "Category", "Formula", "KPI Type", "Target Value", "Weight", "Due Date", "Evidence Required"],
    sample: {
      "Employee Email": "jane@landbookbyharmony.com",
      "KPI Name": "Sprint Completion",
      Description: "",
      Category: "productivity",
      Formula: "standard",
      "KPI Type": "monthly",
      "Target Value": "95",
      Weight: "20",
      "Due Date": "",
      "Evidence Required": "No",
    },
  },
};

export default function BulkImportUploader({ type }: { type: "employees" | "kpis" }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  function downloadTemplate() {
    const t = TEMPLATES[type];
    const worksheet = XLSX.utils.json_to_sheet([t.sample], { header: t.headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, `${type}-import-template.xlsx`);
  }

  function downloadCredentials(accounts: { name: string; email: string; temporaryPassword: string }[]) {
    const worksheet = XLSX.utils.json_to_sheet(accounts.map((a) => ({ Name: a.name, Email: a.email, "Temporary Password": a.temporaryPassword })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Credentials");
    XLSX.writeFile(workbook, "new-employee-credentials.xlsx");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setResult(null);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<RawExcelRow>(sheet, { defval: "" });

      const parsed = json.map((raw, i) => (type === "employees" ? parseEmployeeRow(raw, i + 2) : parseKPIRow(raw, i + 2)));
      setRows(parsed);
      if (parsed.length === 0) toast.error("No rows found in that file");
    } catch {
      toast.error("Could not read that file — make sure it's a valid .xlsx or .csv");
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  }

  async function handleImport() {
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    setImporting(true);
    try {
      const url = type === "employees" ? "/api/users/bulk-import" : "/api/kpis/bulk-import";
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: validRows }) });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Import failed");
        return;
      }
      setResult(json.result);
      setRows([]);
      toast.success(`Imported ${json.result.created + json.result.updated} row(s)`);
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={downloadTemplate}>Download Template</button>
        <label className="btn btn-primary btn-sm" style={{ cursor: "pointer" }}>
          Choose File
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} disabled={parsing} style={{ display: "none" }} />
        </label>
      </div>

      {parsing && (
        <p style={{ fontSize: "0.875rem", color: "var(--color-neutral-500)", display: "flex", alignItems: "center", gap: 6 }}>
          <span className="spinner" style={{ width: 14, height: 14 }} /> Reading file…
        </p>
      )}

      {rows.length > 0 && (
        <div>
          <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: "0.875rem" }}>
            <span className="badge badge-approved">{validRows.length} valid</span>
            {invalidRows.length > 0 && <span className="badge badge-rejected">{invalidRows.length} with errors</span>}
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-body" style={{ padding: 0, maxHeight: 320, overflowY: "auto" }}>
              <table className="data-table">
                <thead><tr><th>Row</th><th>Preview</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.rowIndex}>
                      <td>{row.rowIndex}</td>
                      <td style={{ fontSize: "0.8125rem" }}>{"name" in row && "email" in row ? `${row.name} (${row.email})` : `${(row as KPIImportRow).name} → ${(row as KPIImportRow).employeeEmail}`}</td>
                      <td>
                        {row.errors.length === 0 ? (
                          <span className="badge badge-approved">OK</span>
                        ) : (
                          <span title={row.errors.join("; ")} className="badge badge-rejected">{row.errors.length} error(s)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleImport} disabled={importing || validRows.length === 0}>
            {importing ? <span className="spinner" style={{ width: 14, height: 14 }} /> : `Import ${validRows.length} Row(s)`}
          </button>
        </div>
      )}

      {result && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-body">
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Import Complete</p>
            <p style={{ fontSize: "0.875rem" }}>Created: {result.created} · Updated: {result.updated} · Skipped: {result.skipped}</p>
            {result.newAccounts && result.newAccounts.length > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => downloadCredentials(result.newAccounts!)}>
                Download Credentials ({result.newAccounts.length})
              </button>
            )}
            {result.errors.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {result.errors.map((e, i) => <p key={i} style={{ fontSize: "0.8125rem", color: "var(--color-primary)" }}>{e}</p>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}