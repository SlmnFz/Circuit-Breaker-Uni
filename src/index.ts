import { CircuitBreaker, CircuitBreakerConfig } from './circuitBreaker';
import { DownstreamService } from './downstreamService';

const config: CircuitBreakerConfig = {
    failureThreshold: 5,    // Higher threshold for slower tripping
    timeout: 3000,          // Longer timeout for delayed recovery attempts
    maxHalfOpenRequests: 2  // Allows more half-open requests
};

const downstreamService = new DownstreamService(
    0.3,  // 30% failure rate (more stable)
    700,  // Higher base latency of 700ms
    400   // Larger latency variation up to 400ms
);

// Scenario 1: With Circuit Breaker
async function runWithCircuitBreaker(): Promise<number[]> {
    const circuitBreaker = new CircuitBreaker(config);

    for (let i = 0; i < 30; i++) {
        try {
            await circuitBreaker.callService(() => downstreamService.fetchData());
        } catch (error) {

        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return circuitBreaker.getResponseTimes();
}

// Scenario 2: Without Circuit Breaker
async function runWithoutCircuitBreaker(): Promise<number[]> {
    const responseTimes: number[] = [];

    for (let i = 0; i < 30; i++) {
        const startTime = Date.now();
        try {
            await downstreamService.fetchData();
        } catch (error) {
            console.log(`Error (No CB): ${(error as Error).message}`);
        }
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return responseTimes;
}

// Calculate average response time
function calculateAverage(times: number[]): number {
    return times.reduce((sum, time) => sum + time, 0) / times.length;
}

// Run the simulation and collect results
async function runSimulation(): Promise<{ withCB: number; withoutCB: number }> {
    console.log('Running simulation with Circuit Breaker...');
    const withCBTimes = await runWithCircuitBreaker();
    const withCBAverage = calculateAverage(withCBTimes);

    console.log('\nRunning simulation without Circuit Breaker...');
    const withoutCBTimes = await runWithoutCircuitBreaker();
    const withoutCBAverage = calculateAverage(withoutCBTimes);

    return { withCB: withCBAverage, withoutCB: withoutCBAverage };
}

// Execute the simulation
runSimulation().then((results) => {
    console.log('\nSimulation Results:');
    console.log(`Average Response Time (With Circuit Breaker): ${results.withCB.toFixed(2)}ms`);
    console.log(`Average Response Time (Without Circuit Breaker): ${results.withoutCB.toFixed(2)}ms`);
});