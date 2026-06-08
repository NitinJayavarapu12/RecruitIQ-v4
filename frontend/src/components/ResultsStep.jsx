import { useState, useMemo, useEffect } from "react";

const PAGE_SIZE = 10;
import { downloadExcel, downloadZip } from "../api/screenerAPI";

const TIER_COLORS = {
  "🌟 Excellent Match": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "✅ Strong Match":    "bg-green-100 text-green-700 border-green-200",
  "⚠️ Good Match":     "bg-yellow-100 text-yellow-700 border-yellow-200",
  "🔶 Partial Match":  "bg-orange-100 text-orange-700 border-orange-200",
  "❌ Weak Match":      "bg-red-100 text-red-700 border-red-200",
};

const SCORE_BG = (s) => {
  if (s >= 90) return "bg-emerald-500";
  if (s >= 75) return "bg-green-500";
  if (s >= 60) return "bg-yellow-500";
  if (s >= 45) return "bg-orange-500";
  return "bg-red-500";
};

const TIERS = ["All", "🌟 Excellent Match", "✅ Strong Match", "⚠️ Good Match", "🔶 Partial Match", "❌ Weak Match"];

function ScoreBar({ label, score, reason }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`text-xs font-bold text-white px-1.5 py-0.5 rounded ${SCORE_BG(score)}`}>{score}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
        <div className={`h-1.5 rounded-full ${SCORE_BG(score)}`} style={{ width: `${score}%` }} />
      </div>
      {reason && reason !== "N/A" && (
        <div className="text-xs text-gray-400">{reason}</div>
      )}
    </div>
  );
}

