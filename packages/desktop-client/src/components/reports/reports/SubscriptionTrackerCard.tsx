import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { Text } from '@actual-app/components/text';

import { send } from 'loot-core/platform/client/fetch';
import * as monthUtils from 'loot-core/shared/months';

import { PrivacyFilter } from '@desktop-client/components/PrivacyFilter';
import { chartTheme } from '@desktop-client/components/reports/chart-theme';
import { LoadingIndicator } from '@desktop-client/components/reports/LoadingIndicator';
import { ReportCard } from '@desktop-client/components/reports/ReportCard';
import { ReportCardName } from '@desktop-client/components/reports/ReportCardName';
import { useFormat } from '@desktop-client/hooks/useFormat';

interface Subscription {
    payee: string;
    payeeId: string;
    averageAmount: number;
    frequency: 'monthly' | 'yearly' | 'quarterly' | 'weekly';
    lastCharge: string;
    nextExpected: string;
    chargeCount: number;
}

interface SubscriptionTrackerWidget {
    meta?: {
        name?: string;
    };
}

type SubscriptionTrackerCardProps = {
    widgetId: string;
    isEditing?: boolean;
    meta?: SubscriptionTrackerWidget['meta'];
    onMetaChange: (newMeta: SubscriptionTrackerWidget['meta']) => void;
    onRemove: () => void;
};

// Detect subscription frequency based on transaction history
function detectFrequency(dates: string[]): 'monthly' | 'yearly' | 'quarterly' | 'weekly' {
    if (dates.length < 2) return 'monthly';

    // Calculate average days between transactions
    const sortedDates = dates.sort();
    const gaps: number[] = [];

    for (let i = 1; i < sortedDates.length; i++) {
        const diff = monthUtils.differenceInCalendarDays(sortedDates[i], sortedDates[i - 1]);
        gaps.push(diff);
    }

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    if (avgGap <= 10) return 'weekly';
    if (avgGap <= 45) return 'monthly';
    if (avgGap <= 120) return 'quarterly';
    return 'yearly';
}

