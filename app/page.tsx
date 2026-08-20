import { Dashboard } from "@/components/dashboard"
import { AuthGate } from "@/components/auth-gate"

export default function Page() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  )
}