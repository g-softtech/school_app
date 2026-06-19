import api from './api';

// Fee Structures
export const getFeeStructures   = (p)      => api.get('/fee-structures', { params: p });
export const getFeeStructure    = (id)     => api.get(`/fee-structures/${id}`);
export const createFeeStructure = (d)      => api.post('/fee-structures', d);
export const updateFeeStructure = (id, d)  => api.patch(`/fee-structures/${id}`, d);
export const deleteFeeStructure = (id)     => api.delete(`/fee-structures/${id}`);
export const getFeesForClass    = (id, p)  => api.get(`/fee-structures/for-class/${id}`, { params: p });
export const getFeesSummary     = (p)      => api.get('/fee-structures/summary', { params: p });

// Student Bills
export const generateBills      = (d)      => api.post('/bills/generate', d);
export const generateSingleBill = (d)      => api.post('/bills/generate-single', d);
export const getAllBills         = (p)      => api.get('/bills', { params: p });
export const getStudentBills    = (id, p)  => api.get(`/bills/student/${id}`, { params: p });
export const getBill            = (id)     => api.get(`/bills/${id}`);
export const applyAdjustment    = (id, d)  => api.patch(`/bills/${id}/adjustment`, d);
export const setCarryOver       = (id, d)  => api.patch(`/bills/${id}/carry-over`, d);
export const syncBill           = (id)     => api.post(`/bills/${id}/sync`);
export const getDefaulters      = (p)      => api.get('/bills/defaulters', { params: p });
export const deleteBill         = (id)     => api.delete(`/bills/${id}`);
