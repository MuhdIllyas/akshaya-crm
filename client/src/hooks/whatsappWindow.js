export const isWithin24Hours = (lastMessageTime) => {
  if (!lastMessageTime) return false;
  const now = new Date();
  const last = new Date(lastMessageTime);
  const diffHours = (now - last) / (1000 * 60 * 60);
  return diffHours <= 24;
};
