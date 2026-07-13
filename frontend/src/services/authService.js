import api from './api';

export const authService = {
  login: async (username, password) => {
    const response = await api.post('/auth/login/', { username, password });
    if (response.data.access) {
      localStorage.setItem('accessToken', response.data.access);
      localStorage.setItem('refreshToken', response.data.refresh);
    }
    return response.data;
  },

  register: async (username, email, password, experienceLevel, favoriteSectors) => {
    const response = await api.post('/auth/register/', {
      username,
      email,
      password,
      experience_level: experienceLevel || 'BEGINNER',
      favorite_sectors: favoriteSectors || []
    });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile/');
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.dispatchEvent(new Event('auth_logout'));
  }
};

export default authService;
