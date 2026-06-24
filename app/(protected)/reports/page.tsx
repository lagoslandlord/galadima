"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/providers/AuthProvider";
import { DEPARTMENTS } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import { formatDate } from "@/lib/constants";
import type { ReportType } from "@/lib/models/Report";

interface ReportHistoryItem {
  _id: string;
  reportType: ReportType;
  periodStart: string;
  periodEnd: string;
  recipientEmails: string[];
  generatedBy?: { name: string };
  pdfUrl?: string;
  sheetUrl?: string;
  emailSent: boolean;
  createdAt: string;
  summary?: {
    companyScore: number;
    completionRate: number;
  };
}

const REPORT_TYPES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
];

export default function ReportsPage() {
  const { role } = useAuth();
  const isSuperAdmin = role === "super_admin";

  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateForm, setGenerateForm] = useState({ reportType: "weekly", department: "" });
  const [generating, setGenerating] = useState(false);

 const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState("");
  const [savingRecipients, setSavingRecipients] = useState(false);
 const [viewing, setViewing] = useState<ReportHistoryItem | null>(null);
  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/reports");
      const json = await res.json();
      if (json.success) setHistory(json.reports);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/reports")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setHistory(json.reports);
      })
      .finally(() => setLoading(false));

    if (isSuperAdmin) {
      fetch("/api/reports/settings").then((res) => res.json()).then((json) => json.success && setRecipients(json.reportRecipientEmails));
    }
  }, [isSuperAdmin]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType: generateForm.reportType, department: generateForm.department || undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not generate report");
        return;
      }
      toast.success("Report generated and emailed");
      load();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setGenerating(false);
    }
  }

  async function saveRecipients(updated: string[]) {
    setSavingRecipients(true);
    try {
      const res = await fetch("/api/reports/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportRecipientEmails: updated }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not save recipients");
        return;
      }
      setRecipients(updated);
      toast.success("Recipients updated");
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSavingRecipients(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
        <p style={{ color: "var(--color-neutral-500)", marginTop: 4 }}>
            Weekly, monthly, quarterly, and annual reports — generated and emailed automatically. You can also trigger one manually below.
          </p>
          <p style={{ color: "var(--color-neutral-400)", fontSize: "0.8125rem", marginTop: 2 }}>
            Manual reports cover the period through today. Automated ones cover the most recently completed cycle.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h3>Generate Now</h3></div>
        <form onSubmit={handleGenerate} className="card-body form-grid-2">
          <div className="form-group">
            <label className="form-label">Report Type</label>
            <select
                title="Report Type"
             className="form-select" value={generateForm.reportType} onChange={(e) => setGenerateForm({ ...generateForm, reportType: e.target.value })}>
              {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Department (optional)</label>
            <select
                title="Department"
             className="form-select" value={generateForm.department} onChange={(e) => setGenerateForm({ ...generateForm, department: e.target.value })}>
              <option value="">Whole company</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="btn btn-primary" disabled={generating}>
              {generating ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Generate & Send"}
            </button>
          </div>
        </form>
      </div>

      {isSuperAdmin && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h3>Report Recipients</h3></div>
          <div className="card-body">
            <p style={{ fontSize: "0.875rem", color: "var(--color-neutral-600)", marginBottom: 10 }}>
              Every Super Admin gets every report automatically. Add anyone else who should be cc&apos;d.
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input className="form-input" type="email" placeholder="you@landbookbyharmony.com" value={newRecipient} onChange={(e) => setNewRecipient(e.target.value)} />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={savingRecipients}
                onClick={() => {
                  if (!newRecipient.trim() || recipients.includes(newRecipient.trim())) return;
                  saveRecipients([...recipients, newRecipient.trim()]);
                  setNewRecipient("");
                }}
              >
                Add
              </button>
            </div>
            {recipients.length === 0 ? (
              <p style={{ fontSize: "0.8125rem", color: "var(--color-neutral-400)" }}>No extra recipients yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {recipients.map((email) => (
                  <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem", background: "var(--color-neutral-50)", padding: "6px 10px", borderRadius: "var(--radius-md)" }}>
                    {email}
                    <button disabled={savingRecipients} onClick={() => saveRecipients(recipients.filter((r) => r !== email))} style={{ background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer", fontSize: "0.75rem" }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h3>History</h3></div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><span className="spinner" /></div>
          ) : history.length === 0 ? (
            <div style={{ padding: "20px 24px" }}><EmptyState title="No reports yet" text="Generated reports will show up here." /></div>
          ) : (
            <table className="data-table">
               <thead><tr><th>Type</th><th>Period</th><th>Recipients</th><th>Generated By</th><th>Generated On</th><th></th></tr></thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r._id}>
                    <td style={{ textTransform: "capitalize" }}>{r.reportType}</td>
                    <td>{formatDate(r.periodStart)} – {formatDate(r.periodEnd)}</td>
                   <td>
                      <button onClick={() => setViewing(r)} style={{ background: "none", border: "none", padding: 0, color: "var(--color-info)", fontWeight: 600, fontSize: "0.875rem", textDecoration: "underline", cursor: "pointer" }}>
                        {r.recipientEmails.length}
                      </button>
                    </td>
                    <td>{r.generatedBy?.name || "Automated"}</td>
                    <td style={{ fontSize: "0.8125rem", color: "var(--color-neutral-500)" }}>{new Date(r.createdAt).toLocaleString()}</td>
                    <td style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {r.pdfUrl && <a href={r.pdfUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-info)", fontWeight: 600, fontSize: "0.8125rem" }}>PDF</a>}
                      {r.sheetUrl && <a href={r.sheetUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-info)", fontWeight: 600, fontSize: "0.8125rem" }}>Sheet</a>}
                      {!r.emailSent && <span className="badge badge-rejected" title="No recipients configured, or the send failed">Not Emailed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
           </table>
          )}
        </div>
      </div>

      {viewing && (
        <Modal
          title={`${viewing.reportType.charAt(0).toUpperCase() + viewing.reportType.slice(1)} Report`}
          onClose={() => setViewing(null)}
          footer={<button className="btn btn-primary" onClick={() => setViewing(null)}>Close</button>}
        >
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-neutral-500)" }}>Period</p>
            <p style={{ fontWeight: 600 }}>{formatDate(viewing.periodStart)} – {formatDate(viewing.periodEnd)}</p>
          </div>
          {viewing.summary && (
            <div className="form-grid-2" style={{ marginBottom: 16 }}>
              <div className="stat-card"><p className="stat-label">Company Score</p><p className="stat-value">{viewing.summary.companyScore}%</p></div>
              <div className="stat-card"><p className="stat-label">Completion Rate</p><p className="stat-value">{viewing.summary.completionRate}%</p></div>
            </div>
          )}
          <div>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-neutral-500)", marginBottom: 6 }}>Recipients ({viewing.recipientEmails.length})</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {viewing.recipientEmails.map((email: string) => (
                <span key={email} style={{ fontSize: "0.875rem" }}>{email}</span>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}