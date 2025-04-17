class DownstreamService {
    private failureRate: number; // Probability of failure (0 to 1)
    private baseLatency: number; // Base latency in ms
    private latencyVariation: number; // Random variation in latency

    constructor(failureRate: number, baseLatency: number, latencyVariation: number) {
        this.failureRate = failureRate;
        this.baseLatency = baseLatency;
        this.latencyVariation = latencyVariation;
    }

    public async fetchData(): Promise<string> {
        // Simulate latency
        const latency = this.baseLatency + Math.random() * this.latencyVariation;
        await new Promise((resolve) => setTimeout(resolve, latency));

        // Simulate a failure based on the failure rate
        if (Math.random() < this.failureRate) {
            throw new Error('Downstream service failed');
        }
        return 'Success: Data fetched from downstream service';
    }
}

export { DownstreamService };