"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/dashboard-data";
import { useAuth } from "@/components/auth-provider";
import { useProjects } from "@/hooks/use-projects";
import { useProjectProgress } from "@/hooks/use-project-progress";
import { useCompanyUsers } from "@/hooks/use-company-users";
import { canManageProject } from "@/lib/permissions";
import { MobileDashboardMenu, type DashboardMenuItem } from "@/components/mobile-dashboard-menu";
import { BoqUploadNotice } from "@/components/boq-upload-notice";
import { useBoqUploadEvents } from "@/hooks/use-boq-upload-events";
import { canWorkOnProject } from "@/lib/project-access";
import { useScheduleMilestones } from "@/hooks/use-schedule-milestones";

export default function Home() {
  const router = useRouter();
  const { user, isLoading, profile, isProfileLoading, signOutUser } = useAuth();
  const { projects, isLoading: areProjectsLoading } = useProjects(profile?.companyId);
  const { users: companyUsers, isLoading: areUsersLoading } = useCompanyUsers(profile?.companyId);
  const { progressByProject, activityByProject, variationsByProject } = useProjectProgress(profile?.companyId, projects);
  const { eventsByProject } = useBoqUploadEvents(profile?.companyId, projects);
  const { milestones } = useScheduleMilestones(profile?.companyId, projects);
  const firstProjectId = projects[0]?.id;
  const states = [...new Set(projects.map((project) => project.state))];
  const [selectedState, setSelectedState] = useState("All states");
  const [selectedStatus, setSelectedStatus] = useState("All statuses");
  const [projectSearch, setProjectSearch] = useState("");
  const [projectSort, setProjectSort] = useState("latest_activity");
  const visibleProjects = useMemo(
    () => projects.filter((project) => (selectedState === "All states" || project.state === selectedState) && (selectedStatus === "All statuses" || project.status === selectedStatus) && `${project.name} ${project.clientName} ${project.location} ${project.state}`.toLowerCase().includes(projectSearch.trim().toLowerCase())).sort((left, right) => {
      if (projectSort === "project_name") return left.name.localeCompare(right.name);
      if (projectSort === "progress_high") return (progressByProject[right.id]?.percentage ?? 0) - (progressByProject[left.id]?.percentage ?? 0);
      if (projectSort === "contract_value") return right.contractSum - left.contractSum;
      return String(activityByProject[right.id]?.latestReportDate ?? "").localeCompare(String(activityByProject[left.id]?.latestReportDate ?? ""));
    }),
    [activityByProject, progressByProject, projectSearch, projectSort, projects, selectedState, selectedStatus],
  );
  const totalExposure = visibleProjects.reduce((total, project) => total + (activityByProject[project.id]?.variationExposure ?? 0), 0);
  const progressProjects = visibleProjects.filter((project) => progressByProject[project.id]?.plannedValue);
  const averageProgress = progressProjects.length === 0 ? 0 : Math.round(progressProjects.reduce((total, project) => total + (progressByProject[project.id]?.percentage ?? 0), 0) / progressProjects.length);
  const reportsNeedingAttention = visibleProjects.filter((project) => {
    if (project.status !== "active") return false;
    const latestReportDate = activityByProject[project.id]?.latestReportDate;
    if (!latestReportDate) return true;
    const today = new Date();
    const reportDay = new Date(`${latestReportDate}T00:00:00`);
    const daysSinceReport = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(reportDay.getFullYear(), reportDay.getMonth(), reportDay.getDate())) / 86_400_000);
    return daysSinceReport >= 3;
  }).length;
  const scheduleAlerts = visibleProjects.filter((project) => {
    const progress = progressByProject[project.id];
    return progress?.plannedValue && progress.scheduleHealth !== "on_track";
  });
  const assignedProjects = profile?.role === "site_engineer" ? projects.filter((project) => project.siteEngineerId === user?.uid) : projects;
  const engineerMilestones = milestones.filter((milestone) => assignedProjects.some((project) => project.id === milestone.projectId) && milestone.status !== "complete").slice(0, 4);
  const variationQueue = projects.flatMap((project) => (variationsByProject[project.id] ?? []).filter((variation) => variation.status === "pending_qs_review" || variation.status === "pending_director_approval").map((variation) => ({ ...variation, projectName: project.name }))).filter((variation) => profile?.role !== "quantity_surveyor" || variation.status === "pending_qs_review");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/onboarding");
  }, [isLoading, isProfileLoading, profile, router, user]);

  if (isLoading || isProfileLoading || !user || !profile) return <main className="auth-loading">Checking your secure workspace…</main>;

  const dashboardMenuItems: DashboardMenuItem[] = profile.role === "director" ? [
    { href: "#portfolio", label: "Portfolio" }, { href: "#projects", label: "Projects" }, { href: "/updates", label: "Updates" }, { href: "/reports", label: "Daily reports" }, { href: "/issues", label: "Issues" }, { href: "/variations", label: "Variations", count: variationQueue.length }, { href: "/valuations", label: "Valuations" }, { href: "/schedule", label: "Schedule health" }, { href: "/team", label: "Team" }, { href: "/settings", label: "Company settings" },
  ] : profile.role === "project_manager" ? [
    { href: "#portfolio", label: "Portfolio" }, { href: "#projects", label: "Projects" }, { href: "/updates", label: "Updates" }, { href: "/reports", label: "Daily reports" }, { href: "/issues", label: "Issues" }, { href: "/variations", label: "Variations", count: variationQueue.length }, { href: "/schedule", label: "Schedule health" },
  ] : profile.role === "quantity_surveyor" ? [
    { href: "#projects", label: "Projects" }, { href: "/updates", label: "Updates" }, { href: "/variations", label: "Variations", count: variationQueue.length }, { href: "/valuations", label: "Valuations" },
  ] : [{ href: "#projects", label: "My assigned projects" }, { href: "/schedule", label: "Schedule" }, { href: "/updates", label: "Updates" }];
  const quickActions = profile.role === "director" ? [{ href: "/projects/new", label: "Add project" }, { href: "/team", label: "Manage team" }, { href: "/schedule", label: "View schedule" }] : profile.role === "project_manager" ? [{ href: "/reports", label: "Review reports" }, { href: "/issues", label: "View issues" }, { href: "/schedule", label: "View schedule" }] : profile.role === "quantity_surveyor" ? [{ href: "#projects", label: "Open projects" }, { href: "/variations", label: "Review variations" }, { href: "/valuations", label: "View valuations" }] : [{ href: "#projects", label: "My projects" }, { href: "/schedule", label: "View schedule" }, { href: "/updates", label: "Workspace updates" }];
  const attentionActions = [{ label: "Reports overdue", count: reportsNeedingAttention, detail: "Active projects with no report in 3+ days", href: "/reports", tone: "reports" }, { label: "Schedule risk", count: scheduleAlerts.length, detail: "Projects behind their expected progress", href: "/schedule", tone: "schedule" }, { label: "Variation decisions", count: variationQueue.length, detail: "Changes waiting for your role", href: "/variations", tone: "variations" }].filter((item) => item.count > 0);

  if (profile.role === "site_engineer") return <main className="engineer-home"><div className="engineer-content"><div className="engineer-top"><div><p className="eyebrow">Site engineer workspace</p><h1>Today&apos;s site work</h1><p>Submit completed quantities and raise changes while the work is fresh.</p></div><MobileDashboardMenu items={dashboardMenuItems} name={profile.name} role={profile.role} companyName={profile.companyName} onSignOut={() => void signOutUser()} /><button className="sign-out engineer-sign-out" type="button" onClick={() => void signOutUser()}>Sign out</button></div><BoqUploadNotice eventsByProject={eventsByProject} projects={projects} canAccessProject={(project) => canWorkOnProject(profile.role, user.uid, project)} />{engineerMilestones.length > 0 && <section className="engineer-milestones"><div><p className="eyebrow">Programme ahead</p><h2>Next milestones due</h2></div>{engineerMilestones.map((milestone) => <Link href={`/projects/${milestone.projectId}/schedule`} key={milestone.id}><strong>{milestone.title}</strong><span>{milestone.projectName} · Due {new Date(`${milestone.plannedDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} · {milestone.progress}% complete</span></Link>)}</section>}<section className="engineer-projects" id="projects">{areProjectsLoading && <p className="boq-empty">Loading your assigned projects…</p>}{!areProjectsLoading && assignedProjects.length === 0 && <p className="boq-empty">No projects have been assigned to you yet. Your Project Manager will allocate your site here.</p>}{assignedProjects.map((project) => <article className="engineer-project-card" key={project.id}><div><span>{project.status.replace("_", " ")}</span><h2>{project.name}</h2><p>{project.location}, {project.state}</p></div><div><Link className="primary-action" href={`/projects/${project.id}/reports/new`}>Submit today&apos;s report</Link><Link className="secondary compact-action" href={`/projects/${project.id}/variations/new`}>Raise variation</Link><Link className="text-action" href={`/projects/${project.id}`}>View BOQ reference</Link></div></article>)}</section></div></main>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="BuildCore home">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span className="brand-word">Build<span>Core</span><small>Engineering</small></span>
        </a>
        <nav aria-label="Main navigation">
          {dashboardMenuItems.map((item, index) => item.href.startsWith("#") ? <a className={`nav-link ${index === 0 ? "active" : ""}`} href={item.href} key={item.href}>{item.label} {item.count ? <span className="count">{item.count}</span> : null}</a> : <Link className="nav-link" href={item.href} key={item.href}>{item.label} {item.count ? <span className="count">{item.count}</span> : null}</Link>)}
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
          <div className="profile"><span className="avatar">{profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span className="role-label">Role: {profile.role.replace("_", " ")}</span><button className="sign-out" type="button" onClick={() => void signOutUser()}>Sign out</button></div><MobileDashboardMenu items={dashboardMenuItems} name={profile.name} role={profile.role} companyName={profile.companyName} onSignOut={() => void signOutUser()} />
        </header>

        <section className="role-banner"><div><p className="eyebrow">Signed-in workspace</p><h2>{profile.role.replaceAll("_", " ")}</h2><p>{profile.role === "director" ? "Portfolio oversight, team governance, final approvals, and company control." : profile.role === "project_manager" ? "Project delivery, issues, project updates, and variation decisions." : "Your access is tailored to your assigned project responsibilities."}</p></div><span>{profile.companyName}</span></section>
        <BoqUploadNotice eventsByProject={eventsByProject} projects={projects} canAccessProject={(project) => canWorkOnProject(profile.role, user.uid, project)} />
        {attentionActions.length > 0 && <section className="attention-actions" aria-label="Items needing attention"><div className="attention-actions-heading"><p className="eyebrow">Needs attention</p><h2>Act before these items become bigger issues</h2></div><div className="attention-action-grid">{attentionActions.map((item) => <Link className={`attention-action-card ${item.tone}`} href={item.href} key={item.label}><strong>{item.count}</strong><div><h3>{item.label}</h3><p>{item.detail}</p></div><span>Review →</span></Link>)}</div></section>}
        <section className="quick-actions" aria-label="Quick actions"><div><p className="eyebrow">Quick actions</p><h2>Start here</h2></div><div>{quickActions.map((action) => action.href.startsWith("#") ? <a href={action.href} key={action.href}>{action.label}</a> : <Link href={action.href} key={action.href}>{action.label}</Link>)}</div></section>

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
            <p>Reports needing attention</p><strong>{reportsNeedingAttention}</strong><span>Active projects with no report in 3+ days</span>
          </article>
        </section>

        {scheduleAlerts.length > 0 && <section className="schedule-alert-card"><div><p className="eyebrow">Programme attention</p><h2>{scheduleAlerts.length} project{scheduleAlerts.length === 1 ? "" : "s"} need schedule attention</h2><p>Actual BOQ progress is behind the expected programme position.</p></div><div className="schedule-alert-links">{scheduleAlerts.slice(0, 3).map((project) => <Link key={project.id} className="text-action" href={`/projects/${project.id}`}>{project.name} · {progressByProject[project.id]?.scheduleHealth.replace("_", " ")}</Link>)}<Link className="secondary compact-action" href="/schedule">View schedule health</Link></div></section>}

        <section className="section-heading" id="portfolio">
          <div><p className="eyebrow">Live portfolio</p><h2>Projects at a glance</h2></div>
          <div className="portfolio-actions">
            <label className="state-filter project-search"><span>Find project</span><input value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="Name, client, state…" /></label>
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
            <label className="state-filter">
              <span>Sort projects</span>
              <select value={projectSort} onChange={(event) => setProjectSort(event.target.value)}>
                <option value="latest_activity">Latest site activity</option><option value="progress_high">Highest progress</option><option value="contract_value">Highest contract value</option><option value="project_name">Project name</option>
              </select>
            </label>
            {canManageProject(profile.role) && <Link className="primary-action" href="/projects/new">+ Add project</Link>}
          </div>
        </section>

        <section className="project-table" id="projects" aria-label="Active projects">
          <div className="project-table-head"><span>Project</span><span>Status</span><span>BOQ</span><span>Progress</span><span>Schedule</span><span>Variation exposure</span><span>Latest report</span></div>
          {areProjectsLoading && <p className="empty-state">Loading your projects…</p>}
          {!areProjectsLoading && visibleProjects.length === 0 && <div className="guided-empty-state"><span>01</span><div><p className="eyebrow">Set up your workspace</p><h3>{projects.length === 0 ? "Create your first project" : "No projects match these filters"}</h3><p>{projects.length === 0 ? "Add a project, import its BOQ, then invite your team to start reporting progress." : "Clear a filter or search term to view more projects."}</p>{projects.length === 0 && canManageProject(profile.role) && <Link className="primary-action" href="/projects/new">Add first project</Link>}</div></div>}
          {visibleProjects.map((project) => {
            const progress = Math.round(progressByProject[project.id]?.percentage ?? 0);
            const scheduleHealth = progressByProject[project.id]?.scheduleHealth ?? "on_track";
            const activity = activityByProject[project.id];
            const isBoqReady = Boolean(progressByProject[project.id]?.plannedValue);
            return <article className="project-row" key={project.id}>
              <div><Link className="project-name-link" href={`/projects/${project.id}`}><h3>{project.name}</h3></Link><p>{project.clientName} · {project.state}</p></div>
              <span className={`project-status ${project.status}`}>{project.status.replaceAll("_", " ")}</span>
              <span className={`boq-readiness ${isBoqReady ? "ready" : "setup"}`}>{isBoqReady ? "BOQ ready" : "Setup needed"}</span>
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
              const allocationCount = projects.filter((project) => project.siteEngineerId === member.id || project.projectManagerId === member.id).length;
              const isEngineer = member.role === "site_engineer";
              const isManager = member.role === "project_manager";
              return <article className="team-member" key={member.id}><div className="team-member-avatar">{member.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div className="team-member-details"><h3>{member.name}</h3><p>{member.email}</p></div><span className="team-role">{member.role.replaceAll("_", " ")}</span><div className="team-allocation">{isEngineer || isManager ? <><strong>{allocationCount}</strong><span>{isManager ? "managed project" : "assigned project"}{allocationCount === 1 ? "" : "s"}</span></> : <span>{member.role === "quantity_surveyor" ? "Controls BOQ and valuations" : "Portfolio oversight"}</span>}</div></article>;
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
