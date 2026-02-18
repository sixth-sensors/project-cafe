import type { User } from 'firebase/auth'

export interface AuthContextType {
  user: User | null
  loading: boolean
}
