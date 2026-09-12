const milestones = [
  "Secure sign-in and role-based access",
  "Project and BOQ setup",
  "Offline-capable daily site reports",
  "Management visibility of reports and progress",
];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Engineering project management</p>
        <h1>One clear view of every project.</h1>
        <p className="intro">
          engplatform2 will connect site activity, BOQ progress, variations, and valuations in one dependable workspace.
        </p>
      </section>

      <section className="card" aria-labelledby="first-milestone">
        <p className="eyebrow">First milestone</p>
        <h2 id="first-milestone">A dependable reporting foundation</h2>
        <ol>
          {milestones.map((milestone) => <li key={milestone}>{milestone}</li>)}
        </ol>
      </section>
    </main>
  );
}
