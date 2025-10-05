export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const error = new Error(`Failed to fetch from ${url}`) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  return response.json();
};