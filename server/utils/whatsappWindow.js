export const isWithin24Hours = (lastCustomerMessageTime) => {
  if (!lastCustomerMessageTime) return false;

  const now = new Date();
  const last = new Date(lastCustomerMessageTime);
  const diffMs = now - last;
  const diffHours = diffMs / (1000 * 60 * 60);

  return diffHours <= 24;
};
