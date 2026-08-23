export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function removeToken() {
  localStorage.removeItem('token');
}

export function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export function setUser(user: any) {
  localStorage.setItem('user', JSON.stringify(user));
}

export async function fetchApi(url: string, options: RequestInit = {}) {
  const token = getToken();
  
  const isFormData = options.body instanceof FormData;
  
  const headers: any = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401 || response.status === 403) {
    if(url !== '/api/auth/login' && url !== '/api/auth/setup') {
      removeToken();
      window.location.href = '/login';
    }
  }

  return response;
}
