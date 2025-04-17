/**
 * Circuit Breaker State Machine
 */
enum CircuitBreakerState {
    /**
     * CLOSED: The circuit is closed, and requests are allowed to pass through.
     */
    CLOSED = 'CLOSED',
    /**
     * OPEN: The circuit is open, and requests are blocked.
     */
    OPEN = 'OPEN',
    /**
     * HALF_OPEN: The circuit is half-open, allowing a limited number of requests to test the service.
     */
    HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerConfig {
    failureThreshold: number; // Number of failures before opening the circuit
    timeout: number; // Time (ms) to wait before moving to HALF_OPEN
    maxHalfOpenRequests: number; // Max requests allowed in HALF_OPEN state
}

class CircuitBreaker {
    private state: CircuitBreakerState;
    private failureCount: number;
    private lastFailureTime: number | null;
    private readonly config: CircuitBreakerConfig;
    private responseTimes: number[] = [];

    constructor(config: CircuitBreakerConfig) {
        this.state = CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.config = config;
    }

    /**
     * State Getter
     * @returns {CircuitBreakerState}
     */
    public getState(): CircuitBreakerState {
        return this.state;
    }

    /**
     * Response Times Getter
     * @returns {number}[] - Array of response times in milliseconds
     */
    public getResponseTimes(): number[] {
        return this.responseTimes;
    }

    /**
     * Service Call Method
     * @param service 
     * @returns 
     */
    public async callService<T>(service: () => Promise<T>): Promise<T> {
        const startTime = Date.now();

        if (this.state === CircuitBreakerState.OPEN) {
            const now = Date.now();
            if (this.lastFailureTime && now - this.lastFailureTime >= this.config.timeout) {
                console.log('Transitioning to HALF_OPEN state for health check...');
                this.state = CircuitBreakerState.HALF_OPEN;
            } else {
                const endTime = Date.now();
                this.responseTimes.push(endTime - startTime);
                throw new Error('Circuit is OPEN - request blocked');
            }
        }

        try {
            const result = await service();
            const endTime = Date.now();
            this.responseTimes.push(endTime - startTime);
            this.onSuccess();
            return result;
        } catch (error) {
            console.error((error as Error).message);
            const endTime = Date.now();
            this.responseTimes.push(endTime - startTime);
            this.onFailure();
            throw error;
        }
    }


    private onSuccess(): void {
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            console.log('Health check passed, transitioning to CLOSED state...');
            this.state = CircuitBreakerState.CLOSED;
            this.reset();
        } else if (this.state === CircuitBreakerState.CLOSED) {
            this.reset();
        }
    }

    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === CircuitBreakerState.CLOSED && this.failureCount >= this.config.failureThreshold) {
            console.log('Failure threshold reached, transitioning to OPEN state...');
            this.state = CircuitBreakerState.OPEN;
        } else if (this.state === CircuitBreakerState.HALF_OPEN) {
            console.log('Health check failed, transitioning back to OPEN state...');
            this.state = CircuitBreakerState.OPEN;
        }
    }

    private reset(): void {
        this.failureCount = 0;
        this.lastFailureTime = null;
    }
}

export { CircuitBreaker, CircuitBreakerState, CircuitBreakerConfig };