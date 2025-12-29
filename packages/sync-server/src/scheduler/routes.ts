// Schedule management API routes
import express from 'express';
import { z } from 'zod';
import { BankSyncScheduler, SyncSchedule } from './index.js';

export function createSchedulerRoutes(
    scheduler: BankSyncScheduler,
    getSchedules: () => Promise<SyncSchedule[]>,
    upsertSchedule: (schedule: Partial<SyncSchedule> & { account_id: string }) => Promise<void>,
    deleteSchedule: (accountId: string) => Promise<void>,
) {
    const router = express.Router();

    // Validation schemas
    const createScheduleSchema = z.object({
        account_id: z.string(),
        cron_expression: z.string().default('0 6,18 * * *'),
        enabled: z.boolean().default(true),
    });

    const updateScheduleSchema = z.object({
        cron_expression: z.string().optional(),
        enabled: z.boolean().optional(),
    });

    // GET /api/schedules - List all schedules
    router.get('/schedules', async (_req, res) => {
        try {
            const schedules = await getSchedules();
            const status = scheduler.getStatus();

            res.json({
                schedules,
                status,
            });
        } catch (err) {
            res.status(500).json({ error: String(err) });
        }
    });

    // POST /api/schedules - Create new schedule
    router.post('/schedules', async (req, res) => {
        try {
            const body = createScheduleSchema.parse(req.body);

            const schedule: SyncSchedule = {
                id: `schedule-${body.account_id}`,
                account_id: body.account_id,
                cron_expression: body.cron_expression,
                last_sync: null,
                next_sync: null,
                enabled: body.enabled,
                retry_count: 0,
                last_error: null,
            };

            await upsertSchedule(schedule);
            scheduler.updateSchedule(schedule);

            res.json({ success: true, schedule });
        } catch (err) {
            res.status(400).json({ error: String(err) });
        }
    });

    // PUT /api/schedules/:accountId - Update schedule
    router.put('/schedules/:accountId', async (req, res) => {
        try {
            const { accountId } = req.params;
            const body = updateScheduleSchema.parse(req.body);

            const schedules = await getSchedules();
            const existing = schedules.find(s => s.account_id === accountId);

            if (!existing) {
                res.status(404).json({ error: 'Schedule not found' });
                return;
            }

            const updated: SyncSchedule = {
                ...existing,
                cron_expression: body.cron_expression ?? existing.cron_expression,
                enabled: body.enabled ?? existing.enabled,
            };

            await upsertSchedule(updated);
            scheduler.updateSchedule(updated);

            res.json({ success: true, schedule: updated });
        } catch (err) {
            res.status(400).json({ error: String(err) });
        }
    });

    // DELETE /api/schedules/:accountId - Delete schedule
    router.delete('/schedules/:accountId', async (req, res) => {
        try {
            const { accountId } = req.params;

            scheduler.stopJob(accountId);
            await deleteSchedule(accountId);

            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: String(err) });
        }
    });

    // POST /api/schedules/:accountId/sync - Trigger manual sync
    router.post('/schedules/:accountId/sync', async (req, res) => {
        try {
            const { accountId } = req.params;
            const result = await scheduler.triggerSync(accountId);

            res.json(result);
        } catch (err) {
            res.status(500).json({ error: String(err) });
        }
    });

    // GET /api/schedules/status - Get scheduler status
    router.get('/schedules/status', (_req, res) => {
        const status = scheduler.getStatus();
        res.json(status);
    });

    return router;
}
