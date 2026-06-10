import { useState, useRef } from "react";
import { analyzeJDFile, analyzeJDText, analyzeJDUrl } from "../api/screenerAPI";

const TOP_N_OPTIONS = [10, 25, 50, 100];

function UploadIcon() {
  return (
    <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

export default function JDInputStep({ onNext }) {
  const [method, setMethod] = useState("file");
  const [jdFile, setJdFile] = useState(null);
  const [jdText, setJdText] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [resumeFiles, setResumeFiles] = useState([]);
  const [topN, setTopN] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jdDragOver, setJdDragOver] = useState(false);
  const [resumeDragOver, setResumeDragOver] = useState(false);

  const jdInputRef = useRef();
  const resumeInputRef = useRef();
  const resumeFolderRef = useRef();

  const handleJdDrop = (e) => {
    e.preventDefault();
    setJdDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) { setJdFile(file); setMethod("file"); }
  };

  const handleResumeDrop = (e) => {
    e.preventDefault();
    setResumeDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => /\.(pdf|docx|doc)$/i.test(f.name));
    if (files.length) setResumeFiles(prev => [...prev, ...files].slice(0, 400));
  };

  const handleResumeSelect = (e) => {
    const files = Array.from(e.target.files).filter(f => /\.(pdf|docx|doc)$/i.test(f.name));
    setResumeFiles(prev => [...prev, ...files].slice(0, 400));
  };

  const canSubmit = () => {
    if (resumeFiles.length === 0) return false;
    if (method === "file") return !!jdFile;
    if (method === "paste") return jdText.trim().length > 50;
    if (method === "url") return jdUrl.trim().length > 10;
    return false;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    setLoading(true);
    setError("");
    try {
      let data;
      if (method === "file") data = await analyzeJDFile(jdFile);
      else if (method === "paste") data = await analyzeJDText(jdText);
      else data = await analyzeJDUrl(jdUrl);
      onNext({ ...data, jd_file: jdFile, jd_text: jdText }, resumeFiles, topN);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to analyze JD. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    {
      id: "file", label: "Upload File",
      icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
    },
    {
      id: "paste", label: "Paste Text",
      icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
    },
    {
      id: "url", label: "Job URL",
      icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="px-8 pt-7 pb-5">
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">New Screening</h1>
        <p className="text-sm text-slate-500 mt-1">Upload a job description and candidate resumes to begin AI-powered screening.</p>
      </div>

      <div className="flex-1 px-8 pb-8 overflow-y-auto">
        <div className="grid grid-cols-2 gap-5 mb-5">
          {/* JD card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-slate-100">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Job Description</div>
            </div>
            <div className="p-5">
              {/* Method tabs */}
              <div className="flex gap-1 bg-slate-50 p-1 rounded-lg mb-4 border border-slate-100">
                {tabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setMethod(t.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                      method === t.id
                        ? "bg-white text-slate-800 shadow-sm border border-slate-200"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {method === "file" && (
                <div
                  onDragOver={e => { e.preventDefault(); setJdDragOver(true); }}
                  onDragLeave={() => setJdDragOver(false)}
                  onDrop={handleJdDrop}
                  onClick={() => jdInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    jdDragOver
                      ? "border-indigo-400 bg-indigo-50"
                      : jdFile
                      ? "border-indigo-300 bg-indigo-50/50"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <input ref={jdInputRef} type="file" accept=".pdf,.docx,.doc" className="hidden"
                    onChange={e => e.target.files[0] && setJdFile(e.target.files[0])} />
                  {jdFile ? (
                    <div>
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="text-sm font-medium text-indigo-700">{jdFile.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{(jdFile.size / 1024).toFixed(1)} KB · Click to change</div>
                    </div>
                  ) : (
                    <div>
                      <UploadIcon />
                      <div className="text-sm font-medium text-slate-600 mt-2">Drop PDF or DOCX here</div>
                      <div className="text-xs text-slate-400 mt-1">or click to browse</div>
                    </div>
                  )}
                </div>
              )}

              {method === "paste" && (
                <textarea
                  value={jdText}
                  onChange={e => setJdText(e.target.value)}
                  placeholder="Paste the full job description here..."
                  className="w-full h-44 text-sm border border-slate-200 rounded-xl p-3.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent text-slate-700 placeholder-slate-300 bg-slate-50/50"
                />
              )}

              {method === "url" && (
                <div className="space-y-3">
                  <input
                    type="url"
                    value={jdUrl}
                    onChange={e => setJdUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/jobs/view/..."
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent text-slate-700 placeholder-slate-300"
                  />
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    LinkedIn and Naukri may block scraping. If it fails, paste the text manually.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resumes card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Resumes</div>
              {resumeFiles.length > 0 && (
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {resumeFiles.length} files
                </span>
              )}
            </div>
            <div className="p-5">
              <div
                onDragOver={e => { e.preventDefault(); setResumeDragOver(true); }}
                onDragLeave={() => setResumeDragOver(false)}
                onDrop={handleResumeDrop}
                className={`border-2 border-dashed rounded-xl p-5 text-center transition-all mb-3 ${
                  resumeDragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200"
                }`}
              >
                <FolderIcon />
                <div className="text-sm font-medium text-slate-600 mt-2">Drop PDF/DOCX files or folder</div>
                <div className="text-xs text-slate-400 mt-1">Up to 400 files</div>
              </div>

              <div className="flex gap-2 mb-3">
                <button onClick={() => resumeInputRef.current?.click()}
                  className="flex-1 text-xs border border-slate-200 rounded-lg py-2 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors font-medium">
                  Select Files
                </button>
                <button onClick={() => resumeFolderRef.current?.click()}
                  className="flex-1 text-xs border border-slate-200 rounded-lg py-2 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors font-medium">
                  Select Folder
                </button>
              </div>
              <input ref={resumeInputRef} type="file" multiple accept=".pdf,.docx,.doc" className="hidden" onChange={handleResumeSelect} />
              <input ref={resumeFolderRef} type="file" multiple accept=".pdf,.docx,.doc" webkitdirectory="" className="hidden" onChange={handleResumeSelect} />

              {resumeFiles.length > 0 && (
                <div className="rounded-lg border border-slate-100 overflow-hidden">
                  <div className="max-h-36 overflow-y-auto">
                    {resumeFiles.slice(0, 80).map((f, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 group">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                          <span className="text-xs text-slate-600 truncate">{f.name}</span>
                        </div>
                        <button onClick={() => setResumeFiles(p => p.filter((_, j) => j !== i))}
                          className="text-slate-200 hover:text-red-400 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {resumeFiles.length > 80 && (
                      <div className="px-3 py-2 text-xs text-slate-400 text-center bg-slate-50">
                        +{resumeFiles.length - 80} more files loaded
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar: Top N + Submit */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Top candidates to screen</div>
                <div className="flex gap-1.5">
                  {TOP_N_OPTIONS.map(n => (
                    <button
                      key={n}
                      onClick={() => setTopN(n)}
                      className={`px-3.5 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                        topN === n
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-xs text-right">
                  {error}
                </div>
              )}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit() || loading}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm ${
                  canSubmit() && !loading
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Analyzing JD...
                  </>
                ) : (
                  <>
                    Analyze JD
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
