import { formatNaira, portfolioProjects, type ProjectHealth } from "@/lib/dashboard-data";

const scheduleLabel: Record<ProjectHealth, string> = {
  on_track: "On track",
  attention: "Needs attention",
  behind: "Behind schedule",
};

export default function Home() {
  const totalExposure = portfolioProjects.reduce(
    (total, project) => total + project.variationExposure, 0);
  const averageProgress = Math.round(
    portfolioProjects.reduce((total, project) => total + project.progress, 0) / portfolioProjects.length,
  );
  const reportsNeedingAttention = portfolioProjects.filter(
    (project) => project.lastReport.includes("days"),
  ).length;

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
            <p>Active projects</p><strong>{portfolioProjects.length}</strong><span>Across Abuja</span>
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
          <button type="button">+ Add project</button>
        </section>

        <section className="project-table" id="projects" aria-label="Active projects">
          <div className="project-table-head"><span>Project</span><span>Progress</span><span>Schedule</span><span>Variation exposure</span><span>Latest report</span></div>
          {portfolioProjects.map((project) => (
            <article className="project-row" key={project.name}>
              <div><h3>{project.name}</h3><p>{project.client}</p></div>
              <div className="progress-cell"><div className="progress-label"><span>{project.progress}%</span></div><div className="progress-track"><span style={{ width: `${project.progress}%` }} /></div></div>
              <span className={`status ${project.schedule}`}>{scheduleLabel[project.schedule]}</span>
              <strong className="exposure">{formatNaira(project.variationExposure)}</strong>
              <span className="report-date">{project.lastReport}</span>
            </article>
          ))}
        </section>

        <section className="attention-card" id="variations">
          <div><p className="eyebrow">Your attention</p><h2>Kubwa Road Rehabilitation needs a report follow-up</h2><p>The last site report was submitted 4 days ago. Review the project timeline or contact the Site Engineer.</p></div>
          <button type="button" className="secondary">View project</button>
        </section>
      </main>
    </div>
  );
}
