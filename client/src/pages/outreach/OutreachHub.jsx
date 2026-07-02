import ModuleCard from '../../components/ModuleCard'

export default function OutreachHub() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#1b1b1b] flex flex-col items-center justify-center px-4 py-16">

      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-[#c5c1b9] mb-2">Outreach CRM</h1>
        <p className="text-[#8a8680] text-base tracking-wide">
          Choose a pipeline to work in.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl">

        {/* Cold Reach Out */}
        <ModuleCard
          href="/outreach/pipeline"
          accentColor="#e05d0a"
          accentAlpha="rgba(224,93,10,0.18)"
          title="Cold Reach Out"
          description="Track prospects through your cold outreach pipeline — manage touchpoints, monitor follow-ups, and measure conversion from first contact to closed client."
          tags={['Pipeline', 'Touchpoints', 'Dashboard']}
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#e05d0a" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />

        {/* LinkedIn Tracker */}
        <ModuleCard
          href="/outreach/linkedin"
          accentColor="#0a66c2"
          accentAlpha="rgba(10,102,194,0.18)"
          title="LinkedIn Tracker"
          description="Track LinkedIn connection outreach — log likes and comments on leads' posts, watch warm-up progress, and follow up at the right time."
          tags={['Engagement Log', 'Pipeline', 'Dashboard']}
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#0a66c2" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
              <circle cx="4" cy="4" r="2" />
            </svg>
          }
        />
      </div>
    </div>
  )
}
