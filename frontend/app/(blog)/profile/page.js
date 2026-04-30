"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import {
  getMyProfile, updateMyProfile,
  addExperience, deleteExperience,
  addQualification, deleteQualification,
  upsertSchool, deleteSchool,
} from "../../_lib/api_callout";

// ── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(firstName, lastName, email) {
  if (firstName && lastName) return (firstName[0] + lastName[0]).toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.split("@")[0].slice(0, 2).toUpperCase();
  return "??";
}

function durationLabel(years, months) {
  const parts = [];
  if (years > 0) parts.push(`${years} yr${years !== 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} mo${months !== 1 ? "s" : ""}`);
  return parts.join(" ") || "< 1 mo";
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function ChevronRight() {
  return (
    <svg className="profile-section-row-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

// ── Shared form primitives ─────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div className="profile-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

// ── Modal shell ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <p className="profile-modal-title">{title}</p>
          <button className="profile-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="profile-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Modal contents ─────────────────────────────────────────────────────────────

function BasicModal({ profile, token, onSaved, onClose }) {
  const [form, setForm] = useState({
    first_name: profile.first_name || "",
    last_name: profile.last_name || "",
    contact: profile.profile?.contact || "",
    location: profile.profile?.location || "",
    gender: profile.profile?.gender || "",
    headline: profile.profile?.headline || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    setSaving(true); setErr("");
    const { success, detail } = await updateMyProfile(form, token);
    setSaving(false);
    if (success) { onSaved(detail); onClose(); }
    else setErr(detail?.detail || "Failed to save.");
  }

  return (
    <>
      <div className="profile-grid">
        <Field label="First name">
          <input type="text" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} placeholder="Ada" />
        </Field>
        <Field label="Last name">
          <input type="text" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} placeholder="Lovelace" />
        </Field>
        <Field label="Contact">
          <input type="text" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} placeholder="+1 555 000 0000" />
        </Field>
        <Field label="Location">
          <input type="text" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="London, UK" />
        </Field>
        <Field label="Gender">
          <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
            <option value="">Prefer not to say</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Non-binary">Non-binary</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </Field>
        <Field label="Headline">
          <input type="text" value={form.headline} onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))} placeholder="Software engineer & writer" />
        </Field>
      </div>
      <div className="profile-modal-footer">
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        {err && <span className="profile-save-err">{err}</span>}
      </div>
    </>
  );
}

function BioModal({ profile, token, onSaved, onClose }) {
  const [bio, setBio] = useState(profile.profile?.bio || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    setSaving(true); setErr("");
    const { success, detail } = await updateMyProfile({ bio }, token);
    setSaving(false);
    if (success) { onSaved(detail); onClose(); }
    else setErr(detail?.detail || "Failed to save.");
  }

  return (
    <>
      <Field label="Bio">
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell readers a little about yourself…" style={{ minHeight: 120 }} />
      </Field>
      <div className="profile-modal-footer">
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        {err && <span className="profile-save-err">{err}</span>}
      </div>
    </>
  );
}

function ExperienceModal({ profile, token, onSaved, onClose }) {
  const [form, setForm] = useState({ company_name: "", designation: "", years: 0, months: 0 });
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState("");
  const [items, setItems] = useState(profile.experiences || []);

  async function handleAdd() {
    if (!form.company_name || !form.designation) return;
    setAdding(true); setAddErr("");
    const payload = { company_name: form.company_name, designation: form.designation, years: Number(form.years), months: Number(form.months) };
    const { success, detail } = await addExperience(payload, token);
    setAdding(false);
    if (success) {
      const updated = [...items, detail];
      setItems(updated);
      onSaved({ ...profile, experiences: updated });
      setForm({ company_name: "", designation: "", years: 0, months: 0 });
    } else setAddErr(detail?.detail || "Failed to add.");
  }

  async function handleDelete(id) {
    await deleteExperience(id, token);
    const updated = items.filter((e) => e.id !== id);
    setItems(updated);
    onSaved({ ...profile, experiences: updated });
  }

  return (
    <>
      {items.length > 0 && (
        <>
          <p className="profile-modal-sublabel">Current</p>
          <div className="exp-list">
            {items.map((exp) => (
              <div key={exp.id} className="exp-card">
                <div>
                  <p className="exp-card-title">{exp.designation}</p>
                  <p className="exp-card-meta">{exp.company_name} · {durationLabel(exp.years, exp.months)}</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(exp.id)}>Delete</button>
              </div>
            ))}
          </div>
          <div className="profile-modal-divider" />
        </>
      )}
      <p className="profile-modal-sublabel">Add new</p>
      <div className="profile-grid">
        <Field label="Company name">
          <input type="text" value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} placeholder="Acme Corp" />
        </Field>
        <Field label="Designation">
          <input type="text" value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} placeholder="Senior Engineer" />
        </Field>
        <Field label="Years">
          <input type="number" min={0} max={50} value={form.years} onChange={(e) => setForm((f) => ({ ...f, years: e.target.value }))} />
        </Field>
        <Field label="Months">
          <input type="number" min={0} max={11} value={form.months} onChange={(e) => setForm((f) => ({ ...f, months: e.target.value }))} />
        </Field>
      </div>
      <div className="profile-modal-footer">
        <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={adding || !form.company_name || !form.designation}>{adding ? "Adding…" : "Add"}</button>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Done</button>
        {addErr && <span className="profile-save-err">{addErr}</span>}
      </div>
    </>
  );
}

