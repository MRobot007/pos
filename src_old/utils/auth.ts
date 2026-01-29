export const getToken = (): string | null => {
  return localStorage.getItem('token')
}

export const getUser = () => {
  const userStr = localStorage.getItem('user')
  if (!userStr) return null
  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

export const setAuth = (token: string, user: any) => {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}

export const clearAuth = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export const isAuthenticated = (): boolean => {
  return !!getToken()
}

export const hasRole = (allowedRoles: string[]): boolean => {
  const user = getUser()
  if (!user) return false
  return allowedRoles.includes(user.role)
}

export const getAuthHeaders = () => {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  }
}


