"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/providers/AuthProvider";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

interface DepartmentHead {
  _id: string;
  name: string;
}

interface Department {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  head?: DepartmentHead;
  employeeCount?: number;
}

export default function DepartmentsPage() {
  const { role } = useAuth();
  const canManage = role === "super_admin" || role === "hr_admin";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [heads, setHeads] = useState<DepartmentHead[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: "", description: "", headId: "" });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/departments");
      const json = await res.json();
      if (json.success) setDepartments(json.departments);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (canManage) {
      fetch("/api/users?role=department_head")
        .then((res) => res.json())
        .then((json) => json.success && setHeads(json.users));
    }
  }, [canManage]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", headId: "" });
    setFormOpen(true);
  }

  function openEdit(dept: Department) {
    setEditing(dept);
    setForm({ name: dept.name, description: dept.description || "", headId: dept.head?._id || "" });
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Department name is required");
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/departments/${editing._id}` : "/api/departments";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, description: form.description, head: form.headId || null }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not save department");
        return;
      }
      toast.success(editing ? "Department updated" : "Department created");
      setFormOpen(false);
      load();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/departments/${deleteTarget._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not delete department");
        return;
      }
      toast.success("Department deleted");
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
      <div className="page-header">
        <div>
          <h1>Departments</h1>
          <p style={{ color: "var(--color-neutral-500)", marginTop: 4 }}>All departments across Harmony Garden.</p>
        </div>
        {canManage && <button className="btn btn-primary" onClick={openCreate}>+ New Department</button>}
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><span className="spinner" /></div>
          ) : departments.length === 0 ? (
            <div style={{ padding: "20px 24px" }}>
              <EmptyState title="No departments yet" text="Create your first department to start organizing teams." />
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Head</th><th>Employees</th><th>Status</th>{canManage && <th></th>}</tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept._id}>
                    <td>
                     <Link href={`/departments/${dept._id}`} style={{ fontWeight: 600, color: "var(--color-info)" }}>
                        {dept.name}
                      </Link>
                    </td>
                    <td>{dept.head?.name || <span style={{ color: "var(--color-neutral-400)" }}>Unassigned</span>}</td>
                    <td>{dept.employeeCount ?? "—"}</td>
                    <td>
                      <span className={`badge ${dept.isActive ? "badge-approved" : "badge-rejected"}`}>
                        {dept.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(dept)}>Edit</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: "var(--color-primary)" }} onClick={() => setDeleteTarget(dept)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {formOpen && (
        <Modal
          title={editing ? "Edit Department" : "New Department"}
          onClose={() => setFormOpen(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : editing ? "Save Changes" : "Create Department"}
              </button>
            </>
          }
        >
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label required">Department Name</label>
              <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Construction" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this department is responsible for" />
            </div>
            <div className="form-group">
              <label className="form-label">Department Head</label>
              <select
              title="Select Option"
               className="form-select" value={form.headId} onChange={(e) => setForm({ ...form, headId: e.target.value })}>
                <option value="">No head assigned</option>
                {heads.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
              </select>
              <p className="form-hint">Only users with the Department Head role appear here.</p>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Department"
          message={`Delete "${deleteTarget.name}"? This can't be undone.`}
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