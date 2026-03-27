const STEPS = [
  { number: 1, title: 'Daily Performance' },
  { number: 2, title: 'Search Terms' },
  { number: 3, title: 'Assets & Landing Pages' },
  { number: 4, title: 'Audience & Targeting' },
]

export default function ProgressBar({ currentStep, totalSteps = 4 }) {
  return (
    <div className="bg-[#242424] px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isCompleted = step.number < currentStep
            const isCurrent = step.number === currentStep
            const isUpcoming = step.number > currentStep

            return (
              <div key={step.number} className="flex items-center flex-1">
                {/* Step circle + label */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm border-2 transition-all ${
                      isCompleted
                        ? 'bg-[#575ECF] border-[#575ECF] text-white'
                        : isCurrent
                        ? 'bg-[#575ECF] border-[#575ECF] text-white'
                        : 'bg-[#333] border-[#333] text-[#8a8680]'
                    }`}
                    style={isCurrent ? { boxShadow: '0 0 0 3px rgba(87,94,207,0.25)' } : {}}
                  >
                    {isCompleted ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </div>
                  <span
                    className={`mt-1.5 text-xs font-medium text-center max-w-[90px] leading-tight ${
                      isCompleted
                        ? 'text-[#575ECF]'
                        : isCurrent
                        ? 'text-[#c5c1b9]'
                        : 'text-[#8a8680]'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>

                {/* Connector line (not after last step) */}
                {index < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-3 mt-[-18px]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ backgroundColor: step.number < currentStep ? '#575ECF' : '#333' }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
