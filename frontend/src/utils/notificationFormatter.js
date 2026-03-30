export const formatCurrency = (amount) => {
  if (amount == null) return 'N/A';
  try {
    return Number(amount).toLocaleString('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    });
  } catch {
    return 'NGN ' + amount;
  }
};

export const formatNotificationType = (type) => {
  const labels = {
    EXPENSE_COMPLETED_WITHOUT_RECEIPT: 'Expense Approved without Receipt',
    EXPENSE_COMPLETED_WITH_RECEIPT: 'Expense Approved with Receipt',
    EXPENSE_REJECTED: 'Expense Rejected',
    INCOME_CREATED: 'Income Recorded',
    CUSTOMER_CREATED: 'Customer Created',
    USER_CREATED: 'User Created',
  };
  return labels[type] || (type ? type.replaceAll('_', ' ') : 'Notification');
};

export const getNotificationSeverity = (type) => {
  if (type && type.includes('COMPLETED')) return 'success';
  if (type && type.includes('REJECTED')) return 'error';
  if (type && type.includes('PENDING')) return 'warning';
  return 'info';
};

export const formatActorName = (actor) => {
  if (!actor) return 'System';
  if (typeof actor === 'string') return actor;
  return actor.fullName || actor.name || actor.email || 'Unknown User';
};

export const extractNotificationMetadata = (notification) => {
  if (!notification) return [];
  const { item, amount, reason, data = {} } = notification;
  return [
    item ? { label: 'Item', value: item } : null,
    amount ? { label: 'Amount', value: formatCurrency(amount) } : null,
    data.approvedBy ? { label: 'Approved By', value: formatActorName(data.approvedBy) } : null,
    reason ? { label: 'Reason', value: reason } : null,
  ].filter(Boolean);
};

export const getNotificationColorScheme = (severity) => {
  const schemes = {
    success: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      icon: 'text-emerald-600',
      badge: 'bg-emerald-100 text-emerald-800',
    },
    warning: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      icon: 'text-amber-600',
      badge: 'bg-amber-100 text-amber-800',
    },
    error: {
      bg: 'bg-red-50',
      text: 'text-red-800',
      border: 'border-red-200',
      icon: 'text-red-600',
      badge: 'bg-red-100 text-red-800',
    },
    info: {
      bg: 'bg-blue-50',
      text: 'text-blue-800',
      border: 'border-blue-200',
      icon: 'text-blue-600',
      badge: 'bg-blue-100 text-blue-800',
    },
  };
  return schemes[severity] || schemes.info;
};

export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'Unknown time';
  try {
    const date = new Date(timestamp);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + ' minutes ago';
    if (diffHours < 24) return diffHours + ' hours ago';
    if (diffDays < 7) return diffDays + ' days ago';
    return date.toLocaleDateString('en-NG');
  } catch {
    return 'Unknown time';
  }
};

export const formatNotification = (notification) => {
  if (!notification) return null;
  const severity = getNotificationSeverity(notification.type);
  const colors = getNotificationColorScheme(severity);
  const msg = notification.message || notification.actorMessage || formatNotificationType(notification.type);
  
  return {
    ...notification,
    formattedType: formatNotificationType(notification.type),
    formattedMessage: msg,
    formattedTime: formatRelativeTime(notification.createdAt),
    metadata: extractNotificationMetadata(notification),
    severity,
    colors,
  };
};
