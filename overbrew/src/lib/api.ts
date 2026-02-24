import { type User } from 'firebase/auth'

export const BASE_URL = import.meta.env.VITE_API_BASE_URL
export const SENDER_ID = 2

export const apiFetch = async (
  endpoint: string,
  user: User,
  options: RequestInit = {}
) => {
  if (!user) throw new Error('Not authenticated')

  const token = await user.getIdToken(true)

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) throw new Error(`API error: ${response.status}`)

  return response.json()
}
