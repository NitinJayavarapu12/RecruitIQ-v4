import { useState, useEffect } from "react";
import { refineSkills } from "../api/screenerAPI";

function EditableSkillTag({ skill, onRemove, color = "indigo" }) {
  const styles = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    gray: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border ${styles[color]}`}>
      {skill}
      <button onClick={() => onRemove(skill)} className="hover:text-red-500 transition-colors ml-0.5">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

function AddSkillInput({ onAdd, placeholder }) {
  const [val, setVal] = useState("");
  const submit = () => {
    const trimmed = val.trim();
    if (trimmed) { onAdd(trimmed); setVal(""); }
  };
  return (
    <div className="flex gap-1.5 mt-3">
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder={placeholder}
        className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder-gray-400"
      />
      <button onClick={submit} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium transition-colors">
        Add
      </button>
    </div>
  );
}

export default function SkillsReviewStep({ jdData, onBack, onNext }) {
  const [primarySkills, setPrimarySkills] = useState(jdData.primary_skills || []);
  const [secondarySkills, setSecondarySkills] = useState(jdData.secondary_skills || []);
  const [filterMode, setFilterMode] = useState("OR");
  const [selectedFilterSkills, setSelectedFilterSkills] = useState(
    new Set(jdData.primary_skills || [])
  );
  const [refining, setRefining] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  // Keep filter selection in sync when skills are removed
  useEffect(() => {
    const allSkills = new Set([...primarySkills, ...secondarySkills]);
    setSelectedFilterSkills(prev => new Set([...prev].filter(s => allSkills.has(s))));
  }, [primarySkills, secondarySkills]);

  const toggleFilterSkill = (skill) => {
    setSelectedFilterSkills(prev => {
      const next = new Set(prev);
      next.has(skill) ? next.delete(skill) : next.add(skill);
      return next;
    });
  };

  const handleRefine = async () => {
    setRefining(true);
    try {
      const result = await refineSkills(jdData.jd_text, feedback || "find more specific technical skills");
      const newPrimary = result.primary_skills || [];
      const newSecondary = result.secondary_skills || [];
      setPrimarySkills(newPrimary);
      setSecondarySkills(newSecondary);
      setSelectedFilterSkills(new Set(newPrimary));
      setShowFeedback(false);
      setFeedback("");
    } catch (e) {
      console.error(e);
    } finally {
      setRefining(false);
    }
  };

  const handleStart = () => {
    onNext({
      primarySkills,
      secondarySkills,
      filterSkills: [...selectedFilterSkills],
      filterMode,
    });
  };

  const selectedCount = selectedFilterSkills.size;

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Review Extracted Skills</h1>
        <p className="text-gray-500 mt-1">Edit skills, then configure how candidates are filtered</p>
      </div>

      {/* JD Summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Role", value: jdData.required_title },
            { label: "Experience", value: `${jdData.required_years}+ years` },
            { label: "Domain", value: jdData.required_domain },
            { label: "Education", value: jdData.required_education },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</div>
              <div className="text-sm text-gray-800 font-semibold mt-0.5">{value || "N/A"}</div>
            </div>
          ))}
        </div>
        {jdData.jd_summary && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500 italic">
            {jdData.jd_summary}
          </div>
        )}
      </div>

      {/* Skill editing — primary + secondary */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-gray-800">Primary Skills</div>
              <div className="text-xs text-gray-400 mt-0.5">Must-have requirements</div>
            </div>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">{primarySkills.length}</span>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[4rem]">
            {primarySkills.map(s => (
              <EditableSkillTag key={s} skill={s} color="indigo"
                onRemove={sk => setPrimarySkills(p => p.filter(x => x !== sk))} />
            ))}
          </div>
          <AddSkillInput onAdd={s => setPrimarySkills(p => [...new Set([...p, s])])} placeholder="Add skill..." />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-gray-800">Secondary Skills</div>
              <div className="text-xs text-gray-400 mt-0.5">Good-to-have</div>
            </div>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">{secondarySkills.length}</span>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[4rem]">
            {secondarySkills.map(s => (
              <EditableSkillTag key={s} skill={s} color="gray"
                onRemove={sk => setSecondarySkills(p => p.filter(x => x !== sk))} />
            ))}
          </div>
          <AddSkillInput onAdd={s => setSecondarySkills(p => [...new Set([...p, s])])} placeholder="Add skill..." />
        </div>
      </div>

      {/* Skill Filter */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        {/* Header + AND/OR toggle */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-gray-800">Candidate Filter</div>
            <div className="text-xs text-gray-400 mt-0.5">
              Select which skills to filter by, then choose AND or OR
            </div>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            {["AND", "OR"].map(mode => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  filterMode === mode
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Mode description */}
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-4">
          {filterMode === "AND"
            ? "AND — candidates must have all selected skills to appear in results"
            : "OR — candidates must have at least one selected skill to appear in results"}
        </div>

        {/* All skills in one flat list */}
        {(primarySkills.length > 0 || secondarySkills.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {[...primarySkills, ...secondarySkills].map(skill => (
              <button
                key={skill}
                onClick={() => toggleFilterSkill(skill)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                  selectedFilterSkills.has(skill)
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {skill}
              </button>
            ))}
          </div>
        )}

        {selectedCount === 0 && (
          <div className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            No skills selected — filter is inactive, all candidates will pass through
          </div>
        )}

        {selectedCount > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
            {selectedCount} skill{selectedCount !== 1 ? "s" : ""} selected ·{" "}
            {filterMode === "AND"
              ? `candidates must have all ${selectedCount}`
              : `candidates must have at least 1 of ${selectedCount}`}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button onClick={onBack}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            ← Back
          </button>
          <button onClick={() => setShowFeedback(!showFeedback)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Re-run AI
          </button>
        </div>
        <button
          onClick={handleStart}
          disabled={primarySkills.length === 0}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
            primarySkills.length > 0
              ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          Start Screening
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>

      {showFeedback && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-sm font-medium text-gray-700 mb-2">What should AI focus on?</div>
          <div className="flex gap-2">
            <input
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="e.g. find more specific Teamcenter skills, include certification names"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder-gray-400"
            />
            <button onClick={handleRefine} disabled={refining}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50">
              {refining ? "Running..." : "Run"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