function QualificationsModal({ profile, token, onSaved, onClose }) {
  const [form, setForm] = useState({ institution: "", degree: "", field_of_study: "", year: "" });
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState("");
  const [items, setItems] = useState(profile.qualifications || []);

  async function handleAdd() {
    if (!form.institution || !form.degree) return;
    setAdding(true); setAddErr("");
    const payload = { institution: form.institution, degree: form.degree, field_of_study: form.field_of_study || null, year: form.year ? Number(form.year) : null };
    const { success, detail } = await addQualification(payload, token);
    setAdding(false);
    if (success) {
      const updated = [...items, detail];
      setItems(updated);
      onSaved({ ...profile, qualifications: updated });
      setForm({ institution: "", degree: "", field_of_study: "", year: "" });
    } else setAddErr(detail?.detail || "Failed to add.");
  }

  async function handleDelete(id) {
    await deleteQualification(id, token);
    const updated = items.filter((q) => q.id !== id);
    setItems(updated);
    onSaved({ ...profile, qualifications: updated });
  }

  return (
    <>
      {items.length > 0 && (
        <>
          <p className="profile-modal-sublabel">Current</p>
          <div className="exp-list">
            {items.map((qual) => (
              <div key={qual.id} className="exp-card">
                <div>
                  <p className="exp-card-title">{qual.degree}</p>
                  <p className="exp-card-meta">{qual.institution}{qual.field_of_study ? ` · ${qual.field_of_study}` : ""}{qual.year ? ` · ${qual.year}` : ""}</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(qual.id)}>Delete</button>
              </div>
            ))}
          </div>
          <div className="profile-modal-divider" />
        </>
      )}
      <p className="profile-modal-sublabel">Add new</p>
      <div className="profile-grid">
        <Field label="Institution">
          <input type="text" value={form.institution} onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))} placeholder="MIT" />
        </Field>
        <Field label="Degree">
          <input type="text" value={form.degree} onChange={(e) => setForm((f) => ({ ...f, degree: e.target.value }))} placeholder="B.Sc. Computer Science" />
        </Field>
        <Field label="Field of study">
          <input type="text" value={form.field_of_study} onChange={(e) => setForm((f) => ({ ...f, field_of_study: e.target.value }))} placeholder="Machine Learning" />
        </Field>
        <Field label="Year">
          <input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} placeholder="2020" />
        </Field>
      </div>
      <div className="profile-modal-footer">
        <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={adding || !form.institution || !form.degree}>{adding ? "Adding…" : "Add"}</button>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Done</button>
        {addErr && <span className="profile-save-err">{addErr}</span>}
      </div>
    </>
  );
}

