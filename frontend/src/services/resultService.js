import api from './api';
export const uploadResult       = (d)    => api.post('/results', d);
export const bulkUpload         = (d)    => api.post('/results/bulk', d);
export const getStudentResults  = (id, p) => api.get(`/results/student/${id}`, { params: p });
export const getClassResults    = (id, p) => api.get(`/results/class/${id}`, { params: p });
export const updateResult       = (id, d) => api.patch(`/results/${id}`, d);
export const deleteResult       = (id)   => api.delete(`/results/${id}`);
export const generateShareToken = (d)    => api.post('/results/share-token', d);
export const getSharedResult    = (token) => api.get(`/results/share-data/${token}`);