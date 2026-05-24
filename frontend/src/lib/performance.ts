type PerfDetails = Record<string, string | number | boolean | undefined>;

export function logPerfSample(name: string, durationMs: number, details?: PerfDetails): void {
    if (!import.meta.env.DEV) return;

    const rounded = Math.round(durationMs);
    const suffix = details
        ? ` ${Object.entries(details)
            .filter(([, value]) => value !== undefined && value !== null)
            .map(([key, value]) => `${key}=${String(value)}`)
            .join(" ")}`
        : "";

    console.info(`[perf] ${name}: ${rounded}ms${suffix}`);
}
