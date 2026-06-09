import { useState } from "react";
import { refineSkills } from "../api/screenerAPI";

function SkillChip({ skill, required, onToggleRequired, onRemove }) {
  return (
    <span className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 text-xs font-medium rounded-full border transition-all ${
      required
        ? "bg-indigo-600 text-white border-indigo-600"
        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
    }`}>
      <button
        onClick={() => onToggleRequired(skill)}
        title={required ? "Required — click to make optional" : "Optional — click to make required"}
        className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 transition-colors ${
          required ? "bg-white text-indigo-600" : "bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-600"
        }`}
      >
        {required ? "R" : "O"}
      </button>
      {skill}
      <button
        onClick={() => onRemove(skill)}
        className={`ml-0.5 opacity-60 hover:opacity-100 transition-opacity ${required ? "text-indigo-200 hover:text-white" : "text-gray-400 hover:text-red-500"}`}
      >
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
      <button
        onClick={submit}
        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium transition-colors"
      >
        Add
      </button>
    </div>
  );
}

export default function SkillsReviewStep({ jdData, onBack, onNext }) {
  const [primarySkills, setPrimarySkills] = useState(jdData.primary_skills || []);
  const [secondarySkills, setSecondarySkills] = useState(jdData.secondary_skills || []);
  const [requiredSkills, setRequiredSkills] = useState(
    new Set(jdData.primary_skills || [])
  );
  const [threshold, setThreshold] = useState(2);
  const [refining, setRefining] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  const toggleRequired = (skill) => {
    setRequiredSkills(prev => {
      const next = new Set(prev);
      next.has(skill) ? next.delete(skill) : next.add(skill);
      return next;
    });
  };

  const removeSkill = (skill, isPrimary) => {
    if (isPrimary) {
      setPrimarySkills(p => p.filter(s => s !== skill));
    } else {
      setSecondarySkills(p => p.filter(s => s !== skill));
    }
    setRequiredSkills(prev => {
      const next = new Set(prev);
      next.delete(skill);
      return next;
    });
  };

  const addPrimary = (skill) => {
    setPrimarySkills(p => [...new Set([...p, skill])]);
    setRequiredSkills(prev => new Set([...prev, skill]));
  };

  const addSecondary = (skill) => {
    setSecondarySkills(p => [...new Set([...p, skill])]);
  };

  const handleRefine = async () => {
    setRefining(true);
    try {
      const result = await refineSkills(jdData.jd_text, feedback || "find more specific technical skills");
      const newPrimary = result.primary_skills || [];
      const newSecondary = result.secondary_skills || [];
      setPrimarySkills(newPrimary);
      setSecondarySkills(newSecondary);
      setRequiredSkills(new Set(newPrimary));
      setShowFeedback(false);
      setFeedback("");
    } catch (e) {
      console.error(e);
    } finally {
      setRefining(false);
    }
  };

  const requiredCount = requiredSkills.size;
  const clampedThreshold = Math.min(threshold, Math.max(requiredCount, 1));

  const handleStart = () => {
    onNext({
      primarySkills,
      secondarySkills,
      requiredSkills: [...requiredSkills],
      threshold: clampedThreshold,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configure Skill Requirements</h1>
        <p className="text-gray-500 mt-1">
          Toggle each skill as <span className="font-medium text-indigo-600">Required (R)</span> or <span className="font-medium text-gray-500">Optional (O)</span> — primary skills default to Required
        </p>
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

      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Primary Skills */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-gray-800">Primary Skills</div>
              <div className="text-xs text-gray-400 mt-0.5">Core technical requirements</div>
            </div>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
              {primarySkills.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[4rem]">
            {primarySkills.map(s => (
              <SkillChip
                key={s}
                skill={s}
                required={requiredSkills.has(s)}
                onToggleRequired={toggleRequired}
                onRemove={() => removeSkill(s, true)}
              />
            ))}
          </div>
          <AddSkillInput onAdd={addPrimary} placeholder="Add primary skill..." />
        </div>

        {/* Secondary Skills */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-gray-800">Secondary Skills</div>
              <div className="text-xs text-gray-400 mt-0.5">Good-to-have — toggle R to make required</div>
            </div>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
              {secondarySkills.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[4rem]">
            {secondarySkills.map(s => (
              <SkillChip
                key={s}
                skill={s}
                required={requiredSkills.has(s)}
                onToggleRequired={toggleRequired}
                onRemove={() => removeSkill(s, false)}
              />
            ))}
          </div>
          <AddSkillInput onAdd={addSecondary} placeholder="Add secondary skill..." />
        </div>
      </div>

      {/* Required Skills Filter */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-800">Candidate Filter</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {requiredCount === 0
                ? "No required skills set — all candidates will pass"
                : `${requiredCount} skill${requiredCount !== 1 ? "s" : ""} marked as Required`}
            </div>
          </div>

          {requiredCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Must match at least</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setThreshold(t => Math.max(1, t - 1))}
                  className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center font-bold transition-colors"
                >−</button>
                <span className="w-8 text-center font-bold text-indigo-600">{clampedThreshold}</span>
                <button
                  onClick={() => setThreshold(t => Math.min(requiredCount, t + 1))}
                  className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center font-bold transition-colors"
                >+</button>
              </div>
              <span>required skill{clampedThreshold !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {requiredCount > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-1.5">
            {[...requiredSkills].map(s => (
              <span key={s} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => setShowFeedback(!showFeedback)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
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
            <button
              onClick={handleRefine}
              disabled={refining}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {refining ? "Running..." : "Run"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