function SchoolModal({ profile, token, onSaved, onClose }) {
  const s10init = profile.school_education?.find((s) => s.grade === "10th");
  const s12init = profile.school_education?.find((s) => s.grade === "12th");

  const [f10, setF10] = useState({ school_name: s10init?.school_name || "", board: s10init?.board || "", percentage: s10init?.percentage || "", year: s10init?.year ?? "" });
  const [f12, setF12] = useState({ school_name: s12init?.school_name || "", board: s12init?.board || "", percentage: s12init?.percentage || "", year: s12init?.year ?? "" });
  const [saving10, setSaving10] = useState(false);
  const [saving12, setSaving12] = useState(false);
  const [msg10, setMsg10] = useState("");
  const [msg12, setMsg12] = useState("");
  const [err10, setErr10] = useState("");
  const [err12, setErr12] = useState("");

  async function saveGrade(grade, form, setSaving, setMsg, setErr) {
    setSaving(true); setMsg(""); setErr("");
    const payload = { grade, school_name: form.school_name || null, board: form.board || null, percentage: form.percentage || null, year: form.year ? Number(form.year) : null };
    const { success, detail } = await upsertSchool(payload, token);
    setSaving(false);
    if (success) {
      const filtered = (profile.school_education || []).filter((s) => s.grade !== grade);
      onSaved({ ...profile, school_education: [...filtered, detail] });
      setMsg("Saved."); setTimeout(() => setMsg(""), 2500);
    } else setErr(detail?.detail || "Failed to save.");
  }

  async function deleteGrade(grade) {
    const entry = profile.school_education?.find((s) => s.grade === grade);
    if (!entry) return;
    await deleteSchool(entry.id, token);
    const filtered = (profile.school_education || []).filter((s) => s.grade !== grade);
    onSaved({ ...profile, school_education: filtered });
    if (grade === "10th") setF10({ school_name: "", board: "", percentage: "", year: "" });
    else setF12({ school_name: "", board: "", percentage: "", year: "" });
  }

  return (
    <>
      {/* 10th grade */}
      <p className="profile-school-grade">
        10th Grade
        {s10init && <button className="btn btn-ghost btn-sm" onClick={() => deleteGrade("10th")}>Delete</button>}
      </p>
      <div className="profile-grid">
        <Field label="School name"><input type="text" value={f10.school_name} onChange={(e) => setF10((f) => ({ ...f, school_name: e.target.value }))} placeholder="Springfield High" /></Field>
        <Field label="Board"><input type="text" value={f10.board} onChange={(e) => setF10((f) => ({ ...f, board: e.target.value }))} placeholder="CBSE" /></Field>
        <Field label="Percentage / Grade"><input type="text" value={f10.percentage} onChange={(e) => setF10((f) => ({ ...f, percentage: e.target.value }))} placeholder="92%" /></Field>
        <Field label="Year"><input type="number" value={f10.year} onChange={(e) => setF10((f) => ({ ...f, year: e.target.value }))} placeholder="2015" /></Field>
      </div>
      <div className="profile-modal-footer" style={{ marginBottom: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={() => saveGrade("10th", f10, setSaving10, setMsg10, setErr10)} disabled={saving10}>{saving10 ? "Saving…" : "Save 10th"}</button>
        {msg10 && <span className="profile-save-msg">{msg10}</span>}
        {err10 && <span className="profile-save-err">{err10}</span>}
      </div>

      <div className="profile-modal-divider" />

      {/* 12th grade */}
      <p className="profile-school-grade">
        12th Grade
        {s12init && <button className="btn btn-ghost btn-sm" onClick={() => deleteGrade("12th")}>Delete</button>}
      </p>
      <div className="profile-grid">
        <Field label="School name"><input type="text" value={f12.school_name} onChange={(e) => setF12((f) => ({ ...f, school_name: e.target.value }))} placeholder="Springfield High" /></Field>
        <Field label="Board"><input type="text" value={f12.board} onChange={(e) => setF12((f) => ({ ...f, board: e.target.value }))} placeholder="CBSE" /></Field>
        <Field label="Percentage / Grade"><input type="text" value={f12.percentage} onChange={(e) => setF12((f) => ({ ...f, percentage: e.target.value }))} placeholder="88%" /></Field>
        <Field label="Year"><input type="number" value={f12.year} onChange={(e) => setF12((f) => ({ ...f, year: e.target.value }))} placeholder="2017" /></Field>
      </div>
      <div className="profile-modal-footer">
        <button className="btn btn-primary btn-sm" onClick={() => saveGrade("12th", f12, setSaving12, setMsg12, setErr12)} disabled={saving12}>{saving12 ? "Saving…" : "Save 12th"}</button>
        {msg12 && <span className="profile-save-msg">{msg12}</span>}
        {err12 && <span className="profile-save-err">{err12}</span>}
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ marginTop: 4 }}>Done</button>
    </>
  );
}

