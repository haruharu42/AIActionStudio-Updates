/** Share concurrent checks only within one auth session, discarding stale completions. */
export function createSessionRequestLoader<Client, Value>(load: (client: Client) => Promise<Value>) {
  let generation = 0;
  let inFlight: Promise<Value> | null = null;
  return {
    generation: () => generation,
    invalidate() {
      generation += 1;
      inFlight = null;
    },
    async load(client: Client): Promise<Value | undefined> {
      const started = generation;
      if (!inFlight) {
        const request = load(client).finally(() => {
          if (inFlight === request) inFlight = null;
        });
        inFlight = request;
      }
      try {
        const value = await inFlight;
        return started === generation ? value : undefined;
      } catch (error) {
        if (started !== generation) return undefined;
        throw error;
      }
    },
  };
}
