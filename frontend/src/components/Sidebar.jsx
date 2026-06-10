export default function Sidebar({ onNewScreening, currentStep }) {
  const steps = [
    { num: 1, label: "Upload JD" },
    { num: 2, label: "Review Skills" },
    { num: 3, label: "Screening" },
    { num: 4, label: "Results" },
  ];

  return (
    <div className="w-56 bg-slate-950 flex flex-col h-full border-r border-slate-800">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-500 rounded-md flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <div className="text-white font-semibold text-sm tracking-tight">RecruitIQ</div>
            <div className="text-slate-500 text-xs">AI Screening</div>
          </div>
        </div>
      </div>

      {/* New screening button */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={onNewScreening}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Screening
        </button>
      </div>

      {/* Steps */}
      <div className="flex-1 px-4 py-3">
        <div className="text-slate-600 text-xs font-medium uppercase tracking-widest mb-3 px-1">
          Current Session
        </div>
        <div className="space-y-0.5">
          {steps.map(({ num, label }) => {
            const done = currentStep > num;
            const active = currentStep === num;
            return (
              <div
                key={num}
                className={`flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors ${
                  active ? "bg-slate-800" : "hover:bg-slate-900"
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold transition-colors ${
                  done
                    ? "bg-indigo-500 text-white"
                    : active
                    ? "bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-800"
                    : "bg-slate-800 text-slate-500 border border-slate-700"
                }`}>
                  {done ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : num}
                </div>
                <span className={`text-xs font-medium ${
                  active ? "text-white" : done ? "text-slate-400" : "text-slate-600"
                }`}>
                  {label}
                </span>
                {active && (
                  <div className="ml-auto w-1 h-1 rounded-full bg-indigo-400" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-slate-500 text-xs">Groq · Llama 3.1 8B</span>
        </div>
      </div>
    </div>
  );
}
