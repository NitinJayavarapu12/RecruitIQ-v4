const STEPS = [
  { num: 1, label: "Upload JD" },
  { num: 2, label: "Review Skills" },
  { num: 3, label: "Screening" },
  { num: 4, label: "Results" },
];

export default function StepIndicator({ currentStep, onStepClick, canGoToStep, isScreening }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map(({ num, label }, idx) => {
        const clickable = canGoToStep(num) && !isScreening;
        const done = currentStep > num;
        const active = currentStep === num;

        return (
          <div key={num} className="flex items-center gap-2">
            <button
              onClick={() => clickable && onStepClick(num)}
              disabled={!clickable}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                active
                  ? "bg-indigo-600 text-white"
                  : done
                  ? "bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer"
                  : clickable
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer"
                  : "bg-gray-50 text-gray-400 cursor-not-allowed"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                active ? "bg-white text-indigo-600 font-bold"
                : done ? "bg-green-500 text-white"
                : "bg-gray-300 text-gray-500"
              }`}>
                {done ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : num}
              </span>
              {label}
            </button>
            {idx < STEPS.length - 1 && (
              <div className={`w-8 h-px ${done ? "bg-green-300" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
