export const API = '/pos/api';

export const state = {
    token: localStorage.getItem('pos_token') || '',
    user: JSON.parse(localStorage.getItem('pos_user') || 'null'),
    params: {},
    setupProfiles: [],
    offlineQueue: JSON.parse(localStorage.getItem('pos_offline_queue') || '[]')
};

export function setToken(token) {
    state.token = token;
    localStorage.setItem('pos_token', token);
}

export function setUser(user) {
    state.user = user;
    localStorage.setItem('pos_user', JSON.stringify(user));
}

export function clearAuth() {
    state.token = '';
    state.user = null;
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
}
