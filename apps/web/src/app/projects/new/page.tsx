"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";

const states = ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"];

export default function NewProjectPage() {
  const router = useRouter(); const { user, profile } = useAuth();
  const [name, setName] = useState(""); const [clientName, setClientName] = useState("");
  const [contractSum, setContractSum] = useState(""); const [location, setLocation] = useState("");
  const [state, setState] = useState("FCT Abuja"); const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState("");
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!user || !profile) return; const value = Number(contractSum);
    if (!Number.isFinite(value) || value < 0) return setError("Enter a valid contract sum in Naira.");
    if (endDate < startDate) return setError("The end date must be after the start date.");
    setSaving(true); setError("");
    try { await addDoc(collection(db, "companies", profile.companyId, "projects"), { name: name.trim(), clientName: clientName.trim(), contractSum: value, location: location.trim(), state, startDate, endDate, status: "active", createdBy: user.uid, createdAt: serverTimestamp() }); router.replace("/"); }
    catch { setError("We could not create this project. Please try again."); setSaving(false); }
  };
  return <main className="onboarding-page"><section className="onboarding-card project-form-card"><p className="eyebrow">Project setup</p><h1>Add a project</h1><p>Start with the contract details. BOQ items come next.</p><form onSubmit={submit}>
    <label>Project name<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Client name<input value={clientName} onChange={(e) => setClientName(e.target.value)} required /></label><label>Contract sum (₦)<input inputMode="decimal" value={contractSum} onChange={(e) => setContractSum(e.target.value)} required /></label><label>Project location<input value={location} onChange={(e) => setLocation(e.target.value)} required /></label><label>State<select value={state} onChange={(e) => setState(e.target.value)}>{states.map((item) => <option key={item}>{item}</option>)}</select></label><div className="date-fields"><label>Start date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></label><label>Planned end date<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></label></div>{error && <p className="form-error">{error}</p>}<button disabled={saving}>{saving ? "Creating project…" : "Create project"}</button>
  </form></section></main>;
}
