import { auth } from '../firebase/config'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const user = auth.currentUser

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
