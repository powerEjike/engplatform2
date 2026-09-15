"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/dashboard-data";
import { useAuth } from "@/components/auth-provider";
import { useProjects } from "@/hooks/use-projects";
import { useProjectProgress } from "@/hooks/use-project-progress";
import { useCompanyUsers } from "@/hooks/use-company-users";

export default function Home() {
  const router = useRouter();
  const { user, isLoading, profile, isProfileLoading, signOutUser } = useAuth();
  const { projects, isLoading: areProjectsLoading } = useProjects(profile?.companyId);
  const { users: companyUsers, isLoading: areUsersLoading } = useCompanyUsers(profile?.companyId);
  const { progressByProject, activityByProject, variationsByProject } = useProjectProgress(profile?.companyId, projects);
  const firstProjectId = projects[0]?.id;
  const states = [...new Set(projects.map((project) => project.state))];
  const [selectedState, setSelectedState] = useState("All states");
  const [selectedStatus, setSelectedStatus] = useState("All statuses");
  const visibleProjects = useMemo(
    () => projects.filter((project) => (selectedState === "All states" || project.state === selectedState) && (selectedStatus === "All statuses" || project.status === selectedStatus)),
    [projects, selectedState, selectedStatus],
  );
  const totalExposure = visibleProjects.reduce((total, project) => total + (activityByProject[project.id]?.variationExposure ?? 0), 0);
  const progressProjects = visibleProjects.filter((project) => progressByProject[project.id]?.plannedValue);
  const averageProgress = progressProjects.length === 0 ? 0 : Math.round(progressProjects.reduce((total, project) => total + (progressByProject[project.id]?.percentage ?? 0), 0) / progressProjects.length);
  const reportsNeedingAttention = visibleProjects.filter((project) => !activityByProject[project.id]?.latestReportDate).length;
  const scheduleAlerts = visibleProjects.filter((project) => {
    const progress = progressByProject[project.id];
    return progress?.plannedValue && progress.scheduleHealth !== "on_track";
  });
  const assignedProjects = profile?.role === "site_engineer" ? projects.filter((project) => project.siteEngineerId === user?.uid) : projects;
  const variationQueue = projects.flatMap((project) => (variationsByProject[project.id] ?? []).filter((variation) => variation.status === "pending_qs_review" || variation.status === "pending_director_approval").map((variation) => ({ ...variation, projectName: project.name }))).filter((variation) => profile?.role !== "quantity_surveyor" || variation.status === "pending_qs_review");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/onboarding");
  }, [isLoading, isProfileLoading, profile, router, user]);

  if (isLoading || isProfileLoading || !user || !profile) return <main className="auth-loading">Checking your secure workspace…</main>;

  if (profile.role === "site_engineer") return <main className="engineer-home"><div className="engineer-content"><div className="engineer-top"><div><p className="eyebrow">Site engineer workspace</p><h1>Today&apos;s site work</h1><p>Submit completed quantities and raise changes while the work is fresh.</p></div><button className="sign-out" type="button" onClick={() => void signOutUser()}>Sign out</button></div><section className="engineer-projects">{areProjectsLoading && <p className="boq-empty">Loading your assigned projects…</p>}{!areProjectsLoading && assignedProjects.length === 0 && <p className="boq-empty">No projects have been assigned to you yet. Your Project Manager will allocate your site here.</p>}{assignedProjects.map((project) => <article className="engineer-project-card" key={project.id}><div><span>{project.status.replace("_", " ")}</span><h2>{project.name}</h2><p>{project.location}, {project.state}</p></div><div><Link className="primary-action" href={`/projects/${project.id}/reports/new`}>Submit today&apos;s report</Link><Link className="secondary compact-action" href={`/projects/${project.id}/variations/new`}>Raise variation</Link><Link className="text-action" href={`/projects/${project.id}`}>View BOQ reference</Link></div></article>)}</section></div></main>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="engplatform2 home">
          <span className="brand-mark">e</span>
          <span>engplatform<span>2</span></span>
        </a>
        <nav aria-label="Main navigation">
          <a className="nav-link active" href="#portfolio">Portfolio</a>
          <a className="nav-link" href="#projects">Projects</a>
          <Link className="nav-link" href="/reports">Daily reports</Link>
          <a className="nav-link" href="#variations">Variations {variationQueue.length > 0 && <span className="count">{variationQueue.length}</span>}</a>
          <Link className="nav-link" href="/valuations">Valuations</Link>
          <Link className="nav-link" href="/schedule">Schedule health</Link>
          <Link className="nav-link" href="/team">Team</Link>
        </nav>
        <div className="sidebar-footer">
          <p className="firm-name">{profile.companyName}</p>
          {profile.role === "director" ? <Link className="settings-link" href="/settings">Company settings</Link> : <span className="settings-link">{profile.role.replaceAll("_", " ")} workspace</span>}
        </div>
      </aside>

      <main id="top">
        <header className="topbar">
          <div>
            <p className="eyebrow">Portfolio overview</p>
            <h1>Good morning, {profile.name.split(" ")[0]}.</h1>
          </div>
          <div className="profile"><span className="avatar">{profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span className="role-label">Role: {profile.role.replace("_", " ")}</span><button className="sign-out" type="button" onClick={() => void signOutUser()}>Sign out</button></div>
        </header>

        <section className="role-banner"><div><p className="eyebrow">Signed-in workspace</p><h2>{profile.role.replaceAll("_", " ")}</h2><p>{profile.role === "director" ? "Portfolio oversight, team governance, final approvals, and company control." : profile.role === "project_manager" ? "Project delivery, issues, project updates, and variation decisions." : "Your access is tailored to your assigned project responsibilities."}</p></div><span>{profile.companyName}</span></section>

        <section className="summary-grid" aria-label="Portfolio summary">
          <article className="metric-card">
            <p>Active projects</p><strong>{visibleProjects.length}</strong><span>{selectedState === "All states" ? "Across all states" : `In ${selectedState}`}</span>
          </article>
          <article className="metric-card">
            <p>Portfolio progress</p><strong>{averageProgress}%</strong><span>{progressProjects.length === 0 ? "Available after BOQ setup" : "From completed BOQ value"}</span>
          </article>
          <article className="metric-card highlight">
            <p>Variation exposure</p><strong>{formatNaira(totalExposure)}</strong><span>Available after variations are raised</span>
          </article>
          <article className="metric-card warning">
            <p>Reports needing attention</p><strong>{reportsNeedingAttention}</strong><span>Projects with no site report yet</span>
          </article>
        </section>

        {scheduleAlerts.length > 0 && <section className="schedule-alert-card"><div><p className="eyebrow">Programme attention</p><h2>{scheduleAlerts.length} project{scheduleAlerts.length === 1 ? "" : "s"} need schedule attention</h2><p>Actual BOQ progress is behind the expected programme position.</p></div><div className="schedule-alert-links">{scheduleAlerts.slice(0, 3).map((project) => <Link key={project.id} className="text-action" href={`/projects/${project.id}`}>{project.name} · {progressByProject[project.id]?.scheduleHealth.replace("_", " ")}</Link>)}<Link className="secondary compact-action" href="/schedule">View schedule health</Link></div></section>}

        <section className="section-heading" id="portfolio">
          <div><p className="eyebrow">Live portfolio</p><h2>Projects at a glance</h2></div>
          <div className="portfolio-actions">
            <label className="state-filter">
              <span>Project state</span>
              <select value={selectedState} onChange={(event) => setSelectedState(event.target.value)}>
                <option>All states</option>
                {states.map((state) => <option key={state}>{state}</option>)}
              </select>
            </label>
            <label className="state-filter">
              <span>Project status</span>
              <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
                <option>All statuses</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option>
              </select>
            </label>
            <Link className="primary-action" href="/projects/new">+ Add project</Link>
          </div>
        </section>

        <section className="project-table" id="projects" aria-label="Active projects">
          <div className="project-table-head"><span>Project</span><span>Progress</span><span>Schedule</span><span>Variation exposure</span><span>Latest report</span></div>
          {areProjectsLoading && <p className="empty-state">Loading your projects…</p>}
          {!areProjectsLoading && visibleProjects.length === 0 && <p className="empty-state">No projects yet. Add your first project to begin.</p>}
          {visibleProjects.map((project) => {
            const progress = Math.round(progressByProject[project.id]?.percentage ?? 0);
            const scheduleHealth = progressByProject[project.id]?.scheduleHealth ?? "on_track";
            const activity = activityByProject[project.id];
            return <article className="project-row" key={project.id}>
              <div><Link className="project-name-link" href={`/projects/${project.id}`}><h3>{project.name}</h3></Link><p>{project.clientName} · {project.state}</p></div>
              <div className="progress-cell"><div className="progress-label"><span>{progress}%</span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>
              <span className={`status ${scheduleHealth}`}>{progressByProject[project.id]?.plannedValue ? scheduleHealth.replace("_", " ") : "Setup"}</span>
              <strong className="exposure">{formatNaira(activity?.variationExposure ?? 0)}</strong>
              <span className="report-date">{activity?.latestReportDate ? new Date(`${activity.latestReportDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "No reports yet"}</span>
            </article>;
          })}
        </section>

        <section className="variation-queue" id="variations"><div className="section-heading"><div><p className="eyebrow">Decision queue</p><h2>Variations awaiting action</h2></div><span className="team-total">{variationQueue.length} open item{variationQueue.length === 1 ? "" : "s"}</span></div><div className="variation-queue-list">{variationQueue.length === 0 ? <p className="empty-state">No variations are waiting for your role right now.</p> : variationQueue.map((variation) => <article className="variation-queue-row" key={`${variation.projectId}-${variation.id}`}><div><span className={`variation-status ${variation.status}`}>{variation.status.replaceAll("_", " ")}</span><h3>{variation.description}</h3><p>{variation.projectName}</p></div><strong>{formatNaira(variation.estimatedValue)}</strong><Link className="text-action" href={`/projects/${variation.projectId}`}>Review</Link></article>)}</div></section>

        <section className="team-section" id="team">
          <div className="section-heading"><div><p className="eyebrow">Workspace team</p><h2>Roles and project allocations</h2></div><div className="team-heading-actions"><span className="team-total">{companyUsers.length} member{companyUsers.length === 1 ? "" : "s"}</span>{profile.role === "director" && <Link className="text-action" href="/team">Manage team</Link>}</div></div>
          <div className="team-list">
            {areUsersLoading && <p className="empty-state">Loading workspace team…</p>}
            {!areUsersLoading && companyUsers.length === 0 && <p className="empty-state">No team members have been added yet.</p>}
            {companyUsers.map((member) => {
              const allocationCount = projects.filter((project) => project.siteEngineerId === member.id).length;
              const isEngineer = member.role === "site_engineer";
              return <article className="team-member" key={member.id}><div className="team-member-avatar">{member.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div className="team-member-details"><h3>{member.name}</h3><p>{member.email}</p></div><span className="team-role">{member.role.replaceAll("_", " ")}</span><div className="team-allocation">{isEngineer ? <><strong>{allocationCount}</strong><span>assigned project{allocationCount === 1 ? "" : "s"}</span></> : <span>{member.role === "project_manager" ? "Manages project delivery" : member.role === "quantity_surveyor" ? "Controls BOQ and valuations" : "Portfolio oversight"}</span>}</div></article>;
            })}
          </div>
        </section>

        <section className="attention-card" id="variations">
          <div>
            <p className="eyebrow">Your attention</p>
            <h2>{projects.length === 0 ? "Create your first project" : "Set up your project BOQ next"}</h2>
            <p>{projects.length === 0 ? "Add a project to begin tracking work, reports, variations, and valuations." : "Import BOQ items so the platform can calculate real progress."}</p>
          </div>
          <Link className="secondary" href={firstProjectId ? `/projects/${firstProjectId}` : "/projects/new"}>{firstProjectId ? "Set up BOQ" : "Add project"}</Link>
        </section>
      </main>
    </div>
  );
}
