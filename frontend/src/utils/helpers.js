export function formatCurrency(amount, symbol = 'Rs.') {
  const num = Number(amount);
  if (isNaN(num)) return `${symbol}0.00`;
  return `${symbol}${num.toFixed(2)}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const seconds = Math.floor((now - d) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return formatDate(dateStr);
}

export const ORDER_STATUS_LABELS = {
  draft: 'Draft',
  sent_to_kitchen: 'In Kitchen',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export const KITCHEN_STATUS_LABELS = {
  to_cook: 'To Cook',
  preparing: 'Preparing',
  completed: 'Done',
};

export const KITCHEN_STATUS_COLORS = {
  to_cook: 'warning',
  preparing: 'info',
  completed: 'success',
};
