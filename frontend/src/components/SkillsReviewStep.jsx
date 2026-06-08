import { useState } from "react";
import { refineSkills } from "../api/screenerAPI";

function SkillTag({ skill, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-200">
      {skill}
      <button onClick={() => onRemove(skill)} className="hover:text-red-500 transition-colors ml-0.5">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

function SecondarySkillTag({ skill, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 text-gray-600 text-xs font-medium rounded-full border border-gray-200">
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
    <div className="flex gap-1.5 mt-2">
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder={placeholder}
        className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder-gray-400"
      />
      <button onClick={submit}
        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors">
        Add
      </button>
    </div>
  );
}

export default function SkillsReviewStep({ jdData, onBack, onNext }) {
  const [primarySkills, setPrimarySkills] = useState(jdData.primary_skills || []);
  const [secondarySkills, setSecondarySkills] = useState(jdData.secondary_skills || []);
  const [matchMode, setMatchMode] = useState("OR");
  const [refining, setRefining] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  const handleRefine = async () => {
    setRefining(true);
    try {
      const result = await refineSkills(jdData.jd_text, feedback || "find more specific technical skills");
      setPrimarySkills(result.primary_skills || []);
      setSecondarySkills(result.secondary_skills || []);
      setShowFeedback(false);
      setFeedback("");
    } catch (e) {
      console.error(e);
    } finally {
      setRefining(false);
    }
  };

  const handleStart = () => {
    onNext({ primarySkills, secondarySkills, matchMode });
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Review Extracted Skills</h1>
        <p className="text-gray-500 mt-1">Edit the skills below before screening begins</p>
      </div>

      {/* JD Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Role", value: jdData.required_title },
            { label: "Experience", value: `${jdData.required_years}+ years` },
            { label: "Domain", value: jdData.required_domain },
            { label: "Education", value: jdData.required_education },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</div>
              <div className="text-sm text-gray-800 font-medium mt-0.5">{value || "N/A"}</div>
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
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-gray-800">Primary Skills</div>
              <div className="text-xs text-gray-400">Must-have requirements</div>
            </div>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              {primarySkills.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 min-h-16">
            {primarySkills.map(s => (
              <SkillTag key={s} skill={s} onRemove={sk => setPrimarySkills(p => p.filter(x => x !== sk))} />
            ))}
          </div>
          <AddSkillInput
            onAdd={s => setPrimarySkills(p => [...new Set([...p, s])])}
            placeholder="Add skill..."
          />
        </div>

        {/* Secondary Skills */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-gray-800">Secondary Skills</div>
              <div className="text-xs text-gray-400">Good-to-have</div>
            </div>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
              {secondarySkills.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 min-h-16">
            {secondarySkills.map(s => (
              <SecondarySkillTag key={s} skill={s} onRemove={sk => setSecondarySkills(p => p.filter(x => x !== sk))} />
            ))}
          </div>
          <AddSkillInput
            onAdd={s => setSecondarySkills(p => [...new Set([...p, s])])}
            placeholder="Add skill..."
          />
        </div>
      </div>

      {/* Match Mode */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="text-sm font-semibold text-gray-800 mb-3">Skill Matching Mode</div>
        <div className="flex gap-3">
          <button
            onClick={() => setMatchMode("AND")}
            className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
              matchMode === "AND"
                ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            <div className="font-bold text-base mb-0.5">AND</div>
            <div className="text-xs opacity-70">Candidate must have ALL primary skills</div>
          </button>
          <button
            onClick={() => setMatchMode("OR")}
            className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
              matchMode === "OR"
                ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            <div className="font-bold text-base mb-0.5">OR</div>
            <div className="text-xs opacity-70">Candidate needs at least ONE primary skill</div>
          </button>
        </div>
      </div>

      {/* Refine + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button onClick={onBack}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            ← Back
          </button>
          <button
            onClick={() => setShowFeedback(!showFeedback)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            🔄 Re-run AI
          </button>
        </div>

        <button
          onClick={handleStart}
          disabled={primarySkills.length === 0}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
            primarySkills.length > 0
              ? "bg-indigo-600 hover:bg-indigo-700 text-white"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          Start Screening →
        </button>
      </div>

      {showFeedback && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4">
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
