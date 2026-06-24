"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import PerformanceBar from "@/components/PerformanceBar";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/lib/constants";

interface DueKPI {
  _id: string;
  name: string;
  status: string;
  targetValue: number;
  dueDate: string;
}

interface EmployeeData {
  personalScore: number;
  assignedKPIs: number;
  completedKPIs: number;
  overdueKPIs: number;
  dueKPIs: DueKPI[];
}

interface TeamMember {
  employee: { id: string; name: string };
  score: number;
  completedKPIs: number;
  totalKPIs: number;
}

interface DepartmentData {
  departmentScore: number;
  totalMembers: number;
  openKPIs: number;
  missedKPIs: number;
  teamPerformance: TeamMember[];
}

interface DepartmentRanking {
  department: string;
  score: number;
  completionRate: number;
}

interface PerformerEntry {
  employee: { id: string; name: string; department: string };
  score: number;
}

interface ExecutiveData {
  companyScore: number;
  totalEmployees: number;
  activeKPIs: number;
  overdueKPIs: number;
  kpiCompletionRate: number;
  completedKPIs: number;
  departmentRankings: DepartmentRanking[];
  topPerformers: PerformerEntry[];
  underperformers: PerformerEntry[];
}

type DashboardResult =
  | { view: "employee"; data: EmployeeData }
  | { view: "department"; data: DepartmentData }
  | { view: "executive"; data: ExecutiveData };

export default function DashboardPage() {
  const { name } = useAuth();
  const [result, setResult] = useState<DashboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setError(json.error || "Could not load dashboard");
          return;
        }
        setResult(json);
      })
      .catch(() => setError("Could not reach the server"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "60px 0", justifyContent: "center" }}>
        <span className="spinner" />
        <span style={{ color: "var(--color-neutral-500)" }}>Loading dashboard…</span>
      </div>
    );
  }

  if (error || !result) {
    return <EmptyState title="Couldn't load your dashboard" text={error || "Something went wrong. Try refreshing the page."} />;
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1>Welcome back, {name.split(" ")[0]}</h1>
        <p style={{ color: "var(--color-neutral-500)", marginTop: 4 }}>Here&apos;s how things are looking today.</p>
      </div>

      {result.view === "employee" && <EmployeeDashboard data={result.data} />}
      {result.view === "department" && <DepartmentDashboard data={result.data} />}
      {result.view === "executive" && <ExecutiveDashboard data={result.data} />}
    </div>
  );
}

