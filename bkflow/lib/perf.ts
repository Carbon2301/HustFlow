export const measureDev = async <T>(
  label: string,
  task: () => Promise<T>,
) => {
  if (process.env.NODE_ENV === "production") {
    return task();
  }

  const start = performance.now();

  try {
    return await task();
  } finally {
    const duration = Math.round(performance.now() - start);

    console.info(`[perf] ${label}: ${duration}ms`);
  }
};
