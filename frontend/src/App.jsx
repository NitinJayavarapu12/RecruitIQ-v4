import { useState, useEffect } from "react";
import { pingBackend } from "./api/screenerAPI";
import Sidebar from "./components/Sidebar";
import StepIndicator from "./components/StepIndicator";
import JDInputStep from "./components/JDInputStep";
import SkillsReviewStep from "./components/SkillsReviewStep";
import ScreeningStep from "./components/ScreeningStep";
import ResultsStep from "./components/ResultsStep";

export default function App() {
  const [step, setStep] = useState(1);
  const [jdData, setJdData] = useState(null);
  const [skillsData, setSkillsData] = useState(null);
  const [resumeFiles, setResumeFiles] = useState([]);
  const [topN, setTopN] = useState(25);
  const [jobId, setJobId] = useState(null);
  const [results, setResults] = useState(null);

  useEffect(() => { pingBackend(); }, []);

  const canGoToStep = (target) => {
    if (target === 1) return true;
    if (target === 2) return !!jdData;
    if (target === 3) return false;
    if (target === 4) return !!results;
    return false;
  };

  const handleStepClick = (target) => {
    if (canGoToStep(target)) setStep(target);
  };

  const handleJDAnalyzed = (data, files, n) => {
    setJdData(data);
    setResumeFiles(files);
    setTopN(n);
    setStep(2);
  };

  const handleSkillsApproved = (skills) => {
    setSkillsData(skills);
    setStep(3);
  };

  const handleScreeningDone = (id, res) => {
    setJobId(id);
    setResults(res);
    setStep(4);
  };

  const handleNewScreening = () => {
    setStep(1);
    setJdData(null);
    setSkillsData(null);
    setResumeFiles([]);
    setTopN(25);
    setJobId(null);
    setResults(null);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar onNewScreening={handleNewScreening} currentStep={step} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar with step indicator */}
        <div className="bg-white border-b border-slate-200 px-8 py-3.5 flex-shrink-0">
          <StepIndicator
            currentStep={step}
            onStepClick={handleStepClick}
            canGoToStep={canGoToStep}
            isScreening={step === 3}
          />
        </div>

        {/* Step content — each step manages its own scroll */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {step === 1 && (
            <div className="flex-1 overflow-y-auto">
              <JDInputStep onNext={handleJDAnalyzed} />
            </div>
          )}
          {step === 2 && jdData && (
            <div className="flex-1 overflow-y-auto">
              <SkillsReviewStep
                jdData={jdData}
                onBack={() => setStep(1)}
                onNext={handleSkillsApproved}
              />
            </div>
          )}
          {step === 3 && (
            <div className="flex-1 overflow-hidden">
              <ScreeningStep
                jdData={jdData}
                skillsData={skillsData}
                resumeFiles={resumeFiles}
                topN={topN}
                onDone={handleScreeningDone}
              />
            </div>
          )}
          {step === 4 && results && (
            <div className="flex-1 overflow-hidden flex">
              <ResultsStep
                results={results}
                jobId={jobId}
                jdData={jdData}
                skillsData={skillsData}
                onNewScreening={handleNewScreening}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