function EmployeeDashboard({ data }: { data: EmployeeData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="dashboard-score-row">
        <div className="card">
          <div className="card-body">
            <p className="stat-label">Personal Score</p>
            <p className="stat-value" style={{ fontSize: "2.75rem" }}>{data.personalScore}%</p>
            <div style={{ marginTop: 12 }}>
              <PerformanceBar score={data.personalScore} />
            </div>
          </div>
        </div>
        <div className="dashboard-mini-stats">
          <StatCard label="Assigned KPIs" value={data.assignedKPIs} />
          <StatCard label="Completed" value={data.completedKPIs} />
          <StatCard label="Overdue" value={data.overdueKPIs} />
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Due KPIs</h3>
          <Link href="/kpis" className="btn btn-secondary btn-sm">View all</Link>
        </div>
        <div className="card-body">
          {data.dueKPIs.length === 0 ? (
            <EmptyState title="Nothing due" text="You're all caught up — no pending or in-progress KPIs right now." />
         ) : (
            <div className="dashboard-kpi-grid">
              {data.dueKPIs.map((kpi: DueKPI) => (
                <Link key={kpi._id} href={`/kpis/${kpi._id}`} className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                  <div className="card-body">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                      <h5>{kpi.name}</h5>
                      <StatusBadge status={kpi.status} />
                    </div>
                    <p style={{ fontSize: "0.8125rem" }}>Target: {kpi.targetValue} · Due {formatDate(kpi.dueDate)}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-primary)", marginTop: 6, fontWeight: 600 }}>Click to submit progress →</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DepartmentDashboard({ data }: { data: DepartmentData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="dashboard-score-row">
        <div className="card">
          <div className="card-body">
            <p className="stat-label">Department Score</p>
            <p className="stat-value" style={{ fontSize: "2.75rem" }}>{data.departmentScore}%</p>
            <div style={{ marginTop: 12 }}>
              <PerformanceBar score={data.departmentScore} />
            </div>
          </div>
        </div>
        <div className="dashboard-mini-stats">
          <StatCard label="Team Members" value={data.totalMembers} />
          <StatCard label="Open KPIs" value={data.openKPIs} />
          <StatCard label="Missed" value={data.missedKPIs} />
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Team Performance</h3>
          <Link href="/employees" className="btn btn-secondary btn-sm">View all employees</Link>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {data.teamPerformance.length === 0 ? (
            <div style={{ padding: "20px 24px" }}>
              <EmptyState title="No team members yet" text="Once staff are added to your department, their performance will show up here." />
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Employee</th><th>Score</th><th>Completed</th><th>Total KPIs</th></tr>
              </thead>
              <tbody>
                {data.teamPerformance.map((member: TeamMember) => (
                  <tr key={member.employee.id}>
                    <td>{member.employee.name}</td>
                    <td>{member.score}%</td>
                    <td>{member.completedKPIs}</td>
                    <td>{member.totalKPIs}</td>
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

function ExecutiveDashboard({ data }: { data: ExecutiveData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="dashboard-stats-grid">
        <StatCard label="Company Score" value={`${data.companyScore}%`} />
        <StatCard label="Total Employees" value={data.totalEmployees} />
        <StatCard label="Active KPIs" value={data.activeKPIs} />
        <StatCard label="Overdue" value={data.overdueKPIs} />
      </div>

      <div className="dashboard-rate-row">
        <div className="card">
          <div className="card-body">
            <p className="stat-label">KPI Completion Rate</p>
            <p className="stat-value" style={{ marginBottom: 12 }}>{data.kpiCompletionRate}%</p>
            <PerformanceBar score={data.kpiCompletionRate} />
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="stat-label">Completed KPIs</p>
            <p className="stat-value">{data.completedKPIs}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-main-grid">
        <div className="card">
          <div className="card-header"><h3>Department Rankings</h3></div>
          <div className="card-body" style={{ padding: 0 }}>
            {data.departmentRankings.length === 0 ? (
              <div style={{ padding: "20px 24px" }}>
                <EmptyState title="No departments yet" text="Rankings will appear once departments have KPI activity." />
              </div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Department</th><th>Score</th><th>Completion</th></tr></thead>
                <tbody>
                  {data.departmentRankings.map((dept: DepartmentRanking) => (
                    <tr key={dept.department}>
                      <td>{dept.department}</td>
                      <td>{dept.score}%</td>
                      <td>{dept.completionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <div className="card-header"><h3>Top Performers</h3></div>
            <div className="card-body">
              {data.topPerformers.length === 0 ? (
                <EmptyState title="No data yet" text="Top performers show up once KPIs are approved." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.topPerformers.map((p: PerformerEntry) => (
                    <div key={p.employee.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                      <span>{p.employee.name} <span style={{ color: "var(--color-neutral-400)" }}>· {p.employee.department}</span></span>
                      <strong>{p.score}%</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Needs Attention</h3></div>
            <div className="card-body">
              {data.underperformers.length === 0 ? (
                <EmptyState title="Nobody flagged" text="Underperformers show up here once there's enough KPI history." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.underperformers.map((p: PerformerEntry) => (
                    <div key={p.employee.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                      <span>{p.employee.name} <span style={{ color: "var(--color-neutral-400)" }}>· {p.employee.department}</span></span>
                      <strong style={{ color: "var(--color-primary)" }}>{p.score}%</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}