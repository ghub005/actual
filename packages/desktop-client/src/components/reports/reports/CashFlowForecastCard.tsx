import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { Text } from '@actual-app/components/text';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';

import { send } from 'loot-core/platform/client/fetch';
import * as monthUtils from 'loot-core/shared/months';

import { PrivacyFilter } from '@desktop-client/components/PrivacyFilter';
import {
    chartTheme,
    useRechartsAnimation,
} from '@desktop-client/components/reports/chart-theme';
import { Container } from '@desktop-client/components/reports/Container';
import { LoadingIndicator } from '@desktop-client/components/reports/LoadingIndicator';
import { ReportCard } from '@desktop-client/components/reports/ReportCard';
import { ReportCardName } from '@desktop-client/components/reports/ReportCardName';
import { useFormat } from '@desktop-client/hooks/useFormat';

interface ForecastDay {
    date: string;
    label: string;
    balance: number;
    projected: number;
    upperBound: number;
    lowerBound: number;
    isProjected: boolean;
}

interface CashFlowForecastWidget {
    meta?: {
        name?: string;
        days?: number;
    };
}

type CashFlowForecastCardProps = {
    widgetId: string;
    isEditing?: boolean;
    meta?: CashFlowForecastWidget['meta'];
    onMetaChange: (newMeta: CashFlowForecastWidget['meta']) => void;
    onRemove: () => void;
};

export function CashFlowForecastCard({
    widgetId,
    isEditing,
    meta = {},
    onMetaChange,
    onRemove,
}: CashFlowForecastCardProps) {
    const { t } = useTranslation();
    const format = useFormat();
    const animationProps = useRechartsAnimation();
    const [nameMenuOpen, setNameMenuOpen] = useState(false);
    const [data, setData] = useState<ForecastDay[] | null>(null);

    const forecastDays = meta?.days || 30;

    useEffect(() => {
        async function generateForecast() {
            try {
                // Get current balance of all on-budget accounts
                const accounts = await send('query', {
                    query: {
                        select: ['id', 'name', 'balance'],
                        from: 'accounts',
                        filter: {
                            $and: [
                                { offbudget: { $eq: 0 } },
                                { closed: { $eq: 0 } },
                            ],
                        },
                    },
                });

                const currentBalance = accounts.reduce(
                    (sum: number, acc: { balance: number }) => sum + (acc.balance || 0),
                    0
                );

                // Get historical daily spending average from last 30 days
                const thirtyDaysAgo = monthUtils.subDays(monthUtils.currentDay(), 30);

                const spending = await send('query', {
                    query: {
                        select: [{ sum: 'amount' }],
                        from: 'transactions',
                        filter: {
                            $and: [
                                { date: { $gte: thirtyDaysAgo } },
                                { amount: { $lt: 0 } },
                                { 'account.offbudget': { $eq: 0 } },
                            ],
                        },
                    },
                });

                const income = await send('query', {
                    query: {
                        select: [{ sum: 'amount' }],
                        from: 'transactions',
                        filter: {
                            $and: [
                                { date: { $gte: thirtyDaysAgo } },
                                { amount: { $gt: 0 } },
                                { 'account.offbudget': { $eq: 0 } },
                            ],
                        },
                    },
                });

                const totalSpending = Math.abs(spending[0]?.sum || 0);
                const totalIncome = income[0]?.sum || 0;

                const dailySpending = totalSpending / 30;
                const dailyIncome = totalIncome / 30;
                const dailyNet = dailyIncome - dailySpending;

                // Generate variance (for confidence bands)
                const variance = dailySpending * 0.3; // 30% variance

                // Generate forecast data
                const forecastData: ForecastDay[] = [];
                let balance = currentBalance;
                const today = monthUtils.currentDay();

                for (let i = 0; i < forecastDays; i++) {
                    const date = monthUtils.addDays(today, i);
                    const isProjected = i > 0;

                    if (isProjected) {
                        balance += dailyNet;
                    }

                    forecastData.push({
                        date,
                        label: monthUtils.format(date, 'MMM d'),
                        balance: isProjected ? 0 : currentBalance,
                        projected: balance,
                        upperBound: balance + (variance * Math.sqrt(i + 1)),
                        lowerBound: balance - (variance * Math.sqrt(i + 1)),
                        isProjected,
                    });
                }

                setData(forecastData);
            } catch (err) {
                console.error('Failed to generate forecast:', err);
            }
        }

        generateForecast();
    }, [forecastDays]);

    const endBalance = data?.[data.length - 1]?.projected || 0;
    const startBalance = data?.[0]?.projected || 0;
    const trend = endBalance >= startBalance ? 'positive' : 'negative';

    return (
        <ReportCard
            isEditing={isEditing}
            disableClick={nameMenuOpen}
            to={`/reports/cash-flow-forecast/${widgetId}`}
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
                            name={meta?.name || t('Cash Flow Forecast')}
                            isEditing={nameMenuOpen}
                            onChange={newName => {
                                onMetaChange({ ...meta, name: newName });
                                setNameMenuOpen(false);
                            }}
                            onClose={() => setNameMenuOpen(false)}
                        />
                        <Text style={{ fontSize: 11, color: theme.tableTextLight }}>
                            {forecastDays}-day projection
                        </Text>
                    </View>
                    {data && (
                        <View style={{ textAlign: 'right' }}>
                            <PrivacyFilter>
                                <Text style={{
                                    fontWeight: 600,
                                    color: trend === 'positive' ? chartTheme.colors.green : chartTheme.colors.red,
                                }}>
                                    {format(endBalance, 'financial')}
                                </Text>
                            </PrivacyFilter>
                            <Text style={{ fontSize: 11, color: theme.tableTextLight }}>
                                in {forecastDays} days
                            </Text>
                        </View>
                    )}
                </View>

                {data ? (
                    <Container style={{ height: 'auto', flex: 1 }}>
                        {(width, height) => (
                            <ResponsiveContainer width={width} height={height}>
                                <AreaChart
                                    data={data}
                                    margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                                >
                                    <defs>
                                        <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={chartTheme.colors.blue} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={chartTheme.colors.blue} stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="boundGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={chartTheme.colors.gray} stopOpacity={0.2} />
                                            <stop offset="95%" stopColor={chartTheme.colors.gray} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fontSize: 10, fill: theme.tableTextLight }}
                                        axisLine={{ stroke: theme.tableBorder }}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        tickFormatter={(value) => format(value / 100, 'financial-short')}
                                        tick={{ fontSize: 10, fill: theme.tableTextLight }}
                                        axisLine={{ stroke: theme.tableBorder }}
                                    />
                                    <Tooltip
                                        formatter={(value: number) => format(value, 'financial')}
                                        contentStyle={{
                                            backgroundColor: theme.cardBackground,
                                            border: `1px solid ${theme.tableBorder}`,
                                        }}
                                    />
                                    <ReferenceLine y={0} stroke={theme.tableBorder} />
                                    {/* Confidence band (upper) */}
                                    <Area
                                        type="monotone"
                                        dataKey="upperBound"
                                        stroke="none"
                                        fill="url(#boundGradient)"
                                        {...animationProps}
                                    />
                                    {/* Projected balance */}
                                    <Area
                                        type="monotone"
                                        dataKey="projected"
                                        stroke={chartTheme.colors.blue}
                                        strokeWidth={2}
                                        fill="url(#forecastGradient)"
                                        {...animationProps}
                                    />
                                </AreaChart>
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
