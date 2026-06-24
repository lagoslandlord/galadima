"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/providers/AuthProvider";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/lib/constants";

interface Submission {
  _id: string;
  kpi: { _id: string; name: string };
  employee: { name: string; employeeId: string };
  submittedValue: number;
  notes?: string;
  evidenceUrls?: string[];
  evidenceFileNames?: string[];
  submittedAt: string;
  status: string;
}

export default function SubmissionsPage() {
  const { role } = useAuth();
    const canReview = role === "super_admin" || role === "department_head";

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(canReview ? "pending_review" : "");

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      params.set("limit", "50");
      const res = await fetch(`/api/submissions?${params.toString()}`);
      const json = await res.json();
      if (json.success) setSubmissions(json.submissions);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

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
      toast.success(action === "approve" ? "Approved" : "Rejected");
      setReviewingId(null);
      setReviewNotes("");
      load();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Submissions</h1>
          <p style={{ color: "var(--color-neutral-500)", marginTop: 4 }}>
            {canReview ? "Review progress submitted against assigned KPIs." : "Your submitted progress, across all your KPIs."}
          </p>
        </div>
      </div>

      <div className="filter-bar">
        <select
        title="Filter"
         className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending_review">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><span className="spinner" /></div>
          ) : submissions.length === 0 ? (
            <div style={{ padding: "20px 24px" }}>
              <EmptyState title="Nothing here" text={status === "pending_review" ? "No submissions are waiting on review right now." : "No submissions match this filter."} />
            </div>
          ) : (
            <div>
              {submissions.map((sub) => (
                <div key={sub._id} style={{ padding: "16px 24px", borderBottom: "1px solid var(--color-neutral-100)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <Link href={`/kpis/${sub.kpi._id}`} style={{ fontWeight: 600, color: "var(--color-neutral-900)" }}>{sub.kpi.name}</Link>
                      <p style={{ fontSize: "0.8125rem", color: "var(--color-neutral-500)", marginTop: 2 }}>
                        {sub.employee.name} ({sub.employee.employeeId}) · Reported {sub.submittedValue} · {formatDate(sub.submittedAt)}
                      </p>
                      {sub.notes && <p style={{ fontSize: "0.875rem", color: "var(--color-neutral-600)", marginTop: 4 }}>{sub.notes}</p>}
                          {(sub.evidenceUrls?.length ?? 0) > 0 && (
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                          {sub.evidenceUrls?.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" style={{ fontSize: "0.8125rem", color: "var(--color-info)" }}>
                              {sub.evidenceFileNames?.[i] || `Evidence ${i + 1}`}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={sub.status} />
                  </div>

                  {canReview && sub.status === "pending_review" && (
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
    </div>
  );
}