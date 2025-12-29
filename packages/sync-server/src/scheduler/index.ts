// Bank Sync Scheduler - Automatic bank syncing with retry logic
import cron, { ScheduledTask } from 'node-cron';

export interface SyncSchedule {
    id: string;
    account_id: string;
    cron_expression: string;
    last_sync: string | null;
    next_sync: string | null;
    enabled: boolean;
    retry_count: number;
    last_error: string | null;
}

export interface SyncResult {
    success: boolean;
    transactionsAdded: number;
    transactionsUpdated: number;
    error?: string;
}

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 30000;  // 30 seconds
const MAX_RETRY_DELAY_MS = 300000;     // 5 minutes

// Calculate delay with exponential backoff
function calculateRetryDelay(retryCount: number): number {
    const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
    return Math.min(delay, MAX_RETRY_DELAY_MS);
}

export class BankSyncScheduler {
    private jobs: Map<string, ScheduledTask> = new Map();
    private pendingRetries: Map<string, NodeJS.Timeout> = new Map();
    private syncFunction: (accountId: string) => Promise<SyncResult>;
    private onScheduleUpdate: (schedule: Partial<SyncSchedule> & { account_id: string }) => Promise<void>;

    constructor(
        syncFunction: (accountId: string) => Promise<SyncResult>,
        onScheduleUpdate: (schedule: Partial<SyncSchedule> & { account_id: string }) => Promise<void>
    ) {
        this.syncFunction = syncFunction;
        this.onScheduleUpdate = onScheduleUpdate;
    }

    async initialize(schedules: SyncSchedule[]): Promise<void> {
        console.log(`[Scheduler] Initializing with ${schedules.length} schedules`);

        for (const schedule of schedules) {
            if (schedule.enabled) {
                this.createJob(schedule);
            }
        }

        console.log(`[Scheduler] ${this.jobs.size} jobs active`);
    }

    createJob(schedule: SyncSchedule): void {
        // Clear existing job if any
        this.stopJob(schedule.account_id);

        if (!cron.validate(schedule.cron_expression)) {
            console.error(`[Scheduler] Invalid cron expression for account ${schedule.account_id}: ${schedule.cron_expression}`);
            return;
        }

        console.log(`[Scheduler] Creating job for account ${schedule.account_id} with cron: ${schedule.cron_expression}`);

        const job = cron.schedule(schedule.cron_expression, async () => {
            await this.runSync(schedule.account_id, 0);
        });

        this.jobs.set(schedule.account_id, job);
    }

    stopJob(accountId: string): void {
        const existingJob = this.jobs.get(accountId);
        if (existingJob) {
            existingJob.stop();
            this.jobs.delete(accountId);
        }

        // Also clear any pending retry
        const pendingRetry = this.pendingRetries.get(accountId);
        if (pendingRetry) {
            clearTimeout(pendingRetry);
            this.pendingRetries.delete(accountId);
        }
    }

    private async runSync(accountId: string, retryCount: number): Promise<void> {
        const timestamp = new Date().toISOString();
        console.log(`[Scheduler] Running sync for account ${accountId} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

        try {
            const result = await this.syncFunction(accountId);

            if (result.success) {
                console.log(`[Scheduler] Sync successful for ${accountId}: +${result.transactionsAdded} added, ${result.transactionsUpdated} updated`);

                // Reset retry count on success
                await this.onScheduleUpdate({
                    account_id: accountId,
                    last_sync: timestamp,
                    next_sync: this.getNextScheduledTime(accountId),
                    retry_count: 0,
                    last_error: null,
                });
            } else {
                throw new Error(result.error || 'Sync returned failure');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Scheduler] Sync failed for ${accountId}: ${errorMessage}`);

            // Update schedule with error
            await this.onScheduleUpdate({
                account_id: accountId,
                retry_count: retryCount + 1,
                last_error: errorMessage,
            });

            // Schedule retry if under limit
            if (retryCount < MAX_RETRIES) {
                const delay = calculateRetryDelay(retryCount);
                console.log(`[Scheduler] Scheduling retry for ${accountId} in ${delay / 1000}s`);

                const timeout = setTimeout(() => {
                    this.pendingRetries.delete(accountId);
                    this.runSync(accountId, retryCount + 1);
                }, delay);

                this.pendingRetries.set(accountId, timeout);
            } else {
                console.error(`[Scheduler] Max retries exceeded for ${accountId}, will try again at next scheduled time`);
            }
        }
    }

    private getNextScheduledTime(accountId: string): string | null {
        // Get next scheduled time - this is an approximation
        // In production, you'd parse the cron expression to get exact next time
        return new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(); // +12 hours
    }

    // Manual trigger for testing or on-demand sync
    async triggerSync(accountId: string): Promise<SyncResult> {
        console.log(`[Scheduler] Manual sync triggered for ${accountId}`);

        try {
            const result = await this.syncFunction(accountId);

            await this.onScheduleUpdate({
                account_id: accountId,
                last_sync: new Date().toISOString(),
                last_error: result.success ? null : result.error || 'Unknown error',
            });

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            await this.onScheduleUpdate({
                account_id: accountId,
                last_error: errorMessage,
            });

            return { success: false, transactionsAdded: 0, transactionsUpdated: 0, error: errorMessage };
        }
    }

    updateSchedule(schedule: SyncSchedule): void {
        if (schedule.enabled) {
            this.createJob(schedule);
        } else {
            this.stopJob(schedule.account_id);
        }
    }

    getStatus(): {
        activeJobs: number;
        pendingRetries: number;
        accounts: string[];
    } {
        return {
            activeJobs: this.jobs.size,
            pendingRetries: this.pendingRetries.size,
            accounts: Array.from(this.jobs.keys()),
        };
    }

    shutdown(): void {
        console.log('[Scheduler] Shutting down...');

        for (const [accountId, job] of this.jobs) {
            job.stop();
        }
        this.jobs.clear();

        for (const [accountId, timeout] of this.pendingRetries) {
            clearTimeout(timeout);
        }
        this.pendingRetries.clear();

        console.log('[Scheduler] Shutdown complete');
    }
}

export { MAX_RETRIES, INITIAL_RETRY_DELAY_MS };
