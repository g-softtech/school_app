import api from './api';

// Academic Sessions
export const getSessions     = ()        => api.get('/academic-sessions');
export const getCurrentSession = ()      => api.get('/academic-sessions/current');
export const createSession   = (data)    => api.post('/academic-sessions', data);
export const updateSession   = (id,data) => api.patch(`/academic-sessions/${id}`, data);
export const deleteSession   = (id)      => api.delete(`/academic-sessions/${id}`);
export const setCurrentSession = (id)    => api.patch(`/academic-sessions/${id}/set-current`);

// Timetable
export const getTimetable    = (params)  => api.get('/timetable', { params });
export const saveTimetable   = (data)    => api.post('/timetable', data);
export const deleteTimetable = (id)      => api.delete(`/timetable/${id}`);

// Class Promotion
export const promoteStudents = (data)    => api.post('/students/promote', data);
