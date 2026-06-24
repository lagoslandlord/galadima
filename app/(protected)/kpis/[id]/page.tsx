"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/providers/AuthProvider";
import StatusBadge from "@/components/StatusBadge";
import PerformanceBar from "@/components/PerformanceBar";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import EvidenceUploader from "@/components/EvidenceUploader";
import { formatDate } from "@/lib/constants";

interface KpiEmployee {
  _id: string;
  name: string;
  email: string;
  employeeId: string;
  department: string;
}

interface KpiDetail {
  _id: string;
  name: string;
  description?: string;
  department: string;
  employee: KpiEmployee;
  assignedBy?: { _id: string; name: string };
  category: string;
  formula: string;
  kpiType: string;
  weight: number;
  targetValue: number;
  actualValue?: number;
  achievementPercent?: number;
  weightedScore?: number;
  status: string;
  evidenceRequired: boolean;
  dueDate: string;
  rejectionReason?: string;
  notes?: string;
  isOverdue: boolean;
   isArchived: boolean;
}

interface Submission {
  _id: string;
  submittedValue: number;
  notes?: string;
  evidenceUrls: string[];
  status: string;
  submittedAt: string;
}

export default function KpiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuth();

  const [kpi, setKpi] = useState<KpiDetail | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const [submitForm, setSubmitForm] = useState<{ submittedValue: string; notes: string; evidenceFiles: { url: string; name: string }[] }>({ submittedValue: "", notes: "", evidenceFiles: [] });
  const [submitting, setSubmitting] = useState(false);

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ weight: 0, targetValue: 0, dueDate: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [kpiRes, subRes] = await Promise.all([fetch(`/api/kpis/${id}`), fetch(`/api/submissions?kpi=${id}`)]);
      const kpiJson = await kpiRes.json();
      if (!kpiJson.success) {
        toast.error(kpiJson.error || "Could not load KPI");
        return;
      }
      setKpi(kpiJson.kpi);
      setEditForm({
        weight: kpiJson.kpi.weight,
        targetValue: kpiJson.kpi.targetValue,
        dueDate: kpiJson.kpi.dueDate?.slice(0, 10) || "",
        notes: kpiJson.kpi.notes || "",
      });

      const subJson = await subRes.json();
      if (subJson.success) setSubmissions(subJson.submissions);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><span className="spinner" /></div>;
  if (!kpi) return <EmptyState title="KPI not found" text="It may have been deleted." />;

 const isOwner = String(kpi.employee._id) === String(user.id);
  const isOwnDeptHead = user.role === "department_head" && kpi.department === user.department;
  const isPrivileged = user.role === "super_admin" || user.role === "hr_admin";
  const canManage = isOwnDeptHead || isPrivileged;
  const hasPendingSubmission = submissions.some((s) => s.status === "pending_review");
  const canSubmit = isOwner && kpi.status !== "approved" && !hasPendingSubmission;

  async function handleSubmitProgress(e: React.FormEvent) {
    e.preventDefault();
    if (!kpi || !submitForm.submittedValue) {
      if (!submitForm.submittedValue) toast.error("Enter the value you're reporting");
      return;
    }
    setSubmitting(true);
    try {
    const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kpiId: kpi._id,
          submittedValue: Number(submitForm.submittedValue),
          notes: submitForm.notes,
          evidenceUrls: submitForm.evidenceFiles.map((f) => f.url),
          evidenceFileNames: submitForm.evidenceFiles.map((f) => f.name),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not submit progress");
        return;
      }
        toast.success("Progress submitted for review");
      setSubmitForm({ submittedValue: "", notes: "", evidenceFiles: [] });
      load();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(submissionId: string, action: "approve" | "reject") {
    setReviewing(true);
    try {
      const res = await fetch(`/api/submissions/${submissionId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewNotes }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not review submission");
        return;
      }
      toast.success(action === "approve" ? "Submission approved" : "Submission rejected");
      setReviewingId(null);
      setReviewNotes("");
      load();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setReviewing(false);
    }
  }

  async function handleEditSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/kpis/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight: Number(editForm.weight), targetValue: Number(editForm.targetValue), dueDate: editForm.dueDate, notes: editForm.notes }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not update KPI");
        return;
      }
      toast.success("KPI updated");
      setEditOpen(false);
      load();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  async function handleClone() {
    setCloning(true);
    try {
      const res = await fetch(`/api/kpis/${id}/clone`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not clone KPI");
        return;
      }
      toast.success("KPI cloned for the next period");
      router.push(`/kpis/${json.kpi._id}`);
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setCloning(false);
    }
  }

   async function handleArchive() {
    setArchiving(true);
    try {
      const res = await fetch(`/api/kpis/${id}/archive`, { method: "PATCH" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not update KPI");
        return;
      }
      toast.success(json.kpi.isArchived ? "KPI archived" : "KPI unarchived");
      load();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {

    setDeleting(true);
    try {
      const res = await fetch(`/api/kpis/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not delete KPI");
        return;
      }
      toast.success("KPI deleted");
      router.push("/kpis");
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <Link href="/kpis" style={{ fontSize: "0.875rem", color: "var(--color-neutral-500)" }}>← Back to KPIs</Link>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <h1>{kpi.name}</h1>
          <p style={{ color: "var(--color-neutral-500)", marginTop: 4 }}>{kpi.description || "No description."}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusBadge status={kpi.isOverdue ? "overdue" : kpi.status} />
          {kpi.isArchived && <span className="badge badge-neutral">Archived</span>}
          {canManage && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditOpen(true)}>Edit</button>
              <button className="btn btn-secondary btn-sm" onClick={handleClone} disabled={cloning}>{cloning ? "Cloning…" : "Clone"}</button>
              <button className="btn btn-secondary btn-sm" onClick={handleArchive} disabled={archiving}>{archiving ? "…" : kpi.isArchived ? "Unarchive" : "Archive"}</button>
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--color-primary)" }} onClick={() => setDeleteOpen(true)}>Delete</button>
            </>
          )}
        </div>
      </div>

      <div className="dashboard-stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card"><p className="stat-label">Employee</p><p className="stat-value" style={{ fontSize: "1.1rem" }}>{kpi.employee.name}</p></div>
        <div className="stat-card"><p className="stat-label">Department</p><p className="stat-value" style={{ fontSize: "1.1rem" }}>{kpi.department}</p></div>
        <div className="stat-card"><p className="stat-label">Target</p><p className="stat-value">{kpi.targetValue}</p></div>
        <div className="stat-card"><p className="stat-label">Weight</p><p className="stat-value">{kpi.weight}%</p></div>
      </div>

      {kpi.achievementPercent != null && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body">
            <p className="stat-label">Achievement</p>
            <p className="stat-value" style={{ fontSize: "2rem" }}>{kpi.achievementPercent}%</p>
            <div style={{ marginTop: 10 }}><PerformanceBar score={kpi.achievementPercent} /></div>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-neutral-500)", marginTop: 8 }}>
              Weighted score: {kpi.weightedScore}% · Actual value: {kpi.actualValue}
            </p>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
         <div className="card-body form-grid-2" style={{ fontSize: "0.875rem" }}>
          <p><strong>Category:</strong> {kpi.category}</p>
          <p><strong>Formula:</strong> {kpi.formula}</p>
          <p><strong>Period:</strong> {kpi.kpiType}</p>
          <p><strong>Due:</strong> {formatDate(kpi.dueDate)}</p>
          <p><strong>Assigned by:</strong> {kpi.assignedBy?.name}</p>
          <p><strong>Evidence required:</strong> {kpi.evidenceRequired ? "Yes" : "No"}</p>
        </div>
        {kpi.rejectionReason && (
          <div className="card-body" style={{ borderTop: "1px solid var(--color-neutral-100)" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--color-primary)" }}><strong>Last rejection reason:</strong> {kpi.rejectionReason}</p>
          </div>
        )}
      </div>

      {canSubmit && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h3>Submit Progress</h3></div>
          <form onSubmit={handleSubmitProgress} className="card-body">
            <div className="form-group">
              <label className="form-label required">Value Achieved</label>
              <input title="Enter the value achieved for this KPI" type="number" className="form-input" value={submitForm.submittedValue} onChange={(e) => setSubmitForm({ ...submitForm, submittedValue: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea title="Enter any additional notes for this submission" className="form-textarea" value={submitForm.notes} onChange={(e) => setSubmitForm({ ...submitForm, notes: e.target.value })} />
            </div>
           <div className="form-group">
              <label className="form-label">{kpi.evidenceRequired ? "Evidence" : "Evidence (optional)"}</label>
              <EvidenceUploader files={submitForm.evidenceFiles} onChange={(files) => setSubmitForm({ ...submitForm, evidenceFiles: files })} />
              <p className="form-hint">PDF, JPG, PNG, MP4, XLSX, or DOCX — up to 100MB each.</p>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Submit for Review"}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h3>Submission History</h3></div>
        <div className="card-body" style={{ padding: 0 }}>
          {submissions.length === 0 ? (
            <div style={{ padding: "20px 24px" }}><EmptyState title="No submissions yet" text="Progress updates will appear here once submitted." /></div>
          ) : (
            <div>
              {submissions.map((sub) => (
                <div key={sub._id} style={{ padding: "16px 24px", borderBottom: "1px solid var(--color-neutral-100)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <p style={{ fontWeight: 600 }}>Value: {sub.submittedValue}</p>
                      {sub.notes && <p style={{ fontSize: "0.875rem", color: "var(--color-neutral-600)", marginTop: 4 }}>{sub.notes}</p>}
                      <p style={{ fontSize: "0.75rem", color: "var(--color-neutral-400)", marginTop: 4 }}>Submitted {formatDate(sub.submittedAt)}</p>
                      {sub.evidenceUrls?.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          {sub.evidenceUrls.map((url: string, i: number) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer" style={{ fontSize: "0.8125rem", display: "block", color: "var(--color-info)" }}>{url}</a>
                          ))}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={sub.status} />
                  </div>

                  {canManage && sub.status === "pending_review" && (
                    <div style={{ marginTop: 12 }}>
                      {reviewingId === sub._id ? (
                        <div>
                          <textarea className="form-textarea" placeholder="Optional review notes" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} style={{ marginBottom: 8 }} />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn btn-primary btn-sm" disabled={reviewing} onClick={() => handleReview(sub._id, "approve")}>Approve</button>
                            <button className="btn btn-danger btn-sm" disabled={reviewing} onClick={() => handleReview(sub._id, "reject")}>Reject</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setReviewingId(null); setReviewNotes(""); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button className="btn btn-secondary btn-sm" onClick={() => setReviewingId(sub._id)}>Review</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editOpen && (
        <Modal
          title="Edit KPI"
          onClose={() => setEditOpen(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Save Changes"}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Target Value</label>
            <input
            title="Enter a numeric target value for this KPI"
             type="number" className="form-input" value={editForm.targetValue} onChange={(e) => setEditForm({ ...editForm, targetValue: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label className="form-label">Weight (%)</label>
            <input title="Enter the weight percentage for this KPI" type="number" className="form-input" value={editForm.weight} onChange={(e) => setEditForm({ ...editForm, weight: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input title="Select the due date for this KPI" type="date" className="form-input" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea title="Enter any additional notes for this KPI" className="form-textarea" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          </div>
        </Modal>
      )}

      {deleteOpen && (
        <ConfirmDialog
          title="Delete KPI"
          message={`Delete "${kpi.name}"? This can't be undone.`}
          confirmLabel="Delete"
          danger
          loading={deleting}
          onConfirm={handleDelete}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}