
export const isValidUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (e) {
    return false;
  }
};

export const isValidJson = (json: string): boolean => {
  if (!json) return true; // Empty string is valid (optional fields) unless strictly required
  try {
    JSON.parse(json);
    return true;
  } catch (e) {
    return false;
  }
};

export const isNotEmpty = (value: string): boolean => {
  return value !== undefined && value !== null && value.trim().length > 0;
};