export function SubscriptionTrackerCard({
    widgetId,
    isEditing,
    meta = {},
    onMetaChange,
    onRemove,
}: SubscriptionTrackerCardProps) {
    const { t } = useTranslation();
    const format = useFormat();
    const [nameMenuOpen, setNameMenuOpen] = useState(false);
    const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);

    useEffect(() => {
        async function detectSubscriptions() {
            try {
                // Look for recurring payees over the last 6 months
                const sixMonthsAgo = monthUtils.subMonths(monthUtils.currentMonth(), 6);

                // Query transactions grouped by payee
                const result = await send('query', {
                    query: {
                        select: [
                            'payee.id',
                            'payee.name',
                            'date',
                            { avg: 'amount' },
                            { count: 'id' },
                        ],
                        from: 'transactions',
                        filter: {
                            $and: [
                                { date: { $gte: monthUtils.firstDayOfMonth(sixMonthsAgo) } },
                                { amount: { $lt: 0 } },
                                { 'account.offbudget': { $eq: 0 } },
                                { 'payee.id': { $neq: null } },
                            ],
                        },
                        groupBy: ['payee.id', 'payee.name', 'date'],
                    },
                });

                // Group by payee to find recurring ones
                const payeeMap = new Map<string, {
                    name: string;
                    amounts: number[];
                    dates: string[];
                }>();

                for (const row of result) {
                    if (!row.id || !row.name) continue;

                    if (!payeeMap.has(row.id)) {
                        payeeMap.set(row.id, { name: row.name, amounts: [], dates: [] });
                    }
                    const entry = payeeMap.get(row.id)!;
                    entry.amounts.push(Math.abs(row.avg || 0));
                    entry.dates.push(row.date);
                }

                // Filter to payees with 3+ transactions (likely subscriptions)
                const detected: Subscription[] = [];

                for (const [payeeId, data] of payeeMap) {
                    if (data.dates.length >= 3) {
                        const frequency = detectFrequency(data.dates);
                        const avgAmount = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length;
                        const sortedDates = data.dates.sort().reverse();
                        const lastCharge = sortedDates[0];

                        // Calculate next expected date
                        let daysToAdd = 30;
                        if (frequency === 'weekly') daysToAdd = 7;
                        if (frequency === 'quarterly') daysToAdd = 90;
                        if (frequency === 'yearly') daysToAdd = 365;

                        const nextExpected = monthUtils.addDays(lastCharge, daysToAdd);

                        detected.push({
                            payee: data.name,
                            payeeId,
                            averageAmount: avgAmount,
                            frequency,
                            lastCharge,
                            nextExpected,
                            chargeCount: data.dates.length,
                        });
                    }
                }

                // Sort by amount (highest first)
                detected.sort((a, b) => b.averageAmount - a.averageAmount);
                setSubscriptions(detected.slice(0, 10));
            } catch (err) {
                console.error('Failed to detect subscriptions:', err);
                setSubscriptions([]);
            }
        }

        detectSubscriptions();
    }, []);

    const totalMonthly = subscriptions?.reduce((sum, s) => {
        let monthly = s.averageAmount;
        if (s.frequency === 'weekly') monthly *= 4;
        if (s.frequency === 'quarterly') monthly /= 3;
        if (s.frequency === 'yearly') monthly /= 12;
        return sum + monthly;
    }, 0) || 0;

    const frequencyLabel = {
        weekly: 'weekly',
        monthly: 'monthly',
        quarterly: 'quarterly',
        yearly: 'yearly',
    };

    return (
        <ReportCard
            isEditing={isEditing}
            disableClick={nameMenuOpen}
            to={`/reports/subscriptions/${widgetId}`}
            menuItems={[
                { name: 'rename', text: t('Rename') },
                { name: 'remove', text: t('Remove') },
            ]}
            onMenuSelect={item => {
                switch (item) {
                    case 'rename':
                        setNameMenuOpen(true);
                        break;
                    case 'remove':
                        onRemove();
                        break;
                }
            }}
        >
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', padding: 20 }}>
                    <View style={{ flex: 1 }}>
                        <ReportCardName
                            name={meta?.name || t('Subscriptions')}
                            isEditing={nameMenuOpen}
                            onChange={newName => {
                                onMetaChange({ ...meta, name: newName });
                                setNameMenuOpen(false);
                            }}
                            onClose={() => setNameMenuOpen(false)}
                        />
                        <Text style={{ fontSize: 11, color: theme.tableTextLight }}>
                            Recurring payments detected
                        </Text>
                    </View>
                    {subscriptions && (
                        <View style={{ textAlign: 'right' }}>
                            <PrivacyFilter>
                                <Text style={{ fontWeight: 600 }}>
                                    {format(totalMonthly, 'financial')}/mo
                                </Text>
                            </PrivacyFilter>
                            <Text style={{ fontSize: 11, color: theme.tableTextLight }}>
                                {subscriptions.length} subscriptions
                            </Text>
                        </View>
                    )}
                </View>

                {subscriptions ? (
                    <View style={{ flex: 1, padding: '0 15px 15px 15px', overflow: 'auto' }}>
                        {subscriptions.length === 0 ? (
                            <Text style={{ color: theme.tableTextLight, textAlign: 'center', padding: 20 }}>
                                No recurring payments detected
                            </Text>
                        ) : (
                            subscriptions.slice(0, 5).map(sub => (
                                <View
                                    key={sub.payeeId}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        padding: '8px 0',
                                        borderBottom: `1px solid ${theme.tableBorder}`,
                                    }}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: 500 }}>{sub.payee}</Text>
                                        <Text style={{ fontSize: 11, color: theme.tableTextLight }}>
                                            {frequencyLabel[sub.frequency]}
                                        </Text>
                                    </View>
                                    <PrivacyFilter>
                                        <Text style={{ fontWeight: 500 }}>
                                            {format(sub.averageAmount, 'financial')}
                                        </Text>
                                    </PrivacyFilter>
                                </View>
                            ))
                        )}
                    </View>
                ) : (
                    <LoadingIndicator />
                )}
            </View>
        </ReportCard>
    );
}
