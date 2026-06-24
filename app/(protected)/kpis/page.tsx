"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/providers/AuthProvider";
import { DEPARTMENTS } from "@/lib/types";

import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatDate } from "@/lib/constants";
import { CATEGORIES, FORMULAS, KPI_TYPES, STATUSES } from "@/lib/kpiOptions";

interface KpiListItem {
  _id: string;
  name: string;
  employee?: { name: string };
  department: string;
  status: string;
  isOverdue: boolean;
  achievementPercent?: number;
  dueDate: string;
}

interface TemplateItem {
  name: string;
  description: string;
  category: string;
  formula: string;
  kpiType: string;
  targetValue: number;
  weight: number;
  evidenceRequired: boolean;
}

interface Template {
  _id: string;
  name: string;
  description?: string;
  department: string;
  kpis: TemplateItem[];
}

interface TemplateForm {
  name: string;
  description: string;
  department: string;
  kpis: TemplateItem[];
}

interface AssignEmployee {
  _id: string;
  name: string;
  department: string;
}

export default function KpisPage() {
  const { role, department } = useAuth();
  const canManage = role === "super_admin" || role === "department_head";
  const [tab, setTab] = useState<"kpis" | "templates">("kpis");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>KPI Management</h1>
          <p style={{ color: "var(--color-neutral-500)", marginTop: 4 }}>
            {role === "staff" ? "Your assigned KPIs." : "Track, assign, and review KPIs across the company."}
          </p>
        </div>
      </div>

      {canManage && (
        <div className="tab-bar">
          <button className={`tab-btn${tab === "kpis" ? " active" : ""}`} onClick={() => setTab("kpis")}>All KPIs</button>
          <button className={`tab-btn${tab === "templates" ? " active" : ""}`} onClick={() => setTab("templates")}>Templates</button>
        </div>
      )}

      {tab === "kpis" || !canManage ? (
        <KPIsTab canManage={canManage} />
      ) : (
        <TemplatesTab myRole={role} myDepartment={department} />
      )}
    </div>
  );
}

