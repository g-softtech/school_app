export const formatDate = (date) => {
  if (!date) return 'N/A';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (err) {
    return 'N/A';
  }
};

export const formatDateTime = (date) => {
  if (!date) return 'N/A';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (err) {
    return 'N/A';
  }
};

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return '₦0';
  try {
    return '₦' + Number(amount).toLocaleString('en-NG');
  } catch (err) {
    return '₦0';
  }
};

export const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const getErrorMessage = (error) => {
  return error?.response?.data?.message || error?.message || 'Something went wrong';
};

export const truncate = (str, len = 60) => {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
};

export const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  return new Date() > new Date(dueDate);
};