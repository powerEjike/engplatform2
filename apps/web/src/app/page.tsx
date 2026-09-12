"use client";

import { useMemo, useState } from "react";
import { formatNaira, portfolioProjects, type ProjectHealth } from "@/lib/dashboard-data";

const scheduleLabel: Record<ProjectHealth, string> = {
  on_track: "On track",
  attention: "Needs attention",
  behind: "Behind schedule",
};

export default function Home() {
  const states = [...new Set(portfolioProjects.map((project) => project.state))];
  const [selectedState, setSelectedState] = useState("All states");
  const visibleProjects = useMemo(
    () => selectedState === "All states"
      ? portfolioProjects
      : portfolioProjects.filter((project) => project.state === selectedState),
    [selectedState],
  );
  const totalExposure = visibleProjects.reduce(
    (total, project) => total + project.variationExposure, 0);
  const averageProgress = Math.round(
    visibleProjects.reduce((total, project) => total + project.progress, 0) / visibleProjects.length,
  );
  const reportsNeedingAttention = visibleProjects.filter(
    (project) => project.lastReport.includes("days"),
  ).length;
  const attentionProject = visibleProjects.find((project) => project.lastReport.includes("days"));

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
            <h1>Good morning, Ejike.</h1>
          </div>
          <div className="profile"><span className="avatar">PE</span><span>Director</span></div>
        </header>

        <section className="summary-grid" aria-label="Portfolio summary">
          <article className="metric-card">
            <p>Active projects</p><strong>{visibleProjects.length}</strong><span>{selectedState === "All states" ? "Across all states" : `In ${selectedState}`}</span>
          </article>
          <article className="metric-card">
            <p>Portfolio progress</p><strong>{averageProgress}%</strong><span>Value-weighted target: coming soon</span>
          </article>
          <article className="metric-card highlight">
            <p>Variation exposure</p><strong>{formatNaira(totalExposure)}</strong><span>3 pending decisions</span>
          </article>
          <article className="metric-card warning">
            <p>Reports needing attention</p><strong>{reportsNeedingAttention}</strong><span>Not submitted in 3+ days</span>
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
            <button type="button">+ Add project</button>
          </div>
        </section>

        <section className="project-table" id="projects" aria-label="Active projects">
          <div className="project-table-head"><span>Project</span><span>Progress</span><span>Schedule</span><span>Variation exposure</span><span>Latest report</span></div>
          {visibleProjects.map((project) => (
            <article className="project-row" key={project.name}>
              <div><h3>{project.name}</h3><p>{project.client} · {project.state}</p></div>
              <div className="progress-cell"><div className="progress-label"><span>{project.progress}%</span></div><div className="progress-track"><span style={{ width: `${project.progress}%` }} /></div></div>
              <span className={`status ${project.schedule}`}>{scheduleLabel[project.schedule]}</span>
              <strong className="exposure">{formatNaira(project.variationExposure)}</strong>
              <span className="report-date">{project.lastReport}</span>
            </article>
          ))}
        </section>

        <section className="attention-card" id="variations">
          <div>
            <p className="eyebrow">Your attention</p>
            <h2>{attentionProject ? `${attentionProject.name} needs a report follow-up` : "All selected projects have recent reports"}</h2>
            <p>{attentionProject ? `The last site report was submitted ${attentionProject.lastReport.toLowerCase()}. Review the project timeline or contact the Site Engineer.` : "There are no missing daily reports in this selection."}</p>
          </div>
          <button type="button" className="secondary">{attentionProject ? "View project" : "View reports"}</button>
        </section>
      </main>
    </div>
  );
}
