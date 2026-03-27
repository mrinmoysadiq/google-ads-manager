const STEPS = [
  { number: 1, title: 'Spend & Conversions' },
  { number: 2, title: 'Keyword Analysis' },
  { number: 3, title: 'Ad Copy Review' },
  { number: 4, title: 'Audience & Targeting' },
]

export default function ProgressBar({ currentStep, totalSteps = 4 }) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-4">
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
                        ? 'bg-green-500 border-green-500 text-white'
                        : isCurrent
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
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
                        ? 'text-green-600'
                        : isCurrent
                        ? 'text-blue-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>

                {/* Connector line (not after last step) */}
                {index < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-3 mt-[-18px]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        step.number < currentStep ? 'bg-green-400' : 'bg-gray-200'
                      }`}
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
