"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/constants";
import StatCard from "@/components/StatCard";
import { IconHistory, IconUpload } from "@/components/icons";

export default function AdminPage() {
  const [stats, setStats] = useState({ totalUsers: 0, totalDepartments: 0, pendingSubmissions: 0, totalAuditEntries: 0 });
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [usersRes, deptsRes, subsRes, auditRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/departments"),
          fetch("/api/submissions?status=pending_review&limit=1"),
          fetch("/api/audit?limit=1"),
        ]);
        const usersJson = await usersRes.json();
        const deptsJson = await deptsRes.json();
        const subsJson = await subsRes.json();
        const auditJson = await auditRes.json();

        if (usersJson.success) {
          setStats((s) => ({ ...s, totalUsers: usersJson.users.length }));
          const counts: Record<string, number> = {};
          for (const u of usersJson.users) counts[u.role] = (counts[u.role] || 0) + 1;
          setRoleCounts(counts);
        }
        if (deptsJson.success) setStats((s) => ({ ...s, totalDepartments: deptsJson.departments.length }));
        if (subsJson.success) setStats((s) => ({ ...s, pendingSubmissions: subsJson.pagination.total }));
        if (auditJson.success) setStats((s) => ({ ...s, totalAuditEntries: auditJson.pagination.total }));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

 const quickLinks = [
    { href: "/admin/import", label: "Bulk Import", icon: IconUpload },
    { href: "/audit", label: "View Audit Log", icon: IconHistory },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Admin</h1>
          <p style={{ color: "var(--color-neutral-500)", marginTop: 4 }}>System overview and quick actions.</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><span className="spinner" /></div>
      ) : (
        <>
          <div className="dashboard-stats-grid" style={{ marginBottom: 20 }}>
            <StatCard label="Active Users" value={stats.totalUsers} />
            <StatCard label="Departments" value={stats.totalDepartments} />
            <StatCard label="Pending Submissions" value={stats.pendingSubmissions} />
            <StatCard label="Audit Entries" value={stats.totalAuditEntries} />
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><h3>Users by Role</h3></div>
            <div className="card-body" style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <div key={value}>
                  <p className="stat-label">{label}</p>
                  <p className="stat-value" style={{ fontSize: "1.5rem" }}>{roleCounts[value] || 0}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Quick Actions</h3></div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {quickLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  style={{ display: "flex", flexDirection: "column", gap: 10, padding: 18, border: "1px solid var(--color-neutral-200)", borderRadius: "var(--radius-md)", color: "var(--color-neutral-800)", textDecoration: "none" }}
                >
                  <Icon size={22} />
                  <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}