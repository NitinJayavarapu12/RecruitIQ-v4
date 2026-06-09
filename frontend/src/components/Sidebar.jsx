export default function Sidebar({ onNewScreening, currentStep }) {
  return (
    <div className="w-64 bg-navy-900 bg-gray-900 flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <div>
            <div className="text-white font-semibold text-sm">RecruitIQ</div>
            <div className="text-gray-400 text-xs">v4.0</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        <button
          onClick={onNewScreening}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Screening
        </button>

        <div className="pt-4">
          <div className="text-gray-500 text-xs font-medium uppercase tracking-wider px-3 mb-2">
            Current Session
          </div>
          {[
            { num: 1, label: "Upload JD" },
            { num: 2, label: "Review Skills" },
            { num: 3, label: "Screening" },
            { num: 4, label: "Results" },
          ].map(({ num, label }) => (
            <div
              key={num}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                currentStep === num
                  ? "bg-gray-700 text-white"
                  : currentStep > num
                  ? "text-gray-400"
                  : "text-gray-600"
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                currentStep > num
                  ? "bg-green-500 text-white"
                  : currentStep === num
                  ? "bg-indigo-500 text-white"
                  : "bg-gray-700 text-gray-500"
              }`}>
                {currentStep > num ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : num}
              </div>
              {label}
            </div>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-700">
        <div className="text-gray-500 text-xs">AI Engine: Groq · Llama 3.3</div>
      </div>
    </div>
  );
}
