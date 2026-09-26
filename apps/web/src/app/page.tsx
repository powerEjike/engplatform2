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
import { useProjectActions } from "@/hooks/use-project-actions";

export function DashboardHome() {
  const router = useRouter();
  const { user, isLoading, profile, isProfileLoading, signOutUser } = useAuth();
  const { projects, isLoading: areProjectsLoading } = useProjects(profile?.companyId, profile?.role, user?.uid);
  const { users: companyUsers, isLoading: areUsersLoading } = useCompanyUsers(profile?.companyId);
  const { progressByProject, activityByProject, variationsByProject } = useProjectProgress(profile?.companyId, projects);
  const { eventsByProject } = useBoqUploadEvents(profile?.companyId, projects);
  const { milestones } = useScheduleMilestones(profile?.companyId, projects);
  const { actions: projectActions } = useProjectActions(profile?.companyId, projects);
  const firstProjectId = projects[0]?.id;
  const [projectSavedOffline, setProjectSavedOffline] = useState(false);
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
  const activeVisibleProjects = visibleProjects.filter((project) => project.status === "active");
  const projectsReportingCurrent = Math.max(0, activeVisibleProjects.length - reportsNeedingAttention);
  const reportingCoverage = activeVisibleProjects.length === 0 ? 0 : Math.round((projectsReportingCurrent / activeVisibleProjects.length) * 100);
  const portfolioContractValue = visibleProjects.reduce((total, project) => total + project.contractSum, 0);
  const completedBoqValue = visibleProjects.reduce((total, project) => total + (progressByProject[project.id]?.completedValue ?? 0), 0);
  const commercialMaxValue = Math.max(portfolioContractValue, completedBoqValue, totalExposure, 1);
  const costCompletion = portfolioContractValue === 0 ? 0 : Math.min(100, Math.round((completedBoqValue / portfolioContractValue) * 100));
  const deliveryChartProjects = [...visibleProjects].sort((left, right) => (progressByProject[right.id]?.percentage ?? 0) - (progressByProject[left.id]?.percentage ?? 0)).slice(0, 5);
  const scheduleAlerts = visibleProjects.filter((project) => {
    const progress = progressByProject[project.id];
    return progress?.plannedValue && progress.scheduleHealth !== "on_track";
  });
  const assignedProjects = profile?.role === "site_engineer" ? projects.filter((project) => project.siteEngineerId === user?.uid) : projects;
  const firstAssignedProjectId = assignedProjects[0]?.id;
  const engineerMilestones = milestones.filter((milestone) => assignedProjects.some((project) => project.id === milestone.projectId) && milestone.status !== "complete").slice(0, 4);
  const variationQueue = projects.flatMap((project) => (variationsByProject[project.id] ?? []).filter((variation) => variation.status === "pending_qs_review" || variation.status === "pending_director_approval").map((variation) => ({ ...variation, projectName: project.name }))).filter((variation) => profile?.role !== "quantity_surveyor" || variation.status === "pending_qs_review");
  const myOpenActions = projectActions.filter((action) => action.status === "open" && action.assignedTo === user?.uid);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/access");
  }, [isLoading, isProfileLoading, profile, router, user]);

  useEffect(() => {
    const noticeTimer = window.setTimeout(() => {
      setProjectSavedOffline(new URLSearchParams(window.location.search).get("projectSavedOffline") === "1");
    }, 0);
    return () => window.clearTimeout(noticeTimer);
  }, []);

  if (isLoading || isProfileLoading || !user || !profile) return <main className="auth-loading">Checking your secure workspace…</main>;

  const dashboardMenuItems: DashboardMenuItem[] = profile.role === "director" ? [
    { href: "#portfolio", label: "Portfolio" }, { href: "#projects", label: "Projects" }, { href: "/updates", label: "Updates" }, { href: "/chat", label: "Team chat" }, { href: "/reports", label: "Daily reports" }, { href: "/issues", label: "Issues" }, { href: "/variations", label: "Variations", count: variationQueue.length }, { href: "/valuations", label: "Valuations" }, { href: "/schedule", label: "Schedule health" }, { href: "/team", label: "Team" }, { href: "/settings", label: "Company settings" },
  ] : profile.role === "project_manager" ? [
    { href: "#portfolio", label: "Portfolio" }, { href: "#projects", label: "Projects" }, { href: "/updates", label: "Updates" }, { href: "/chat", label: "Team chat" }, { href: "/reports", label: "Daily reports" }, { href: "/issues", label: "Issues" }, { href: "/variations", label: "Variations", count: variationQueue.length }, { href: "/schedule", label: "Schedule health" },
  ] : profile.role === "quantity_surveyor" ? [
    { href: "#projects", label: "Projects" }, { href: "/updates", label: "Updates" }, { href: "/chat", label: "Team chat" }, { href: "/variations", label: "Variations", count: variationQueue.length }, { href: "/valuations", label: "Valuations" },
  ] : [{ href: "#projects", label: "My assigned projects" }, { href: "/chat", label: "Team chat" }, { href: "/schedule", label: "Schedule" }, { href: "/updates", label: "Updates" }];
  const quickActions = profile.role === "director" ? [{ href: "/projects/new", label: "Add project" }, { href: "/team", label: "Manage team" }, { href: "/schedule", label: "View schedule" }] : profile.role === "project_manager" ? [{ href: "/reports", label: "Review reports" }, { href: "/issues", label: "View issues" }, { href: "/schedule", label: "View schedule" }] : profile.role === "quantity_surveyor" ? [{ href: "#projects", label: "Open projects" }, { href: "/variations", label: "Review variations" }, { href: "/valuations", label: "View valuations" }] : [{ href: "#projects", label: "My projects" }, { href: "/schedule", label: "View schedule" }, { href: "/updates", label: "Workspace updates" }];
  const attentionActions = [{ label: "Reports overdue", count: reportsNeedingAttention, detail: "Active projects with no report in 3+ days", href: "/reports", tone: "reports" }, { label: "Schedule risk", count: scheduleAlerts.length, detail: "Projects behind their expected progress", href: "/schedule", tone: "schedule" }, { label: "Variation decisions", count: variationQueue.length, detail: "Changes waiting for your role", href: "/variations", tone: "variations" }, { label: "My assigned actions", count: myOpenActions.length, detail: "Follow-up work assigned to you", href: myOpenActions[0] ? `/projects/${myOpenActions[0].projectId}` : "#projects", tone: "actions" }].filter((item) => item.count > 0);

  if (profile.role === "site_engineer") return <main className="engineer-home"><div className="engineer-content"><div className="engineer-top"><div><p className="eyebrow">Site engineer workspace</p><h1>Today&apos;s site work</h1><p>Submit completed quantities and raise changes while the work is fresh.</p></div><div className="engineer-top-actions"><Link className="dashboard-notifications" href="/updates" aria-label="View workspace updates"><span aria-hidden="true">🔔</span><b>Updates</b>{engineerMilestones.length > 0 && <em>{Math.min(engineerMilestones.length, 9)}</em>}</Link><MobileDashboardMenu items={dashboardMenuItems} name={profile.name} role={profile.role} companyName={profile.companyName} onSignOut={() => void signOutUser()} /><button className="sign-out engineer-sign-out" type="button" onClick={() => void signOutUser()}>Sign out</button></div></div>{projectSavedOffline && <p className="offline-save-notice">Project saved on this device. It will sync automatically when you are online.</p>}<BoqUploadNotice eventsByProject={eventsByProject} projects={projects} canAccessProject={(project) => canWorkOnProject(profile.role, user.uid, project)} />{engineerMilestones.length > 0 && <section className="engineer-milestones"><div><p className="eyebrow">Programme ahead</p><h2>Next milestones due</h2></div>{engineerMilestones.map((milestone) => <Link href={`/projects/${milestone.projectId}/schedule`} key={milestone.id}><strong>{milestone.title}</strong><span>{milestone.projectName} · Due {new Date(`${milestone.plannedDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} · {milestone.progress}% complete</span></Link>)}</section>}<section className="engineer-projects" id="projects">{areProjectsLoading && <p className="boq-empty">Loading your assigned projects…</p>}{!areProjectsLoading && assignedProjects.length === 0 && <p className="boq-empty">No projects have been assigned to you yet. Your Project Manager will allocate your site here.</p>}{assignedProjects.map((project) => { const progress = Math.round(progressByProject[project.id]?.percentage ?? 0); const reportDate = activityByProject[project.id]?.latestReportDate; return <article className="engineer-project-card" key={project.id}><div className="engineer-project-card-main"><div><span>{project.status.replace("_", " ")}</span><h2>{project.name}</h2><p>{project.location}, {project.state}</p></div><div className="engineer-project-progress"><div><strong>{progress}%</strong><span>BOQ progress</span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><small>{reportDate ? `Last report: ${new Date(`${reportDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}` : "No daily report yet"}</small></div></div><div><Link className="primary-action" href={`/projects/${project.id}/reports/new`}>Submit today&apos;s report</Link><Link className="secondary compact-action" href={`/projects/${project.id}/variations/new`}>Raise variation</Link><Link className="text-action" href={`/projects/${project.id}`}>View project details</Link></div></article>; })}</section></div><nav className="engineer-mobile-nav" aria-label="Site engineer navigation"><a href="#top">Home</a><Link href="/reports">Reports</Link><Link className="engineer-mobile-primary" href={firstAssignedProjectId ? `/projects/${firstAssignedProjectId}/reports/new` : "#projects"} aria-label="Submit daily report">+</Link><Link href={firstAssignedProjectId ? `/projects/${firstAssignedProjectId}` : "#projects"}>BOQ</Link><Link href="/chat">Chat</Link></nav></main>;

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
          <div className="profile"><Link className="dashboard-notifications" href="/updates" aria-label={`View workspace updates${attentionActions.length ? `, ${attentionActions.length} item${attentionActions.length === 1 ? "" : "s"} need attention` : ""}`}><span aria-hidden="true">🔔</span><b>Updates</b>{attentionActions.length > 0 && <em>{Math.min(attentionActions.length, 9)}</em>}</Link><span className="avatar">{profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span className="role-label">Role: {profile.role.replace("_", " ")}</span><button className="sign-out" type="button" onClick={() => void signOutUser()}>Sign out</button></div><MobileDashboardMenu items={dashboardMenuItems} name={profile.name} role={profile.role} companyName={profile.companyName} onSignOut={() => void signOutUser()} />
        </header>

        <section className="role-banner"><div><p className="eyebrow">Signed-in workspace</p><h2>{profile.role.replaceAll("_", " ")}</h2><p>{profile.role === "director" ? "Portfolio oversight, team governance, final approvals, and company control." : profile.role === "project_manager" ? "Project delivery, issues, project updates, and variation decisions." : "Your access is tailored to your assigned project responsibilities."}</p></div><span>{profile.companyName}</span></section>
        {projectSavedOffline && <p className="offline-save-notice">Project saved on this device. It will sync automatically when you are online.</p>}
        <BoqUploadNotice eventsByProject={eventsByProject} projects={projects} canAccessProject={(project) => canWorkOnProject(profile.role, user.uid, project)} />
        {attentionActions.length > 0 && <section className="attention-actions" aria-label="Items needing attention"><div className="attention-actions-heading"><p className="eyebrow">Needs attention</p><h2>Act before these items become bigger issues</h2></div><div className="attention-action-grid">{attentionActions.map((item) => <Link className={`attention-action-card ${item.tone}`} href={item.href} key={item.label}><strong>{item.count}</strong><div><h3>{item.label}</h3><p>{item.detail}</p></div><span>Review →</span></Link>)}</div></section>}
        {profile.role === "project_manager" && <section className="schedule-alert-card"><div><p className="eyebrow">Project Manager queue</p><h2>{myOpenActions.length} assigned action{myOpenActions.length === 1 ? "" : "s"}</h2><p>Complete assigned delivery actions directly from the relevant project workspace.</p></div><div className="schedule-alert-links">{myOpenActions.slice(0, 3).map((action) => <Link key={action.id} className="text-action" href={`/projects/${action.projectId}`}>{action.projectName} · {action.title}</Link>)}</div></section>}
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

        <section className="dashboard-insights" aria-label="Portfolio charts and delivery signals">
          <article className="dashboard-chart dashboard-progress-chart">
            <div className="dashboard-chart-heading"><div><p className="eyebrow">Delivery progress</p><h2>BOQ completion by project</h2></div><span>{averageProgress}% average</span></div>
            {deliveryChartProjects.length === 0 ? <p className="dashboard-chart-empty">Add a project and its BOQ to see delivery progress here.</p> : <div className="progress-chart-list">{deliveryChartProjects.map((project) => { const progress = Math.round(progressByProject[project.id]?.percentage ?? 0); return <Link href={`/projects/${project.id}`} key={project.id}><div><strong>{project.name}</strong><span>{progressByProject[project.id]?.plannedValue ? "BOQ progress" : "BOQ not set up"}</span></div><div className="chart-track" aria-label={`${project.name}: ${progress}% complete`}><i style={{ width: `${progress}%` }} /></div><b>{progress}%</b></Link>; })}</div>}
            <Link className="chart-footer-link" href="#projects">View projects →</Link>
          </article>

          <article className="dashboard-chart dashboard-cost-chart">
            <div className="dashboard-chart-heading"><div><p className="eyebrow">Commercial position</p><h2>Portfolio cost position</h2></div><Link href="/valuations">Valuations →</Link></div>
            <div className="cost-chart-main"><div className="cost-ring" style={{ background: `conic-gradient(#0f766e ${costCompletion}%, #dbeafe ${costCompletion}% 100%)` }}><div><strong>{costCompletion}%</strong><span>BOQ value</span></div></div><div><strong>{formatNaira(completedBoqValue)}</strong><p>completed BOQ value recorded</p></div></div>
            <div className="cost-chart-bars"><div><span>Contract sum</span><i><b style={{ width: `${portfolioContractValue / commercialMaxValue * 100}%` }} /></i><strong>{formatNaira(portfolioContractValue)}</strong></div><div><span>BOQ complete</span><i><b style={{ width: `${completedBoqValue / commercialMaxValue * 100}%` }} /></i><strong>{formatNaira(completedBoqValue)}</strong></div><div><span>Variation exposure</span><i><b style={{ width: `${totalExposure / commercialMaxValue * 100}%` }} /></i><strong>{formatNaira(totalExposure)}</strong></div></div>
          </article>

          <article className="dashboard-chart dashboard-report-chart">
            <div className="dashboard-chart-heading"><div><p className="eyebrow">Reporting status</p><h2>Site reporting coverage</h2></div><Link href="/reports">Daily reports →</Link></div>
            <div className="reporting-score"><strong>{reportingCoverage}%</strong><span>of active projects are reporting within the last 3 days</span></div>
            <div className="reporting-bar" aria-label={`${reportingCoverage}% reporting coverage`}><i style={{ width: `${reportingCoverage}%` }} /></div>
            <div className="reporting-breakdown"><div><strong>{projectsReportingCurrent}</strong><span>Reporting current</span></div><div><strong>{reportsNeedingAttention}</strong><span>Need follow-up</span></div><div><strong>{activeVisibleProjects.length}</strong><span>Active projects</span></div></div>
            <p className="chart-note">A project needs attention when no daily report has been received for three or more days.</p>
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
          <div className="project-table-head"><span>Project</span><span>Delivery</span><span>BOQ &amp; schedule</span><span>Commercial</span><span>Latest activity</span></div>
          {areProjectsLoading && <p className="empty-state">Loading your projects…</p>}
          {!areProjectsLoading && visibleProjects.length === 0 && <div className="guided-empty-state"><span>01</span><div><p className="eyebrow">Set up your workspace</p><h3>{projects.length === 0 ? "Create your first project" : "No projects match these filters"}</h3><p>{projects.length === 0 ? "Add a project, import its BOQ, then invite your team to start reporting progress." : "Clear a filter or search term to view more projects."}</p>{projects.length === 0 && canManageProject(profile.role) && <Link className="primary-action" href="/projects/new">Add first project</Link>}</div></div>}
          {visibleProjects.map((project) => {
            const progress = Math.round(progressByProject[project.id]?.percentage ?? 0);
            const scheduleHealth = progressByProject[project.id]?.scheduleHealth ?? "on_track";
            const activity = activityByProject[project.id];
            const isBoqReady = Boolean(progressByProject[project.id]?.plannedValue);
            return <article className="project-row" key={project.id}>
              <div className="project-identity"><Link className="project-name-link" href={`/projects/${project.id}`}><h3>{project.name}</h3></Link><p>{project.clientName}</p><span>{project.location}, {project.state}</span></div>
              <div className="project-delivery"><div><span className={`project-status ${project.status}`}>{project.status.replaceAll("_", " ")}</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><small>{isBoqReady ? "Completed BOQ value" : "Awaiting BOQ setup"}</small></div>
              <div className="project-controls"><span className={`boq-readiness ${isBoqReady ? "ready" : "setup"}`}>{isBoqReady ? "BOQ ready" : "Setup needed"}</span><span className={`status ${scheduleHealth}`}>{isBoqReady ? scheduleHealth.replace("_", " ") : "Schedule setup"}</span></div>
              <div className="project-commercial"><span>Contract sum</span><strong>{formatNaira(project.contractSum)}</strong><small>{formatNaira(activity?.variationExposure ?? 0)} variation exposure</small></div>
              <div className="project-activity"><span>{activity?.latestReportDate ? "Last daily report" : "Reporting"}</span><strong>{activity?.latestReportDate ? new Date(`${activity.latestReportDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "No reports yet"}</strong><Link href={`/projects/${project.id}`}>Open project →</Link></div>
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

export default function PublicHome() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) router.replace("/dashboard");
  }, [isLoading, router, user]);

  if (isLoading || user) return <main className="public-home-loading">Opening BuildCore…</main>;

  return <main className="public-home">
    <header className="public-home-header">
      <Link className="public-brand" href="/" aria-label="BuildCore home"><span className="brand-mark" aria-hidden="true">B</span><span className="brand-word">Build<span>Core</span><small>Engineering</small></span></Link>
      <nav aria-label="BuildCore information"><a href="#platform">Platform</a><a href="#modules">Modules</a><a href="#workflow">Workflow</a><a href="#roles">Teams</a></nav>
      <div><Link className="public-login-link" href="/login">Sign in</Link><Link className="public-demo-link" href="/request-demo">Request a demo</Link></div>
    </header>
    <section className="public-hero" id="platform">
      <div className="public-hero-copy"><p className="eyebrow">Engineering project management</p><h1>Every site.<br />Every variable.<br /><span>Under control.</span></h1><p>BuildCore gives your field teams and decision-makers one dependable source for daily reporting, BOQ progress, variations, valuations, and delivery action.</p><div className="public-hero-actions"><Link className="public-demo-link" href="/request-demo">Request a demo</Link><Link className="public-outline-link" href="/login">Open workspace →</Link></div><p className="public-hero-assurance">Built for Directors, Project Managers, Quantity Surveyors, and Site Engineers.</p></div>
      <div className="public-hero-visual" aria-hidden="true"><div className="public-visual-top"><span>BUILDCORE CONTROL CENTRE</span><i>● LIVE</i></div><div className="public-visual-grid"><span /><span /><span /><span /><span /><span /></div><div className="public-visual-summary"><small>Portfolio overview · live sync</small><div><span><b>12</b> Active projects</span><span><b>84%</b> Reporting current</span><span><b>3</b> Decisions due</span></div></div><div className="public-visual-card public-visual-card-main"><small>Portfolio progress</small><strong>68%</strong><i><b /></i><p>Current BOQ value complete</p></div><div className="public-visual-card public-visual-card-report"><small>Daily report</small><strong>Submitted</strong><p>Today · 16:40</p></div><div className="public-visual-card public-visual-card-change"><small>Variation review</small><strong>₦ 2.4m</strong><p>Awaiting decision</p></div><div className="public-visual-schedule"><span>Schedule health</span><b>On track</b><i><em /></i></div></div>
    </section>
    <section className="public-proof"><p>ONE WORKSPACE FOR THE FIELD AND THE OFFICE</p><div><span>Daily site reporting</span><span>BOQ-led progress</span><span>Controlled variations</span><span>Commercial clarity</span></div></section>
    <section className="public-impact-strip" aria-label="BuildCore platform highlights"><article><strong>Real-time</strong><span>Site-to-office visibility</span></article><article><strong>BOQ-led</strong><span>Progress and valuation control</span></article><article><strong>Role-based</strong><span>Clear responsibility at every stage</span></article><article><strong>Offline-ready</strong><span>Field updates that sync when connected</span></article></section>
    <section className="public-workflow"><div><p className="eyebrow">From the field to the decision</p><h2>One connected delivery rhythm.</h2><p>Every update moves through a practical route—so the people doing the work and the people approving it work from the same facts.</p></div><ol><li><span>01</span><div><strong>Record site activity</strong><p>Site Engineers submit completed work, labour, equipment, and issues.</p></div></li><li><span>02</span><div><strong>Track BOQ progress</strong><p>Completed quantities update the project’s delivery picture.</p></div></li><li><span>03</span><div><strong>Review changes</strong><p>Project Managers and Quantity Surveyors control variations.</p></div></li><li><span>04</span><div><strong>Approve with confidence</strong><p>Directors see the portfolio, commercial position, and required decisions.</p></div></li></ol></section>
    <section className="public-capabilities" id="modules"><div><p className="eyebrow">Core modules · one control layer</p><h2>Everything your delivery team needs in one place.</h2></div><div className="public-capability-grid"><article><span>01 · Site ops</span><h3>Daily reporting</h3><p>Capture site work, labour, equipment, observations, and issues while the day is still fresh.</p></article><article><span>02 · Commercial</span><h3>BOQ progress</h3><p>Turn completed quantities into a clear, reliable view of delivery progress.</p></article><article><span>03 · Change control</span><h3>Variations</h3><p>Raise, review, approve, and track project changes before they become commercial surprises.</p></article><article><span>04 · Finance</span><h3>Valuations</h3><p>Prepare BOQ-based payment certificates using the work and approved changes already recorded.</p></article><article><span>05 · Programme</span><h3>Milestones</h3><p>Make the next delivery commitments visible and keep schedule risk in context.</p></article><article><span>06 · Coordination</span><h3>Team updates</h3><p>Keep the assigned project team aligned with notifications, comments, and chat.</p></article></div></section>
    <section className="public-role-section" id="roles"><p className="eyebrow">Connected delivery teams</p><h2>Simple for site teams. Clear for management.</h2><div><article><strong>Site Engineers</strong><p>Record the day’s work while it is fresh.</p></article><article><strong>Project Managers</strong><p>See delivery, issues, and required action.</p></article><article><strong>Quantity Surveyors</strong><p>Manage BOQ progress, variations, and valuations.</p></article><article><strong>Directors</strong><p>Keep complete portfolio and approval oversight.</p></article></div></section>
    <section className="public-final-cta"><div><p className="eyebrow">Ready to take control?</p><h2>Bring the field, commercial team, and leadership into one workspace.</h2><p>Start with a practical BuildCore walkthrough shaped around the way your projects already run.</p></div><Link className="public-demo-link" href="/request-demo">Request a demo →</Link></section>
    <footer className="public-home-footer" aria-label="BuildCore legal information"><div><span>Privacy Policy</span><span>Terms of Service</span></div><p>© BuildCore Engineering</p></footer>
  </main>;
}
