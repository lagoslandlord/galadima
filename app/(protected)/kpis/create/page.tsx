"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/providers/AuthProvider";
import { useDepartments } from "@/lib/hooks/useDepartments";
import { CATEGORIES, FORMULAS, KPI_TYPES } from "@/lib/kpiOptions";


interface Employee {
  _id: string;
  name: string;
}

export default function CreateKpiPage() {
  const router = useRouter();
 const { role, department } = useAuth();
  const { departments } = useDepartments();

  const [form, setForm] = useState({
    name: "", description: "",
    department: role === "department_head" ? department : "",
    employee: "",
    category: "productivity", formula: "standard", kpiType: "monthly",
    weight: 10, targetValue: 100, evidenceRequired: false,
    dueDate: "", notes: "",
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!form.department) {
      Promise.resolve().then(() => setEmployees([]));
      return;
    }
    fetch(`/api/users?department=${encodeURIComponent(form.department)}`)
      .then((res) => res.json())
      .then((json) => json.success && setEmployees(json.users));
  }, [form.department]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.department || !form.employee) {
      toast.error("Name, department, and employee are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not create KPI");
        return;
      }
      toast.success("KPI created");
      router.push(`/kpis/${json.kpi._id}`);
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <Link href="/kpis" style={{ fontSize: "0.875rem", color: "var(--color-neutral-500)" }}>← Back to KPIs</Link>
      <h1 style={{ marginTop: 12, marginBottom: 20 }}>New KPI</h1>

      <form onSubmit={handleSubmit} className="card">
        <div className="card-body">
          <div className="form-group">
            <label className="form-label required">KPI Name</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sprint Completion" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
            title="Enter a brief description of this KPI"
             className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          
              <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label required">Department</label>
               <select
                title="Department"
                className="form-select"
                value={form.department}
                disabled={role === "department_head"}
                onChange={(e) => setForm({ ...form, department: e.target.value, employee: "" })}
              >
                <option value="">Select department</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">Employee</label>
              <select
              title="Select the employee for this KPI"
               className="form-select" value={form.employee} disabled={!form.department} onChange={(e) => setForm({ ...form, employee: e.target.value })}>
                <option value="">Select employee</option>
                {employees.map((emp) => <option key={emp._id} value={emp._id}>{emp.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
              title="Select the category for this KPI"
               className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Formula</label>
              <select
              title="Select the formula for this KPI"
               className="form-select" value={form.formula} onChange={(e) => setForm({ ...form, formula: e.target.value })}>
                {FORMULAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Period</label>
              <select
              title="Select the period for this KPI"
               className="form-select" value={form.kpiType} onChange={(e) => setForm({ ...form, kpiType: e.target.value })}>
                {KPI_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input
              title="Select the due date for this KPI"
               type="date" className="form-input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              <p className="form-hint">Leave blank to use the end of the selected period.</p>
            </div>
            <div className="form-group">
              <label className="form-label required">Target Value</label>
              <input
              title="Enter the target value for this KPI"
               type="number" className="form-input" value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label className="form-label required">Weight (%)</label>
              <input
              title="Enter the weight for this KPI"
               type="number" className="form-input" value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={form.evidenceRequired} onChange={(e) => setForm({ ...form, evidenceRequired: e.target.checked })} />
              Evidence required for submission
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
             title="Enter any additional notes for this KPI"
             className="form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="modal-footer" style={{ borderTop: "1px solid var(--color-neutral-100)" }}>
          <Link href="/kpis" className="btn btn-secondary">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Create KPI"}
          </button>
        </div>
      </form>
    </div>
  );
}