// ── Section row ────────────────────────────────────────────────────────────────

function SectionRow({ label, summary, onClick }) {
  return (
    <button className="profile-section-row" onClick={onClick}>
      <span className="profile-section-row-label">{label}</span>
      <span className="profile-section-row-summary">{summary || "Not set"}</span>
      <ChevronRight />
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [activeModal, setActiveModal] = useState(null);

  const close = useCallback(() => setActiveModal(null), []);
  const saved = useCallback((updated) => setProfile(updated), []);

  useEffect(() => {
    if (!authLoading && !token) router.push("/login");
  }, [authLoading, token, router]);

  useEffect(() => {
    if (!token) return;
    getMyProfile(token).then(({ success, detail }) => {
      if (!success) { setLoadErr("Failed to load profile."); return; }
      setProfile(detail);
    });
  }, [token]);

  if (authLoading || (!profile && !loadErr)) {
    return <div className="profile-page"><p className="loading-indicator">Loading profile…</p></div>;
  }
  if (loadErr) {
    return <div className="profile-page"><p className="loading-indicator">{loadErr}</p></div>;
  }

  const initials = getInitials(profile.first_name, profile.last_name, profile.email);
  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email;

  // Summary strings for each row
  const basicSummary = [
    displayName !== profile.email ? displayName : null,
    profile.profile?.location,
    profile.profile?.headline,
  ].filter(Boolean).join(" · ") || null;

  const bioSummary = profile.profile?.bio
    ? profile.profile.bio.slice(0, 72) + (profile.profile.bio.length > 72 ? "…" : "")
    : null;

  const expSummary = profile.experiences?.length
    ? `${profile.experiences.length} position${profile.experiences.length !== 1 ? "s" : ""}`
    : null;

  const qualSummary = profile.qualifications?.length
    ? `${profile.qualifications.length} qualification${profile.qualifications.length !== 1 ? "s" : ""}`
    : null;

  const schoolGrades = (profile.school_education || []).map((s) => s.grade).join(" · ");
  const schoolSummary = schoolGrades || null;

  return (
    <>
      <div className="profile-page-header">
        <h1>Your profile</h1>
      </div>

      <div className="profile-page">

        {/* Hero */}
        <div className="profile-hero">
          <div className="avatar lg">{initials}</div>
          <div className="profile-hero-text">
            <span className="profile-name">{displayName}</span>
            {profile.profile?.headline && (
              <span className="profile-headline">{profile.profile.headline}</span>
            )}
            <span className="profile-email">{profile.email}</span>
          </div>
        </div>

        {/* Section rows */}
        <div className="profile-sections-card">
          <SectionRow label="Basic Information" summary={basicSummary} onClick={() => setActiveModal("basic")} />
          <SectionRow label="About Me" summary={bioSummary} onClick={() => setActiveModal("bio")} />
          <SectionRow label="Experience" summary={expSummary} onClick={() => setActiveModal("experience")} />
          <SectionRow label="Qualifications" summary={qualSummary} onClick={() => setActiveModal("qualifications")} />
          <SectionRow label="School Education" summary={schoolSummary} onClick={() => setActiveModal("school")} />
        </div>

      </div>

      {/* Modals */}
      {activeModal === "basic" && (
        <Modal title="Basic Information" onClose={close}>
          <BasicModal profile={profile} token={token} onSaved={saved} onClose={close} />
        </Modal>
      )}
      {activeModal === "bio" && (
        <Modal title="About Me" onClose={close}>
          <BioModal profile={profile} token={token} onSaved={saved} onClose={close} />
        </Modal>
      )}
      {activeModal === "experience" && (
        <Modal title="Experience" onClose={close}>
          <ExperienceModal profile={profile} token={token} onSaved={saved} onClose={close} />
        </Modal>
      )}
      {activeModal === "qualifications" && (
        <Modal title="Qualifications" onClose={close}>
          <QualificationsModal profile={profile} token={token} onSaved={saved} onClose={close} />
        </Modal>
      )}
      {activeModal === "school" && (
        <Modal title="School Education" onClose={close}>
          <SchoolModal profile={profile} token={token} onSaved={saved} onClose={close} />
        </Modal>
      )}
    </>
  );
}
