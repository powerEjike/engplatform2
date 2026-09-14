"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/dashboard-data";
import { useAuth } from "@/components/auth-provider";
import { useProjects } from "@/hooks/use-projects";

export default function Home() {
  const router = useRouter();
  const { user, isLoading, profile, isProfileLoading, signOutUser } = useAuth();
  const { projects, isLoading: areProjectsLoading } = useProjects(profile?.companyId);
  const firstProjectId = projects[0]?.id;
  const states = [...new Set(projects.map((project) => project.state))];
  const [selectedState, setSelectedState] = useState("All states");
  const visibleProjects = useMemo(
    () => selectedState === "All states"
      ? projects
      : projects.filter((project) => project.state === selectedState),
    [projects, selectedState],
  );
  const totalExposure = visibleProjects.reduce(
    (total) => total, 0);
  const averageProgress = 0;
  const reportsNeedingAttention = visibleProjects.length;

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/onboarding");
  }, [isLoading, isProfileLoading, profile, router, user]);

  if (isLoading || isProfileLoading || !user || !profile) return <main className="auth-loading">Checking your secure workspace…</main>;

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
          <a className="nav-link" href="#variations">Variations <span className="count">3</span></a>
          <a className="nav-link" href="#valuations">Valuations</a>
          <a className="nav-link" href="#team">Team</a>
        </nav>
        <div className="sidebar-footer">
          <p className="firm-name">Power Engineering Ltd.</p>
          <a className="settings-link" href="#settings">Company settings</a>
        </div>
      </aside>

      <main id="top">
        <header className="topbar">
          <div>
            <p className="eyebrow">Portfolio overview</p>
            <h1>Good morning, {profile.name.split(" ")[0]}.</h1>
          </div>
          <div className="profile"><span className="avatar">{user.email?.slice(0, 2).toUpperCase() ?? "U"}</span><span>{profile.role.replace("_", " ")}</span><button className="sign-out" type="button" onClick={() => void signOutUser()}>Sign out</button></div>
        </header>

        <section className="summary-grid" aria-label="Portfolio summary">
          <article className="metric-card">
            <p>Active projects</p><strong>{visibleProjects.length}</strong><span>{selectedState === "All states" ? "Across all states" : `In ${selectedState}`}</span>
          </article>
          <article className="metric-card">
            <p>Portfolio progress</p><strong>{averageProgress}%</strong><span>Available after BOQ setup</span>
          </article>
          <article className="metric-card highlight">
            <p>Variation exposure</p><strong>{formatNaira(totalExposure)}</strong><span>Available after variations are raised</span>
          </article>
          <article className="metric-card warning">
            <p>Reports needing attention</p><strong>{reportsNeedingAttention}</strong><span>Projects with no site report yet</span>
          </article>
        </section>

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
            <Link className="primary-action" href="/projects/new">+ Add project</Link>
          </div>
        </section>

        <section className="project-table" id="projects" aria-label="Active projects">
          <div className="project-table-head"><span>Project</span><span>Progress</span><span>Schedule</span><span>Variation exposure</span><span>Latest report</span></div>
          {areProjectsLoading && <p className="empty-state">Loading your projects…</p>}
          {!areProjectsLoading && visibleProjects.length === 0 && <p className="empty-state">No projects yet. Add your first project to begin.</p>}
          {visibleProjects.map((project) => (
            <article className="project-row" key={project.id}>
              <div><Link className="project-name-link" href={`/projects/${project.id}`}><h3>{project.name}</h3></Link><p>{project.clientName} · {project.state}</p></div>
              <div className="progress-cell"><div className="progress-label"><span>0%</span></div><div className="progress-track"><span style={{ width: "0%" }} /></div></div>
              <span className="status on_track">Setup</span>
              <strong className="exposure">{formatNaira(0)}</strong>
              <span className="report-date">No reports yet</span>
            </article>
          ))}
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
