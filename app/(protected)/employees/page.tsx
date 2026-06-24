"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/providers/AuthProvider";
import { ROLE_LABELS } from "@/lib/constants";
import { DEPARTMENTS } from "@/lib/types";
import type { UserRole } from "@/lib/types";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import RoleBadge from "@/components/RoleBadge";

interface Employee {
  _id: string;
  name: string;
  email: string;
  employeeId: string;
  phone?: string;
  role: UserRole;
  department: string;
  isActive: boolean;
}

const EMPTY_CREATE_FORM = { name: "", email: "", phone: "", role: "staff", department: "" };

export default function EmployeesPage() {
  const { role: myRole } = useAuth();
  const canManage = myRole === "super_admin" || myRole === "hr_admin";
  const canChangeRole = myRole === "super_admin";
  const canDelete = myRole === "super_admin";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [creating, setCreating] = useState(false);

  const [manageTarget, setManageTarget] = useState<Employee | null>(null);
  const [manageForm, setManageForm] = useState({ name: "", phone: "", department: "", role: "staff", isActive: true });
  const [savingManage, setSavingManage] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [newCredentials, setNewCredentials] = useState<{ name: string; employeeId: string; temporaryPassword: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      if (deptFilter) params.set("department", deptFilter);
      const res = await fetch(`/api/users?${params.toString()}`);
      const json = await res.json();
      if (json.success) setEmployees(json.users);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, deptFilter]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  function openManage(emp: Employee) {
    setManageTarget(emp);
    setManageForm({ name: emp.name, phone: emp.phone || "", department: emp.department, role: emp.role, isActive: emp.isActive });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.name || !createForm.email || !createForm.role || !createForm.department) {
      toast.error("Please fill in all required fields");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not create employee");
        return;
      }
      toast.success("Employee created");
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE_FORM);
      setNewCredentials({ name: json.user.name, employeeId: json.user.employeeId, temporaryPassword: json.temporaryPassword });
      load();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setCreating(false);
    }
  }

  async function handleManageSave() {
    if (!manageTarget) return;
    setSavingManage(true);
    try {
      const res = await fetch(`/api/users/${manageTarget._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: manageForm.name, phone: manageForm.phone, department: manageForm.department, isActive: manageForm.isActive }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not update employee");
        return;
      }

      if (canChangeRole && manageForm.role !== manageTarget.role) {
        const roleRes = await fetch(`/api/users/${manageTarget._id}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: manageForm.role }),
        });
        const roleJson = await roleRes.json();
        if (!roleJson.success) toast.error(roleJson.error || "Updated profile, but role change failed");
      }

      toast.success("Employee updated");
      setManageTarget(null);
      load();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSavingManage(false);
    }
  }

  async function handleResetPassword() {
    if (!manageTarget) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/users/${manageTarget._id}/reset-password`, { method: "PATCH" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not reset password");
        return;
      }
      setNewCredentials({ name: manageTarget.name, employeeId: manageTarget.employeeId, temporaryPassword: json.temporaryPassword });
      setManageTarget(null);
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not delete employee");
        return;
      }
      toast.success("Employee deleted");
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
          <h1>Employees</h1>
          <p style={{ color: "var(--color-neutral-500)", marginTop: 4 }}>Everyone at Harmony Garden, by department.</p>
        </div>
        {canManage && <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>+ Add Employee</button>}
      </div>

      <div className="filter-bar">
        <input className="form-input" placeholder="Search name, email, or ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select
         title="Role"
          className="form-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {canManage && (
          <select
           title="Department"
            className="form-select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">All departments</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><span className="spinner" /></div>
          ) : employees.length === 0 ? (
            <div style={{ padding: "20px 24px" }}>
              <EmptyState title="No employees found" text="Try adjusting your search or filters." />
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Employee ID</th><th>Role</th><th>Department</th><th>Status</th>{canManage && <th></th>}</tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp._id}>
                    <td><Link href={`/employees/${emp._id}`} style={{ fontWeight: 600, color: "var(--color-info)" }}>{emp.name}</Link></td>
                    <td>{emp.employeeId}</td>
                    <td><RoleBadge role={emp.role} /></td>
                    <td>{emp.department}</td>
                    <td>
                      <span className={`badge ${emp.isActive ? "badge-approved" : "badge-rejected"}`}>{emp.isActive ? "Active" : "Inactive"}</span>
                    </td>
                    {canManage && <td><button className="btn btn-ghost btn-sm" onClick={() => openManage(emp)}>Manage</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create */}
      {createOpen && (
        <Modal
          title="Add Employee"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Create Employee"}
              </button>
            </>
          }
        >
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label required">Full Name</label>
              <input
              title="Full Name"
               className="form-input" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label required">Work Email</label>
              <input
              title="Work Email"
               type="email" className="form-input" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
              title="Phone"
               className="form-input" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label required">Role</label>
              <select
              title="Role"
               className="form-select" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
                {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">Department</label>
              <select
              title="Department"
               className="form-select" value={createForm.department} onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}>
                <option value="">Select department</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <p className="form-hint">A temporary password is generated automatically — you&apos;ll see it once, right after this is created.</p>
          </form>
        </Modal>
      )}

      {/* Manage */}
      {manageTarget && (
        <Modal
          title={`Manage ${manageTarget.name}`}
          onClose={() => setManageTarget(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setManageTarget(null)} disabled={savingManage}>Cancel</button>
              <button className="btn btn-primary" onClick={handleManageSave} disabled={savingManage}>
                {savingManage ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Save Changes"}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
             title="Full Name"
              className="form-input" value={manageForm.name} onChange={(e) => setManageForm({ ...manageForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input
             title="Phone"
              className="form-input" value={manageForm.phone} onChange={(e) => setManageForm({ ...manageForm, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Department</label>
            <select
             title="Department"
              className="form-select" value={manageForm.department} onChange={(e) => setManageForm({ ...manageForm, department: e.target.value })}>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select
             title="Role"
              className="form-select" value={manageForm.role} disabled={!canChangeRole} onChange={(e) => setManageForm({ ...manageForm, role: e.target.value })}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {!canChangeRole && <p className="form-hint">Only a Super Admin can change roles.</p>}
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={manageForm.isActive} onChange={(e) => setManageForm({ ...manageForm, isActive: e.target.checked })} />
              Active
            </label>
          </div>

          <div className="modal-danger-zone">
            <p className="modal-danger-zone-label">Other actions</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleResetPassword} disabled={resetting}>
                {resetting ? "Resetting…" : "Reset Password"}
              </button>
              {canDelete && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => { setDeleteTarget(manageTarget); setManageTarget(null); }}
                >
                  Delete Employee
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Employee"
          message={`Delete ${deleteTarget.name} permanently? This can't be undone.`}
          confirmLabel="Delete"
          danger
          loading={deleting}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* New credentials reveal */}
      {newCredentials && (
        <Modal title="New Password" onClose={() => setNewCredentials(null)} footer={<button className="btn btn-primary" onClick={() => setNewCredentials(null)}>Done</button>}>
          <p style={{ marginBottom: 12, fontSize: "0.9375rem" }}>
            Share this with <strong>{newCredentials.name}</strong> ({newCredentials.employeeId}) — it won&apos;t be shown again.
          </p>
          <div className="credential-box">{newCredentials.temporaryPassword}</div>
        </Modal>
      )}
    </div>
  );
}