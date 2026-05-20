import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface Props {
  children: React.ReactNode
  roles?: string[]
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (roles && !roles.some(r => user.roles.includes(r))) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
