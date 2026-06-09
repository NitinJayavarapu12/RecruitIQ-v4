import { useEffect, useRef, useState } from "react";
import { startScreening, subscribeToProgress, getResults } from "../api/screenerAPI";

export default function ScreeningStep({ jdData, skillsData, resumeFiles, topN, onDone }) {
  const [status, setStatus] = useState("starting");
  const [phase, setPhase] = useState("Initializing...");
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [error, setError] = useState("");
  const esRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    kickOff();
    return () => esRef.current?.close();
  }, []);

  const kickOff = async () => {
    try {
      const { job_id } = await startScreening({
        jdFile: jdData?.jd_file || null,
        resumeFiles,
        topN,
        primarySkills: skillsData?.primarySkills || [],
        secondarySkills: skillsData?.secondarySkills || [],
        jdTextOverride: jdData?.jd_text || "",
        requiredSkills: skillsData?.requiredSkills || [],
        requiredThreshold: skillsData?.threshold ?? 2,
      });

      setStatus("running");
      esRef.current = subscribeToProgress(job_id, async (update) => {
        setPhase(update.phase || "");
        setProgress(update.progress || 0);
        setTotal(update.total || 0);
        setCurrentFile(update.current_file || "");

        if (update.status === "complete") {
          esRef.current?.close();
          setStatus("complete");
          const data = await getResults(job_id);
          onDone(job_id, data.results || []);
        } else if (update.status === "error") {
          esRef.current?.close();
          setStatus("error");
          setError(update.error || "An error occurred during screening.");
        }
      });
    } catch (e) {
      setStatus("error");
      setError(e.response?.data?.detail || e.message || "Failed to start screening.");
    }
  };

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto px-8 py-16">
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        {status === "error" ? (
          <div className="text-center">
            <div className="text-4xl mb-4">❌</div>
            <div className="text-lg font-semibold text-gray-900 mb-2">Screening Failed</div>
            <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="animate-spin w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
              <div>
                <div className="text-base font-semibold text-gray-900">Screening in progress</div>
                <div className="text-sm text-gray-500">{phase}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>{progress} / {total} resumes</span>
                <span>{pct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {currentFile && (
              <div className="text-xs text-gray-400 truncate">
                Processing: {currentFile}
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-100 text-xs text-gray-400 text-center">
              Do not close this tab — screening is in progress
            </div>
          </>
        )}
      </div>
    </div>
  );
}
