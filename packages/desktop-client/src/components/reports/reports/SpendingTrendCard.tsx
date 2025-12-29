import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { Text } from '@actual-app/components/text';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid
} from 'recharts';

import { send } from 'loot-core/platform/client/fetch';
import * as monthUtils from 'loot-core/shared/months';

import { PrivacyFilter } from '@desktop-client/components/PrivacyFilter';
import {
    chartTheme,
    useRechartsAnimation,
} from '@desktop-client/components/reports/chart-theme';
import { Container } from '@desktop-client/components/reports/Container';
import { DateRange } from '@desktop-client/components/reports/DateRange';
import { LoadingIndicator } from '@desktop-client/components/reports/LoadingIndicator';
import { ReportCard } from '@desktop-client/components/reports/ReportCard';
import { ReportCardName } from '@desktop-client/components/reports/ReportCardName';
import { useFormat } from '@desktop-client/hooks/useFormat';

interface SpendingData {
    month: string;
    spending: number;
    average: number;
}

interface SpendingTrendWidget {
    meta?: {
        name?: string;
        months?: number;
    };
}

type SpendingTrendCardProps = {
    widgetId: string;
    isEditing?: boolean;
    meta?: SpendingTrendWidget['meta'];
    onMetaChange: (newMeta: SpendingTrendWidget['meta']) => void;
    onRemove: () => void;
};

export function SpendingTrendCard({
    widgetId,
    isEditing,
    meta = {},
    onMetaChange,
    onRemove,
}: SpendingTrendCardProps) {
    const { t } = useTranslation();
    const format = useFormat();
    const animationProps = useRechartsAnimation();
    const [nameMenuOpen, setNameMenuOpen] = useState(false);
    const [data, setData] = useState<SpendingData[] | null>(null);

    const months = meta?.months || 6;
    const end = monthUtils.currentMonth();
    const start = monthUtils.subMonths(end, months - 1);

    useEffect(() => {
        async function fetchSpendingTrend() {
            try {
                // Fetch monthly spending data
                const monthlyData: SpendingData[] = [];
                let totalSpending = 0;

                for (let i = 0; i < months; i++) {
                    const month = monthUtils.subMonths(end, months - 1 - i);

                    // Query for that month's spending (negative amounts = expenses)
                    const result = await send('query', {
                        query: {
                            select: [{ sum: 'amount' }],
                            from: 'transactions',
                            filter: {
                                $and: [
                                    { date: { $gte: monthUtils.firstDayOfMonth(month) } },
                                    { date: { $lte: monthUtils.lastDayOfMonth(month) } },
                                    { amount: { $lt: 0 } },
                                    { 'account.offbudget': { $eq: 0 } },
                                ],
                            },
                        },
                    });

                    const spending = Math.abs(result?.[0]?.sum || 0);
                    totalSpending += spending;

                    monthlyData.push({
                        month: monthUtils.format(month, 'MMM'),
                        spending,
                        average: totalSpending / (i + 1),
                    });
                }

                setData(monthlyData);
            } catch (err) {
                console.error('Failed to fetch spending trend:', err);
            }
        }

        fetchSpendingTrend();
    }, [end, months]);

    const currentSpending = data?.[data.length - 1]?.spending || 0;
    const avgSpending = data?.[data.length - 1]?.average || 0;
    const trend = currentSpending > avgSpending ? 'up' : 'down';

    return (
        <ReportCard
            isEditing={isEditing}
            disableClick={nameMenuOpen}
            to={`/reports/spending-trend/${widgetId}`}
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
                            name={meta?.name || t('Spending Trend')}
                            isEditing={nameMenuOpen}
                            onChange={newName => {
                                onMetaChange({ ...meta, name: newName });
                                setNameMenuOpen(false);
                            }}
                            onClose={() => setNameMenuOpen(false)}
                        />
                        <DateRange start={start} end={end} />
                    </View>
                    {data && (
                        <View style={{ textAlign: 'right' }}>
                            <Text style={{
                                color: trend === 'up' ? chartTheme.colors.red : chartTheme.colors.green,
                                fontWeight: 600
                            }}>
                                <PrivacyFilter>
                                    {format(currentSpending, 'financial')}
                                </PrivacyFilter>
                            </Text>
                            <Text style={{ fontSize: 11, color: theme.tableTextLight }}>
                                {trend === 'up' ? '↑' : '↓'} vs avg
                            </Text>
                        </View>
                    )}
                </View>

                {data ? (
                    <Container style={{ height: 'auto', flex: 1 }}>
                        {(width, height) => (
                            <ResponsiveContainer width={width} height={height}>
                                <LineChart
                                    data={data}
                                    margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={theme.tableBorder} />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fontSize: 11, fill: theme.tableTextLight }}
                                        axisLine={{ stroke: theme.tableBorder }}
                                    />
                                    <YAxis
                                        tickFormatter={(value) => format(value / 100, 'financial-short')}
                                        tick={{ fontSize: 11, fill: theme.tableTextLight }}
                                        axisLine={{ stroke: theme.tableBorder }}
                                    />
                                    <Tooltip
                                        formatter={(value: number) => format(value, 'financial')}
                                        labelStyle={{ color: theme.tableText }}
                                        contentStyle={{
                                            backgroundColor: theme.cardBackground,
                                            border: `1px solid ${theme.tableBorder}`,
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="spending"
                                        stroke={chartTheme.colors.blue}
                                        strokeWidth={2}
                                        dot={{ fill: chartTheme.colors.blue, r: 4 }}
                                        {...animationProps}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="average"
                                        stroke={chartTheme.colors.gray}
                                        strokeWidth={1}
                                        strokeDasharray="5 5"
                                        dot={false}
                                        {...animationProps}
                                    />
                                </LineChart>
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
