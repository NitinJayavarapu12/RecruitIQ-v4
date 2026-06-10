import { useState, useMemo, useEffect } from "react";
import { downloadExcel, downloadZip } from "../api/screenerAPI";

const PAGE_SIZE = 10;

const TIER_META = {
  "Excellent Match": { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  "Strong Match":    { bg: "bg-green-100",   text: "text-green-700",   border: "border-green-200",   dot: "bg-green-500",   bar: "bg-green-500" },
  "Good Match":      { bg: "bg-sky-100",     text: "text-sky-700",     border: "border-sky-200",     dot: "bg-sky-500",     bar: "bg-sky-500" },
  "Partial Match":   { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500",   bar: "bg-amber-500" },
  "Weak Match":      { bg: "bg-red-100",     text: "text-red-600",     border: "border-red-200",     dot: "bg-red-500",     bar: "bg-red-400" },
};

const TIERS = ["All", "Excellent Match", "Strong Match", "Good Match", "Partial Match", "Weak Match"];

function scoreColor(s) {
  if (s >= 90) return { ring: "stroke-emerald-500", text: "text-emerald-600", bar: "bg-emerald-500" };
  if (s >= 75) return { ring: "stroke-green-500",   text: "text-green-600",   bar: "bg-green-500" };
  if (s >= 60) return { ring: "stroke-sky-500",     text: "text-sky-600",     bar: "bg-sky-500" };
  if (s >= 45) return { ring: "stroke-amber-500",   text: "text-amber-600",   bar: "bg-amber-500" };
  return { ring: "stroke-red-400", text: "text-red-500", bar: "bg-red-400" };
}

function ScoreRing({ score, size = 52 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const c = scoreColor(score);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
        className="text-slate-100" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        className={c.ring} strokeWidth={5}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round" />
    </svg>
  );
}

function ScoreBar({ label, score, reason }) {
  const c = scoreColor(score);
  return (
    <div className="mb-3.5">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={`text-xs font-bold tabular-nums ${c.text}`}>{score}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${c.bar} transition-all`} style={{ width: `${score}%` }} />
      </div>
      {reason && reason !== "N/A" && (
        <div className="text-xs text-slate-400 mt-1 leading-relaxed">{reason}</div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  if (!value || value === "N/A") return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
      <div className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-300">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-xs font-medium text-slate-700 mt-0.5 break-all">{value}</div>
      </div>
    </div>
  );
}

function CandidatePanel({ candidate, onClose }) {
  if (!candidate) return null;
  const score = Math.round(candidate.final_score || candidate.score || 0);
  const c = scoreColor(score);
  const tier = candidate.tier || "N/A";
  const tierMeta = TIER_META[tier] || { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" };

  return (
    <div className="w-88 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden" style={{ width: 352 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="text-sm font-semibold text-slate-800">Candidate Profile</div>
        <button onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Hero section */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-start gap-4">
            {/* Score ring */}
            <div className="relative flex-shrink-0">
              <ScoreRing score={score} size={56} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-sm font-bold tabular-nums ${c.text}`}>{score}</span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold text-slate-900 leading-tight">{candidate.name || "N/A"}</div>
              <div className="text-xs text-slate-500 mt-0.5 truncate">
                {candidate.current_company || candidate.latest_employment || ""}
              </div>
              <div className={`inline-flex mt-2 text-xs px-2 py-0.5 rounded-full border font-medium ${tierMeta.bg} ${tierMeta.text} ${tierMeta.border}`}>
                {tier}
              </div>
            </div>
          </div>

          {/* Experience highlight */}
          {candidate.years_of_experience && candidate.years_of_experience !== "0" && (
            <div className="mt-3 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-slate-500">
                {candidate.years_of_experience} years experience {candidate.experience_flag || ""}
              </span>
            </div>
          )}
        </div>

        {/* AI Summary */}
        {candidate.candidate_summary && candidate.candidate_summary !== "N/A" && (
          <div className="mx-5 my-4 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
            <div className="text-xs font-semibold text-indigo-600 mb-1.5">AI Assessment</div>
            <div className="text-xs text-slate-700 leading-relaxed">{candidate.candidate_summary}</div>
          </div>
        )}

        {/* Contact info */}
        <div className="px-5 mb-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Contact</div>
          <div className="bg-slate-50 rounded-lg px-3 py-1 border border-slate-100">
            <InfoRow
              icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
              label="Email" value={candidate.email}
            />
            <InfoRow
              icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
              label="Phone" value={candidate.phone}
            />
            <InfoRow
              icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>}
              label="Education" value={candidate.education}
            />
          </div>
          {candidate.linkedin && candidate.linkedin !== "N/A" && (
            <a href={candidate.linkedin} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 mt-2 text-xs text-indigo-600 hover:text-indigo-700 hover:underline px-3">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              LinkedIn Profile
            </a>
          )}
        </div>

        {/* Skills */}
        {(candidate.matched_skills?.length > 0 || candidate.missing_skills?.length > 0) && (
          <div className="px-5 mb-4">
            {candidate.matched_skills?.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Matched Skills ({candidate.matched_skills.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.matched_skills.map(s => (
                    <span key={s} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {candidate.missing_skills?.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Missing Skills ({candidate.missing_skills.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.missing_skills.map(s => (
                    <span key={s} className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Score breakdown */}
        <div className="px-5 pb-5 border-t border-slate-100 pt-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Score Breakdown</div>
          <ScoreBar label="Technical Skills  ·  30%" score={candidate.technical_skills_score || 0} reason={candidate.technical_skills_reason} />
          <ScoreBar label="Experience  ·  25%"        score={candidate.experience_score || 0}        reason={candidate.experience_reason} />
          <ScoreBar label="Domain  ·  20%"            score={candidate.domain_score || 0}            reason={candidate.domain_reason} />
          <ScoreBar label="Role Match  ·  10%"        score={candidate.role_score || 0}              reason={candidate.role_reason} />
          <ScoreBar label="Education  ·  10%"         score={candidate.education_score || 0}         reason={candidate.education_reason} />
          <ScoreBar label="Career  ·  5%"             score={candidate.career_score || 0}            reason={candidate.career_reason} />
        </div>
      </div>
    </div>
  );
}

export default function ResultsStep({ results, jobId, jdData, skillsData, onNewScreening }) {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("All");
  const [skillFilter, setSkillFilter] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [search, tierFilter, skillFilter]);

  const requiredSkills = useMemo(() => {
    const primary = skillsData?.primarySkills || jdData?.primary_skills || [];
    const secondary = skillsData?.secondarySkills || jdData?.secondary_skills || [];
    return [...primary, ...secondary];
  }, [skillsData, jdData]);

  const filtered = useMemo(() => {
    return results.filter(c => {
      if (search) {
        const q = search.toLowerCase();
        const nameMatch = (c.name || "").toLowerCase().includes(q);
        const companyMatch = (c.current_company || c.latest_employment || "").toLowerCase().includes(q);
        if (!nameMatch && !companyMatch) return false;
      }
      if (tierFilter !== "All" && c.tier !== tierFilter) return false;
      if (skillFilter.length > 0) {
        const matched = (c.matched_skills || []).map(s => s.toLowerCase());
        return skillFilter.every(sf => matched.some(m => m.includes(sf.toLowerCase())));
      }
      return true;
    });
  }, [results, search, tierFilter, skillFilter]);

  const stats = useMemo(() => {
    const total = results.length;
    const excellent = results.filter(c => c.tier === "Excellent Match").length;
    const strong = results.filter(c => c.tier === "Strong Match").length;
    const avgScore = total
      ? Math.round(results.reduce((s, c) => s + (c.final_score || c.score || 0), 0) / total)
      : 0;
    return { total, excellent, strong, avgScore };
  }, [results]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSkillFilter = (skill) => {
    setSkillFilter(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50/30">
      {/* Main panel */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header: stats + actions */}
        <div className="bg-white border-b border-slate-200 px-6 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            {/* Stat cards */}
            <div className="flex gap-3">
              {[
                { label: "Screened",      value: stats.total,          color: "text-indigo-600",  bg: "bg-indigo-50",  border: "border-indigo-100" },
                { label: "Excellent",     value: stats.excellent,      color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
                { label: "Strong",        value: stats.strong,         color: "text-green-600",   bg: "bg-green-50",   border: "border-green-100" },
                { label: "Avg Score",     value: `${stats.avgScore}`,  color: "text-sky-600",     bg: "bg-sky-50",     border: "border-sky-100" },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} className={`rounded-xl px-4 py-3 border ${bg} ${border}`}>
                  <div className={`text-2xl font-bold leading-tight tabular-nums ${color}`}>{value}</div>
                  <div className="text-xs text-slate-500 mt-0.5 font-medium">{label}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button onClick={() => downloadZip(jobId)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download ZIP
              </button>
              <button onClick={() => downloadExcel(jobId)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition-colors shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel Report
              </button>
            </div>
          </div>

          {/* Search + tier filter + skill chips */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or company..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent placeholder-slate-300 bg-white"
              />
            </div>

            <select
              value={tierFilter}
              onChange={e => setTierFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              {TIERS.map(t => <option key={t}>{t}</option>)}
            </select>

            {requiredSkills.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {requiredSkills.map(skill => (
                  <button
                    key={skill}
                    onClick={() => toggleSkillFilter(skill)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                      skillFilter.includes(skill)
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    {skill}
                  </button>
                ))}
                {skillFilter.length > 0 && (
                  <button
                    onClick={() => setSkillFilter([])}
                    className="text-xs px-2 py-1 text-slate-400 hover:text-slate-600 underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {filtered.length !== results.length && (
            <div className="mt-2 text-xs text-slate-400">
              Showing {filtered.length} of {results.length} candidates
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                {[
                  { label: "#",              cls: "w-10" },
                  { label: "Candidate",      cls: "" },
                  { label: "Experience",     cls: "w-28" },
                  { label: "Company",        cls: "w-40" },
                  { label: "Matched Skills", cls: "" },
                  { label: "Score",          cls: "w-20 text-center" },
                  { label: "Tier",           cls: "w-36" },
                ].map(({ label, cls }) => (
                  <th key={label} className={`text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 ${cls}`}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map((c, idx) => {
                const score = Math.round(c.final_score || c.score || 0);
                const isSelected = selected?.filename === c.filename;
                const globalRank = (page - 1) * PAGE_SIZE + idx + 1;
                const col = scoreColor(score);
                const tierMeta = TIER_META[c.tier] || {};

                return (
                  <tr
                    key={c.filename || idx}
                    onClick={() => setSelected(isSelected ? null : c)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-indigo-50 border-l-2 border-l-indigo-400" : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-3.5 text-sm text-slate-300 font-medium tabular-nums">{globalRank}</td>

                    <td className="px-4 py-3.5">
                      <div className="text-sm font-semibold text-slate-800">{c.name || "N/A"}</div>
                      {c.email && c.email !== "N/A" && (
                        <div className="text-xs text-slate-400 mt-0.5 truncate max-w-48">{c.email}</div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                      {c.years_of_experience && c.years_of_experience !== "0"
                        ? `${c.years_of_experience} yrs`
                        : "—"
                      }
                      {c.experience_flag && (
                        <span className="ml-1 text-xs">{c.experience_flag}</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 max-w-40">
                      <div className="text-sm text-slate-600 truncate">
                        {c.current_company || c.latest_employment || "—"}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 max-w-52">
                      <div className="flex flex-wrap gap-1">
                        {(c.matched_skills || []).slice(0, 4).map(s => (
                          <span key={s} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-md font-medium">
                            {s}
                          </span>
                        ))}
                        {(c.matched_skills || []).length > 4 && (
                          <span className="text-xs text-slate-400 self-center">
                            +{c.matched_skills.length - 4}
                          </span>
                        )}
                        {(c.matched_skills || []).length === 0 && (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`text-sm font-bold tabular-nums ${col.text}`}>{score}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${tierMeta.bg || "bg-slate-100"} ${tierMeta.text || "text-slate-600"} ${tierMeta.border || "border-slate-200"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tierMeta.dot || "bg-slate-400"}`} />
                        {c.tier || "N/A"}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400 text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      No candidates match the current filters
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-slate-400">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span key={`e-${i}`} className="px-1.5 text-xs text-slate-300">…</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-7 h-7 text-xs rounded-lg border transition-colors ${
                        p === page
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}>
                      {p}
                    </button>
                  )
                )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Candidate detail panel */}
      <CandidatePanel candidate={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