function KPIsTab({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [kpis, setKpis] = useState<KpiListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [kpiType, setKpiType] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (kpiType) params.set("kpiType", kpiType);
      if (showArchived) params.set("archived", "true");
      params.set("limit", "50");
      const res = await fetch(`/api/kpis?${params.toString()}`);
      const json = await res.json();
      if (json.success) setKpis(json.kpis);
    } finally {
      setLoading(false);
    }
  }, [status, kpiType, showArchived]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="filter-bar">
        <select
        title="Filter KPIs by status"
         className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
        title="Filter KPIs by period"
         className="form-select" value={kpiType} onChange={(e) => setKpiType(e.target.value)}>
          <option value="">All periods</option>
          {KPI_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem" }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
        {canManage && <Link href="/kpis/create" className="btn btn-primary" style={{ marginLeft: "auto" }}>+ New KPI</Link>}
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><span className="spinner" /></div>
          ) : kpis.length === 0 ? (
            <div style={{ padding: "20px 24px" }}><EmptyState title="No KPIs found" text="Try adjusting your filters, or create a new one." /></div>
          ) : (
            <table className="data-table">
              <thead><tr><th>KPI</th><th>Employee</th><th>Department</th><th>Status</th><th>Achievement</th><th>Due</th></tr></thead>
              <tbody>
                {kpis.map((kpi) => (
                  <tr key={kpi._id} onClick={() => router.push(`/kpis/${kpi._id}`)} style={{ cursor: "pointer" }}>
                    <td style={{ fontWeight: 600, color: "var(--color-info)" }}>{kpi.name}</td>
                    <td>{kpi.employee?.name}</td>
                    <td>{kpi.department}</td>
                    <td><StatusBadge status={kpi.isOverdue ? "overdue" : kpi.status} /></td>
                    <td>{kpi.achievementPercent != null ? `${kpi.achievementPercent}%` : "—"}</td>
                    <td>{formatDate(kpi.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function emptyTemplateItem() {
  return { name: "", description: "", category: "productivity", formula: "standard", kpiType: "monthly", targetValue: 100, weight: 10, evidenceRequired: false };
}

function TemplatesTab({ myRole, myDepartment }: { myRole: string; myDepartment: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<TemplateForm>({ name: "", description: "", department: myRole === "department_head" ? myDepartment : "", kpis: [emptyTemplateItem()] });
  const [saving, setSaving] = useState(false);

  const [assignTarget, setAssignTarget] = useState<Template | null>(null);
  const [employees, setEmployees] = useState<AssignEmployee[]>([]);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assigning, setAssigning] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/kpi-templates");
      const json = await res.json();
      if (json.success) setTemplates(json.templates);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", department: myRole === "department_head" ? myDepartment : "", kpis: [emptyTemplateItem()] });
    setFormOpen(true);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setForm({ name: t.name, description: t.description || "", department: t.department, kpis: t.kpis });
    setFormOpen(true);
  }

  function updateItem(index: number, field: keyof TemplateItem, value: string | number | boolean) {
    const items = [...form.kpis];
    items[index] = { ...items[index], [field]: value };
    setForm({ ...form, kpis: items });
  }

  async function handleSave() {
    if (!form.name.trim() || !form.department || form.kpis.length === 0) {
      toast.error("Name, department, and at least one KPI line item are required");
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/kpi-templates/${editing._id}` : "/api/kpi-templates";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not save template");
        return;
      }
      toast.success(editing ? "Template updated" : "Template created");
      setFormOpen(false);
      load();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  async function openAssign(t: Template) {
    setAssignTarget(t);
    setAssignEmployeeId("");
    const dept = myRole === "department_head" ? myDepartment : t.department;
    const res = await fetch(`/api/users?department=${encodeURIComponent(dept)}`);
    const json = await res.json();
    if (json.success) setEmployees(json.users);
  }

  async function handleAssign() {
    if (!assignTarget || !assignEmployeeId) {
      toast.error("Choose an employee first");
      return;
    }
    setAssigning(true);
    try {
      const res = await fetch(`/api/kpi-templates/${assignTarget._id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: assignEmployeeId }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not assign template");
        return;
      }
      toast.success(json.message || "Template assigned");
      setAssignTarget(null);
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setAssigning(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/kpi-templates/${deleteTarget._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not delete template");
        return;
      }
      toast.success("Template deleted");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="filter-bar">
        <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={openCreate}>+ New Template</button>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><span className="spinner" /></div>
          ) : templates.length === 0 ? (
            <div style={{ padding: "20px 24px" }}><EmptyState title="No templates yet" text="Create one to assign a full set of KPIs to staff in one click." /></div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Template</th><th>Department</th><th>KPIs</th><th></th></tr></thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t._id}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td>{t.department}</td>
                    <td>{t.kpis.length}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => openAssign(t)}>Assign</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>Edit</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: "var(--color-primary)" }} onClick={() => setDeleteTarget(t)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {formOpen && (
        <Modal
          title={editing ? "Edit Template" : "New Template"}
          onClose={() => setFormOpen(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Save Template"}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label required">Template Name</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. TPM Template" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
             title="Enter a description for this template"
             className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label required">Department</label>
            <select
             title="Select the department for this template"
             className="form-select" value={form.department} disabled={myRole === "department_head"} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <p className="modal-danger-zone-label" style={{ marginTop: 18 }}>KPI Line Items</p>
          {form.kpis.map((item: TemplateItem, index: number) => (
            <div key={index} className="card" style={{ marginBottom: 10 }}>
              <div className="card-body">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong style={{ fontSize: "0.8125rem" }}>KPI #{index + 1}</strong>
                  {form.kpis.length > 1 && (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--color-primary)" }} onClick={() => setForm({ ...form, kpis: form.kpis.filter((_: TemplateItem, i: number) => i !== index) })}>
                      Remove
                    </button>
                  )}
                </div>
                <div className="form-group">
                  <input
                   title="Enter the name for this KPI"
                   className="form-input" placeholder="KPI name" value={item.name} onChange={(e) => updateItem(index, "name", e.target.value)} />
                </div>
                <div className="form-grid-2">
                  <select
                   title="Select the category for this KPI"
                   className="form-select" value={item.category} onChange={(e) => updateItem(index, "category", e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <select
                   title="Select the formula for this KPI"
                   className="form-select" value={item.formula} onChange={(e) => updateItem(index, "formula", e.target.value)}>
                    {FORMULAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select
                   title="Select the period for this KPI"
                   className="form-select" value={item.kpiType} onChange={(e) => updateItem(index, "kpiType", e.target.value)}>
                    {KPI_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input
                   title="Enter the target value for this KPI"
                   type="number" className="form-input" placeholder="Target" value={item.targetValue} onChange={(e) => updateItem(index, "targetValue", Number(e.target.value))} />
                  <input
                   title="Enter the weight for this KPI"
                   type="number" className="form-input" placeholder="Weight %" value={item.weight} onChange={(e) => updateItem(index, "weight", Number(e.target.value))} />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem" }}>
                    <input
                     title="Check if evidence is required for this KPI"
                     type="checkbox" checked={item.evidenceRequired} onChange={(e) => updateItem(index, "evidenceRequired", e.target.checked)} />
                    Evidence required
                  </label>
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm({ ...form, kpis: [...form.kpis, emptyTemplateItem()] })}>+ Add KPI</button>
        </Modal>
      )}

      {assignTarget && (
        <Modal
          title={`Assign "${assignTarget.name}"`}
          onClose={() => setAssignTarget(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setAssignTarget(null)} disabled={assigning}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAssign} disabled={assigning}>
                {assigning ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Assign"}
              </button>
            </>
          }
        >
          <p style={{ marginBottom: 12, fontSize: "0.875rem", color: "var(--color-neutral-600)" }}>
            This creates all {assignTarget.kpis.length} KPI(s) from this template for the selected employee.
          </p>
          <div className="form-group">
            <label className="form-label required">Employee</label>
            <select
             title="Select the employee for this KPI"
             className="form-select" value={assignEmployeeId} onChange={(e) => setAssignEmployeeId(e.target.value)}>
              <option value="">Select employee</option>
              {employees.map((emp) => <option key={emp._id} value={emp._id}>{emp.name} — {emp.department}</option>)}
            </select>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Template"
          message={`Delete "${deleteTarget.name}"? Existing KPIs created from it won't be affected.`}
          confirmLabel="Delete"
          danger
          loading={deleting}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}