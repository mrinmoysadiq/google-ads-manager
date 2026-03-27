import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getSession, completeSession } from '../utils/api'
import ProgressBar from '../components/ProgressBar'
import StickyHeader from '../components/StickyHeader'
import Slide1 from './slides/Slide1'
import Slide2 from './slides/Slide2'
import Slide3 from './slides/Slide3'
import Slide4 from './slides/Slide4'

export default function ChecklistWrapper() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [currentSlide, setCurrentSlide] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSession(sessionId)
      .then(sess => {
        setSession(sess)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        toast.error('Failed to load session')
        navigate('/')
      })
  }, [sessionId])

  const goNext = async () => {
    if (currentSlide < 4) {
      setCurrentSlide(prev => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // Complete session and navigate
      try {
        await completeSession(sessionId)
        toast.success('Session completed!')
        navigate(`/complete/${sessionId}`)
      } catch (err) {
        console.error(err)
        toast.error('Failed to complete session')
      }
    }
  }

  const goBack = () => {
    if (currentSlide > 1) {
      setCurrentSlide(prev => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-10 h-10 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-500 text-sm">Loading session...</p>
        </div>
      </div>
    )
  }

  const slideProps = {
    session,
    sessionId: parseInt(sessionId),
    onNext: goNext,
    onBack: goBack,
    isFirstSlide: currentSlide === 1,
    isLastSlide: currentSlide === 4,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ProgressBar currentStep={currentSlide} totalSteps={4} />
      <StickyHeader session={session} />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {currentSlide === 1 && <Slide1 {...slideProps} />}
        {currentSlide === 2 && <Slide2 {...slideProps} />}
        {currentSlide === 3 && <Slide3 {...slideProps} />}
        {currentSlide === 4 && <Slide4 {...slideProps} />}
      </div>
    </div>
  )
}
