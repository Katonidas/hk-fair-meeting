import { USERS } from '@/lib/constants'
import type { UserName } from '@/types'

interface Props {
  onSelect: (user: UserName) => void
}

export default function UserSelect({ onSelect }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-light p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary">HK Fair Meeting</h1>
          <p className="mt-2 text-gray-500">APPROX — HK Sources 2026</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-md">
          <h2 className="mb-4 text-center text-lg font-semibold text-gray-700">
            ¿Quién eres?
          </h2>
          <div className="flex flex-col gap-3">
            {USERS.map(user => (
              <button
                key={user}
                onClick={() => onSelect(user)}
                className="rounded-lg bg-primary px-6 py-4 text-lg font-medium text-white transition-colors hover:bg-primary-light active:bg-primary-dark"
              >
                {user}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
