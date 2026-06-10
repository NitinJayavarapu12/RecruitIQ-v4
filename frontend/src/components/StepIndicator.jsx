const STEPS = [
  { num: 1, label: "Upload JD" },
  { num: 2, label: "Review Skills" },
  { num: 3, label: "Screening" },
  { num: 4, label: "Results" },
];

export default function StepIndicator({ currentStep, onStepClick, canGoToStep, isScreening }) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map(({ num, label }, idx) => {
        const clickable = canGoToStep(num) && !isScreening;
        const done = currentStep > num;
        const active = currentStep === num;

        return (
          <div key={num} className="flex items-center">
            <button
              onClick={() => clickable && onStepClick(num)}
              disabled={!clickable}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : done && clickable
                  ? "text-slate-500 hover:bg-slate-100 cursor-pointer"
                  : done
                  ? "text-slate-500"
                  : "text-slate-300 cursor-not-allowed"
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                active
                  ? "bg-white/25 text-white font-bold"
                  : done
                  ? "bg-indigo-100 text-indigo-600"
                  : "bg-slate-100 text-slate-400"
              }`}>
                {done ? (
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : num}
              </span>
              {label}
            </button>

            {idx < STEPS.length - 1 && (
              <div className={`w-6 h-px mx-1 ${
                currentStep > num ? "bg-indigo-200" : "bg-slate-200"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
