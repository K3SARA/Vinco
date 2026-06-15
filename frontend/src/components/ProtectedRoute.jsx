import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-wood-300 border-t-wood-600" />
          <p className="text-sm font-medium text-stone-500">Loading Vinco billing system...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-red-100 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
              stroke="currentColor"
              className="h-8 w-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-stone-850">Access denied</h2>
          <p className="mt-2 text-sm text-stone-500">
            Your user account ({user.role}) is not authorized to access this module. Contact the system administrator.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex w-full justify-center rounded-lg bg-wood-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-wood-750"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return children;
}