function CandidatePanel({ candidate, onClose }) {
  if (!candidate) return null;
  const score = candidate.final_score || candidate.score || 0;
  return (
    <div className="w-96 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="text-sm font-semibold text-gray-900">Candidate Profile</div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-lg font-bold text-gray-900">{candidate.name || "N/A"}</div>
              <div className="text-sm text-gray-500">{candidate.current_company || candidate.latest_employment || "N/A"}</div>
            </div>
            <div className={`text-2xl font-bold flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white ${SCORE_BG(score)}`}>
              {Math.round(score)}
            </div>
          </div>
          <div className={`inline-flex mt-2 text-xs px-2.5 py-1 rounded-full border font-medium ${TIER_COLORS[candidate.tier] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
            {candidate.tier || "N/A"}
          </div>
        </div>

        {/* Contact */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1.5">
          {[
            { icon: "📧", val: candidate.email },
            { icon: "📱", val: candidate.phone },
            { icon: "💼", val: `${candidate.years_of_experience || "?"} years ${candidate.experience_flag || ""}` },
            { icon: "🎓", val: candidate.education },
          ].filter(i => i.val && i.val !== "N/A").map(({ icon, val }) => (
            <div key={icon} className="flex items-center gap-2 text-xs text-gray-600">
              <span>{icon}</span>
              <span className="truncate">{val}</span>
            </div>
          ))}
          {candidate.linkedin && candidate.linkedin !== "N/A" && (
            <a href={candidate.linkedin} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-indigo-600 hover:underline">
              <span>🔗</span> LinkedIn Profile
            </a>
          )}
        </div>

        {/* Summary */}
        {candidate.candidate_summary && candidate.candidate_summary !== "N/A" && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-4">
            <div className="text-xs font-medium text-indigo-700 mb-1">AI Summary</div>
            <div className="text-xs text-gray-700">{candidate.candidate_summary}</div>
          </div>
        )}

        {/* Skills */}
        <div className="mb-4">
          {candidate.matched_skills?.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-700 mb-1.5">✅ Matched Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {candidate.matched_skills.map(s => (
                  <span key={s} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
          {candidate.missing_skills?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1.5">❌ Missing Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {candidate.missing_skills.map(s => (
                  <span key={s} className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Score breakdown */}
        <div className="border-t border-gray-100 pt-4">
          <div className="text-xs font-semibold text-gray-700 mb-3">Score Breakdown</div>
          <ScoreBar label="Technical Skills (30%)" score={candidate.technical_skills_score || 0} reason={candidate.technical_skills_reason} />
          <ScoreBar label="Experience (25%)" score={candidate.experience_score || 0} reason={candidate.experience_reason} />
          <ScoreBar label="Domain (20%)" score={candidate.domain_score || 0} reason={candidate.domain_reason} />
          <ScoreBar label="Role Match (10%)" score={candidate.role_score || 0} reason={candidate.role_reason} />
          <ScoreBar label="Education (10%)" score={candidate.education_score || 0} reason={candidate.education_reason} />
          <ScoreBar label="Career (5%)" score={candidate.career_score || 0} reason={candidate.career_reason} />
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

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [search, tierFilter, skillFilter]);

  const requiredSkills = skillsData?.primarySkills || jdData?.primary_skills || [];

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

  const stats = useMemo(() => ({
    total: results.length,
    excellent: results.filter(c => c.tier === "🌟 Excellent Match").length,
    strong: results.filter(c => c.tier === "✅ Strong Match").length,
    avgScore: results.length ? Math.round(results.reduce((s, c) => s + (c.final_score || c.score || 0), 0) / results.length) : 0,
  }), [results]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSkillFilter = (skill) => {
    setSkillFilter(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Stats + actions */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-4">
              {[
                { label: "Screened", value: stats.total, color: "text-gray-900" },
                { label: "Excellent", value: stats.excellent, color: "text-emerald-600" },
                { label: "Strong", value: stats.strong, color: "text-green-600" },
                { label: "Avg Score", value: `${stats.avgScore}/100`, color: "text-indigo-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <div className={`text-xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-gray-400">{label}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => downloadZip(jobId)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                ZIP
              </button>
              <button onClick={() => downloadExcel(jobId)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition-colors font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Excel Report
              </button>
              <button onClick={onNewScreening}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                New Screening
              </button>
            </div>
          </div>

          {/* Search + filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or company..."
                className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder-gray-400"
              />
            </div>

            <select
              value={tierFilter}
              onChange={e => setTierFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
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
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filtered.length !== results.length && (
            <div className="mt-2 text-xs text-gray-400">
              Showing {filtered.length} of {results.length} candidates
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
              <tr>
                {["#", "Candidate", "Experience", "Company", "Matched Skills", "Score", "Tier"].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((c, idx) => {
                const score = c.final_score || c.score || 0;
                const isSelected = selected?.filename === c.filename;
                const globalRank = (page - 1) * PAGE_SIZE + idx + 1;
                return (
                  <tr
                    key={c.filename || idx}
                    onClick={() => setSelected(isSelected ? null : c)}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                      isSelected ? "bg-indigo-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-400 font-medium">{globalRank}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{c.name || "N/A"}</div>
                      <div className="text-xs text-gray-400">{c.email && c.email !== "N/A" ? c.email : ""}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {c.years_of_experience || "?"} yrs {c.experience_flag || ""}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-32">
                      <div className="truncate">{c.current_company || c.latest_employment || "N/A"}</div>
                    </td>
                    <td className="px-4 py-3 max-w-48">
                      <div className="flex flex-wrap gap-1">
                        {(c.matched_skills || []).slice(0, 3).map(s => (
                          <span key={s} className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                        {(c.matched_skills || []).length > 3 && (
                          <span className="text-xs text-gray-400">+{c.matched_skills.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`inline-flex items-center justify-center w-10 h-7 rounded-lg text-xs font-bold text-white ${SCORE_BG(score)}`}>
                        {Math.round(score)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TIER_COLORS[c.tier] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                        {c.tier || "N/A"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                    No candidates match the current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-gray-400">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} candidates
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
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
                    <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-gray-400">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 text-xs rounded-lg border transition-colors ${
                        p === page
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail panel */}
      <CandidatePanel candidate={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
