import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { Text } from '@actual-app/components/text';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    ResponsiveContainer,
    Cell,
    ReferenceLine,
} from 'recharts';

import { send } from 'loot-core/platform/client/fetch';
import * as monthUtils from 'loot-core/shared/months';

import { PrivacyFilter } from '@desktop-client/components/PrivacyFilter';
import { chartTheme, useRechartsAnimation } from '@desktop-client/components/reports/chart-theme';
import { Container } from '@desktop-client/components/reports/Container';
import { LoadingIndicator } from '@desktop-client/components/reports/LoadingIndicator';
import { ReportCard } from '@desktop-client/components/reports/ReportCard';
import { ReportCardName } from '@desktop-client/components/reports/ReportCardName';
import { useFormat } from '@desktop-client/hooks/useFormat';

interface WeekData {
    week: string;
    spending: number;
    average: number;
    isCurrentWeek: boolean;
    velocity: number; // percentage above/below average
}

interface SpendingVelocityWidget {
    meta?: {
        name?: string;
        alertThreshold?: number; // percentage above average to alert
    };
}

type SpendingVelocityAlertCardProps = {
    widgetId: string;
    isEditing?: boolean;
    meta?: SpendingVelocityWidget['meta'];
    onMetaChange: (newMeta: SpendingVelocityWidget['meta']) => void;
    onRemove: () => void;
};

export function SpendingVelocityAlertCard({
    widgetId,
    isEditing,
    meta = {},
    onMetaChange,
    onRemove,
}: SpendingVelocityAlertCardProps) {
    const { t } = useTranslation();
    const format = useFormat();
    const animationProps = useRechartsAnimation();
    const [nameMenuOpen, setNameMenuOpen] = useState(false);
    const [data, setData] = useState<WeekData[] | null>(null);

    const alertThreshold = meta?.alertThreshold || 25; // 25% above average

    useEffect(() => {
        async function analyzeSpendingVelocity() {
            try {
                // Get spending for the last 8 weeks
                const weeks: WeekData[] = [];
                const today = monthUtils.currentDay();

                for (let i = 7; i >= 0; i--) {
                    const weekStart = monthUtils.subDays(today, (i + 1) * 7);
                    const weekEnd = monthUtils.subDays(today, i * 7);

                    const result = await send('query', {
                        query: {
                            select: [{ sum: 'amount' }],
                            from: 'transactions',
                            filter: {
                                $and: [
                                    { date: { $gte: weekStart } },
                                    { date: { $lt: weekEnd } },
                                    { amount: { $lt: 0 } },
                                    { 'account.offbudget': { $eq: 0 } },
                                ],
                            },
                        },
                    });

                    const spending = Math.abs(result[0]?.sum || 0);

                    weeks.push({
                        week: i === 0 ? 'This Week' : `${i}w ago`,
                        spending,
                        average: 0, // Will calculate after
                        isCurrentWeek: i === 0,
                        velocity: 0, // Will calculate after
                    });
                }

                // Calculate rolling average (excluding current week)
                const historicalWeeks = weeks.slice(0, -1);
                const avgSpending = historicalWeeks.reduce((sum, w) => sum + w.spending, 0) / historicalWeeks.length;

                // Update with average and velocity
                for (const week of weeks) {
                    week.average = avgSpending;
                    week.velocity = avgSpending > 0
                        ? ((week.spending - avgSpending) / avgSpending) * 100
                        : 0;
                }

                setData(weeks);
            } catch (err) {
                console.error('Failed to analyze spending velocity:', err);
            }
        }

        analyzeSpendingVelocity();
    }, []);

    const currentWeek = data?.[data.length - 1];
    const isAlert = currentWeek && currentWeek.velocity > alertThreshold;
    const average = currentWeek?.average || 0;

    return (
        <ReportCard
            isEditing={isEditing}
            disableClick={nameMenuOpen}
            to={`/reports/spending-velocity/${widgetId}`}
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
                            name={meta?.name || t('Spending Velocity')}
                            isEditing={nameMenuOpen}
                            onChange={newName => {
                                onMetaChange({ ...meta, name: newName });
                                setNameMenuOpen(false);
                            }}
                            onClose={() => setNameMenuOpen(false)}
                        />
                        <Text style={{ fontSize: 11, color: theme.tableTextLight }}>
                            Weekly spending vs average
                        </Text>
                    </View>
                    {currentWeek && (
                        <View style={{ textAlign: 'right' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                                {isAlert && (
                                    <Text style={{
                                        fontSize: 16,
                                        marginRight: 4,
                                        color: chartTheme.colors.red,
                                    }}>
                                        ⚠️
                                    </Text>
                                )}
                                <Text style={{
                                    fontWeight: 600,
                                    color: currentWeek.velocity > 0 ? chartTheme.colors.red : chartTheme.colors.green,
                                }}>
                                    {currentWeek.velocity > 0 ? '+' : ''}{currentWeek.velocity.toFixed(0)}%
                                </Text>
                            </View>
                            <Text style={{ fontSize: 11, color: theme.tableTextLight }}>
                                {isAlert ? 'above normal!' : 'vs average'}
                            </Text>
                        </View>
                    )}
                </View>

                {data ? (
                    <Container style={{ height: 'auto', flex: 1 }}>
                        {(width, height) => (
                            <ResponsiveContainer width={width} height={height}>
                                <BarChart
                                    data={data}
                                    margin={{ top: 5, right: 15, bottom: 5, left: 0 }}
                                >
                                    <XAxis
                                        dataKey="week"
                                        tick={{ fontSize: 10, fill: theme.tableTextLight }}
                                        axisLine={{ stroke: theme.tableBorder }}
                                    />
                                    <YAxis
                                        tickFormatter={(value) => format(value / 100, 'financial-short')}
                                        tick={{ fontSize: 10, fill: theme.tableTextLight }}
                                        axisLine={{ stroke: theme.tableBorder }}
                                    />
                                    <ReferenceLine
                                        y={average}
                                        stroke={chartTheme.colors.gray}
                                        strokeDasharray="5 5"
                                        label={{
                                            value: 'Avg',
                                            position: 'right',
                                            fontSize: 10,
                                            fill: theme.tableTextLight,
                                        }}
                                    />
                                    <Bar
                                        dataKey="spending"
                                        radius={[4, 4, 0, 0]}
                                        {...animationProps}
                                    >
                                        {data.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={
                                                    entry.isCurrentWeek
                                                        ? entry.velocity > alertThreshold
                                                            ? chartTheme.colors.red
                                                            : chartTheme.colors.blue
                                                        : chartTheme.colors.gray
                                                }
                                                opacity={entry.isCurrentWeek ? 1 : 0.5}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </Container>
                ) : (
                    <LoadingIndicator />
                )}
            </View>
        </ReportCard>
    );
}
