import { Link } from 'react-router-dom'

export default function ModuleCard({ href, icon, title, description, accentColor, accentAlpha, tags }) {
  return (
    <Link
      to={href}
      className="group block rounded-2xl p-8 transition-all duration-200 relative overflow-hidden"
      style={{
        backgroundColor: '#242424',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = accentAlpha
        e.currentTarget.style.boxShadow = `0 0 50px ${accentAlpha}, 0 20px 40px rgba(0,0,0,0.3)`
        e.currentTarget.style.transform = 'translateY(-4px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Subtle gradient glow in top corner */}
      <div
        className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${accentAlpha} 0%, transparent 70%)`,
          transform: 'translate(30%, -30%)',
        }}
      />

      {/* Icon */}
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-6"
        style={{ backgroundColor: `${accentColor}18`, border: `1px solid ${accentColor}30` }}
      >
        {icon}
      </div>

      {/* Title */}
      <h2 className="text-xl font-bold text-[#c5c1b9] mb-3 group-hover:text-white transition-colors">
        {title}
      </h2>

      {/* Description */}
      <p className="text-[#8a8680] text-sm leading-relaxed mb-6">
        {description}
      </p>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {tags.map(tag => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#8a8680' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

    </Link>
  )
}
