/**
 * Circuit Breaker State Machine
 */
enum CircuitBreakerState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerConfig {
    failureThreshold: number; // Number of failures before opening the circuit
    timeout: number; // Time (ms) to wait before moving to HALF_OPEN
    maxHalfOpenRequests: number; // Max requests allowed in HALF_OPEN state
}

/**
 * Interface for state behavior
 */
interface State {
    callService<T>(context: CircuitBreaker, service: () => Promise<T>): Promise<T>;
    onSuccess(context: CircuitBreaker): void;
    onFailure(context: CircuitBreaker): void;
}

/**
 * Context class for the Circuit Breaker
 */
class CircuitBreaker {
    private state: State;
    private failureCount: number;
    private lastFailureTime: number | null;
    private readonly config: CircuitBreakerConfig;
    private responseTimes: number[] = [];
    private halfOpenRequestCount: number;

    constructor(config: CircuitBreakerConfig) {
        this.config = config;
        this.state = new ClosedState();
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.halfOpenRequestCount = 0;
    }

    /**
     * State Getter
     * @returns {CircuitBreakerState}
     */
    public getState(): CircuitBreakerState {
        if (this.state instanceof ClosedState) return CircuitBreakerState.CLOSED;
        if (this.state instanceof OpenState) return CircuitBreakerState.OPEN;
        return CircuitBreakerState.HALF_OPEN;
    }

    /**
     * Response Times Getter
     * @returns {number[]} - Array of response times in milliseconds
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
        return this.state.callService(this, service);
    }

    /**
     * Transition to a new state
     * @param state
     */
    public setState(state: State): void {
        this.state = state;
    }

    /**
     * Record a failure
     */
    public recordFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();
    }

    /**
     * Reset failure tracking
     */
    public reset(): void {
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.halfOpenRequestCount = 0;
    }

    /**
     * Record response time
     * @param time
     */
    public recordResponseTime(time: number): void {
        this.responseTimes.push(time);
    }

    /**
     * Get failure count
     */
    public getFailureCount(): number {
        return this.failureCount;
    }

    /**
     * Get last failure time
     */
    public getLastFailureTime(): number | null {
        return this.lastFailureTime;
    }

    /**
     * Get config
     */
    public getConfig(): CircuitBreakerConfig {
        return this.config;
    }

    /**
     * Increment HALF_OPEN request count
     */
    public incrementHalfOpenRequest(): void {
        this.halfOpenRequestCount++;
    }

    /**
     * Get HALF_OPEN request count
     */
    public getHalfOpenRequestCount(): number {
        return this.halfOpenRequestCount;
    }
}

/**
 * Closed State: Allows requests to pass through
 */
class ClosedState implements State {
    async callService<T>(context: CircuitBreaker, service: () => Promise<T>): Promise<T> {
        const startTime = Date.now();
        try {
            const result = await service();
            const endTime = Date.now();
            context.recordResponseTime(endTime - startTime);
            this.onSuccess(context);
            return result;
        } catch (error) {
            console.error((error as Error).message);
            const endTime = Date.now();
            context.recordResponseTime(endTime - startTime);
            this.onFailure(context);
            throw error;
        }
    }

    onSuccess(context: CircuitBreaker): void {
        context.reset();
    }

    onFailure(context: CircuitBreaker): void {
        context.recordFailure();
        if (context.getFailureCount() >= context.getConfig().failureThreshold) {
            console.log('Failure threshold reached, transitioning to OPEN state...');
            context.setState(new OpenState());
        }
    }
}

/**
 * Open State: Blocks requests until timeout elapses
 */
class OpenState implements State {
    async callService<T>(context: CircuitBreaker, service: () => Promise<T>): Promise<T> {
        const startTime = Date.now();
        const now = Date.now();
        const lastFailureTime = context.getLastFailureTime();
        if (lastFailureTime && now - lastFailureTime >= context.getConfig().timeout) {
            console.log('Transitioning to HALF_OPEN state for health check...');
            context.setState(new HalfOpenState());
            return context.callService(service);
        } else {
            const endTime = Date.now();
            context.recordResponseTime(endTime - startTime);
            throw new Error('Circuit is OPEN - request blocked');
        }
    }

    onSuccess(_context: CircuitBreaker): void {
        // No-op: Success not expected in OPEN state
    }

    onFailure(_context: CircuitBreaker): void {
        // No-op: Failure not expected in OPEN state
    }
}

/**
 * Half-Open State: Allows limited requests to test service
 */
class HalfOpenState implements State {
    async callService<T>(context: CircuitBreaker, service: () => Promise<T>): Promise<T> {
        if (context.getHalfOpenRequestCount() >= context.getConfig().maxHalfOpenRequests) {
            console.log('Max HALF_OPEN requests reached, transitioning to OPEN state...');
            context.setState(new OpenState());
            throw new Error('Max HALF_OPEN requests exceeded');
        }

        context.incrementHalfOpenRequest();
        const startTime = Date.now();
        try {
            const result = await service();
            const endTime = Date.now();
            context.recordResponseTime(endTime - startTime);
            this.onSuccess(context);
            return result;
        } catch (error) {
            console.error((error as Error).message);
            const endTime = Date.now();
            context.recordResponseTime(endTime - startTime);
            this.onFailure(context);
            throw error;
        }
    }

    onSuccess(context: CircuitBreaker): void {
        console.log('Health check passed, transitioning to CLOSED state...');
        context.setState(new ClosedState());
        context.reset();
    }

    onFailure(context: CircuitBreaker): void {
        console.log('Health check failed, transitioning back to OPEN state...');
        context.setState(new OpenState());
    }
}

export { CircuitBreaker, CircuitBreakerState, CircuitBreakerConfig };