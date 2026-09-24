type JobHandler = () => Promise<void> | void;

const jobs = new Map<string, JobHandler>();

export function registerJob(name: string, handler: JobHandler): void {
  jobs.set(name, handler);
}

export function getJob(name: string): JobHandler | undefined {
  return jobs.get(name);
}

export function listJobs(): string[] {
  return [...jobs.keys()];
}
