import { useState, useRef } from "react";
import { analyzeJDFile, analyzeJDText, analyzeJDUrl } from "../api/screenerAPI";

const INPUT_METHODS = [
  { id: "file", label: "Upload File", icon: "📄" },
  { id: "paste", label: "Paste Text", icon: "📋" },
  { id: "url", label: "Job URL", icon: "🔗" },
];

const TOP_N_OPTIONS = [10, 25, 50, 100];

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
    const files = Array.from(e.dataTransfer.files).filter(f =>
      /\.(pdf|docx|doc)$/i.test(f.name)
    );
    if (files.length) setResumeFiles(prev => [...prev, ...files].slice(0, 400));
  };

  const handleResumeSelect = (e) => {
    const files = Array.from(e.target.files).filter(f =>
      /\.(pdf|docx|doc)$/i.test(f.name)
    );
    setResumeFiles(prev => [...prev, ...files].slice(0, 400));
  };

  const removeResume = (idx) => {
    setResumeFiles(prev => prev.filter((_, i) => i !== idx));
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
      onNext({ ...data, jd_file: jdFile }, resumeFiles, topN);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to analyze JD. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Start New Screening</h1>
        <p className="text-gray-500 mt-1">Upload a job description and resumes to begin AI-powered screening</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* JD Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
            Job Description
          </h2>

          {/* Method tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4">
            {INPUT_METHODS.map(m => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                  method === m.id
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>{m.icon}</span> {m.label}
              </button>
            ))}
          </div>

          {/* File upload */}
          {method === "file" && (
            <div
              onDragOver={e => { e.preventDefault(); setJdDragOver(true); }}
              onDragLeave={() => setJdDragOver(false)}
              onDrop={handleJdDrop}
              onClick={() => jdInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                jdDragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input ref={jdInputRef} type="file" accept=".pdf,.docx,.doc" className="hidden"
                onChange={e => e.target.files[0] && setJdFile(e.target.files[0])} />
              {jdFile ? (
                <div className="text-sm">
                  <div className="text-indigo-600 font-medium">{jdFile.name}</div>
                  <div className="text-gray-400 text-xs mt-1">{(jdFile.size / 1024).toFixed(1)} KB</div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl mb-2">📄</div>
                  <div className="text-sm text-gray-600">Drop PDF or DOCX here</div>
                  <div className="text-xs text-gray-400 mt-1">or click to browse</div>
                </div>
              )}
            </div>
          )}

          {/* Paste text */}
          {method === "paste" && (
            <textarea
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              placeholder="Paste the full job description here..."
              className="w-full h-40 text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 placeholder-gray-400"
            />
          )}

          {/* URL input */}
          {method === "url" && (
            <div className="space-y-3">
              <input
                type="url"
                value={jdUrl}
                onChange={e => setJdUrl(e.target.value)}
                placeholder="https://www.linkedin.com/jobs/view/..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 placeholder-gray-400"
              />
              <div className="text-xs text-gray-400 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                ⚠️ LinkedIn and Naukri may block scraping. If it fails, paste the text manually.
              </div>
            </div>
          )}
        </div>

        {/* Resumes Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
            Resumes
            {resumeFiles.length > 0 && (
              <span className="ml-2 text-indigo-600 normal-case font-normal">
                ({resumeFiles.length} files)
              </span>
            )}
          </h2>

          <div
            onDragOver={e => { e.preventDefault(); setResumeDragOver(true); }}
            onDragLeave={() => setResumeDragOver(false)}
            onDrop={handleResumeDrop}
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors mb-3 ${
              resumeDragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-200"
            }`}
          >
            <div className="text-xl mb-1">📂</div>
            <div className="text-sm text-gray-600">Drop PDF/DOCX files or folder</div>
            <div className="text-xs text-gray-400 mt-1">Up to 400 files</div>
          </div>

          <div className="flex gap-2 mb-3">
            <button onClick={() => resumeInputRef.current?.click()}
              className="flex-1 text-xs border border-gray-200 rounded-lg py-2 text-gray-600 hover:bg-gray-50 transition-colors">
              Select Files
            </button>
            <button onClick={() => resumeFolderRef.current?.click()}
              className="flex-1 text-xs border border-gray-200 rounded-lg py-2 text-gray-600 hover:bg-gray-50 transition-colors">
              Select Folder
            </button>
          </div>

          <input ref={resumeInputRef} type="file" multiple accept=".pdf,.docx,.doc"
            className="hidden" onChange={handleResumeSelect} />
          <input ref={resumeFolderRef} type="file" multiple accept=".pdf,.docx,.doc"
            webkitdirectory="" className="hidden" onChange={handleResumeSelect} />

          {resumeFiles.length > 0 && (
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="max-h-32 overflow-y-auto">
                {resumeFiles.slice(0, 50).map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <span className="text-xs text-gray-600 truncate flex-1">{f.name}</span>
                    <button onClick={() => removeResume(i)} className="text-gray-300 hover:text-red-400 ml-2 flex-shrink-0">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {resumeFiles.length > 50 && (
                  <div className="px-3 py-1.5 text-xs text-gray-400 text-center">
                    +{resumeFiles.length - 50} more files
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top N + Submit */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">Top candidates to screen</div>
            <div className="flex gap-2">
              {TOP_N_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => setTopN(n)}
                  className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                    topN === n
                      ? "bg-indigo-600 text-white"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-xs text-right">
                {error}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit() || loading}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
                canSubmit() && !loading
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
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
                <>Analyze JD <span className="text-indigo-300">→</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
