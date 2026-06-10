import { useEffect, useRef, useState } from "react";
import { startScreening, subscribeToProgress, getResults } from "../api/screenerAPI";

const PHASES = [
  { key: "parse", label: "Parsing Resumes", desc: "Extracting text from PDF/DOCX files" },
  { key: "rank",  label: "Keyword Ranking", desc: "Shortlisting top candidates by keyword match" },
  { key: "score", label: "AI Scoring",      desc: "Deep evaluation by Groq Llama 3.1 8B" },
];

function phaseIndex(phaseText) {
  const t = (phaseText || "").toLowerCase();
  if (t.includes("phase 2") || t.includes("ai scoring") || t.includes("groq")) return 2;
  if (t.includes("phase 1.5") || t.includes("keyword") || t.includes("ranking")) return 1;
  return 0;
}

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
        filterSkills: skillsData?.filterSkills || [],
        filterMode: skillsData?.filterMode || "OR",
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
  const activePhase = phaseIndex(phase);

  if (status === "error") {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="text-lg font-semibold text-slate-900 mb-2">Screening Failed</div>
          <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3 border border-red-100">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-slate-50/50">
      <div className="w-full max-w-lg px-6">
        {/* Main card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Top accent */}
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400" />

          <div className="p-8">
            {/* Spinner + title */}
            <div className="flex items-center gap-4 mb-8">
              <div className="relative w-12 h-12 flex-shrink-0">
                <svg className="animate-spin w-12 h-12 text-indigo-500" fill="none" viewBox="0 0 48 48">
                  <circle className="opacity-10" cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-80" fill="none" stroke="currentColor" strokeWidth="4"
                    strokeLinecap="round" d="M24 4 a20 20 0 0 1 20 20" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-indigo-500" />
                </div>
              </div>
              <div>
                <div className="text-base font-semibold text-slate-900">Screening in progress</div>
                <div className="text-sm text-slate-400 mt-0.5">{phase || "Initializing pipeline..."}</div>
              </div>
            </div>

            {/* Phase steps */}
            <div className="mb-6">
              {PHASES.map((p, i) => {
                const done = activePhase > i;
                const active = activePhase === i && status === "running";
                return (
                  <div key={p.key} className="flex items-start gap-3 mb-4 last:mb-0">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        done
                          ? "bg-indigo-500"
                          : active
                          ? "bg-indigo-100 ring-2 ring-indigo-400 ring-offset-1"
                          : "bg-slate-100"
                      }`}>
                        {done ? (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : active ? (
                          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-slate-300" />
                        )}
                      </div>
                      {i < PHASES.length - 1 && (
                        <div className={`w-px h-4 ml-2.5 mt-0.5 ${done ? "bg-indigo-300" : "bg-slate-100"}`} />
                      )}
                    </div>
                    <div className="pb-4 last:pb-0">
                      <div className={`text-sm font-medium ${
                        done ? "text-slate-400 line-through" : active ? "text-slate-900" : "text-slate-300"
                      }`}>
                        {p.label}
                      </div>
                      {active && (
                        <div className="text-xs text-slate-400 mt-0.5">{p.desc}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            {total > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>{progress} / {total} resumes</span>
                  <span className="font-medium text-slate-600">{pct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
              </div>
            )}

            {currentFile && (
              <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                <div className="text-xs text-slate-400 mb-0.5">Processing</div>
                <div className="text-xs text-slate-600 truncate font-medium">{currentFile}</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-3 bg-slate-50 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs text-slate-400">Do not close this tab — screening is in progress</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
