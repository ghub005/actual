import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { Text } from '@actual-app/components/text';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

import { send } from 'loot-core/platform/client/fetch';
import * as monthUtils from 'loot-core/shared/months';

import { PrivacyFilter } from '@desktop-client/components/PrivacyFilter';
import { chartTheme } from '@desktop-client/components/reports/chart-theme';
import { Container } from '@desktop-client/components/reports/Container';
import { DateRange } from '@desktop-client/components/reports/DateRange';
import { LoadingIndicator } from '@desktop-client/components/reports/LoadingIndicator';
import { ReportCard } from '@desktop-client/components/reports/ReportCard';
import { ReportCardName } from '@desktop-client/components/reports/ReportCardName';
import { useFormat } from '@desktop-client/hooks/useFormat';

interface CategoryData {
    id: string;
    name: string;
    amount: number;
    color: string;
    percentage: number;
}

interface CategoryBreakdownWidget {
    meta?: {
        name?: string;
        months?: number;
    };
}

type CategoryBreakdownCardProps = {
    widgetId: string;
    isEditing?: boolean;
    meta?: CategoryBreakdownWidget['meta'];
    onMetaChange: (newMeta: CategoryBreakdownWidget['meta']) => void;
    onRemove: () => void;
};

// Color palette for categories
const COLORS = [
    chartTheme.colors.blue,
    chartTheme.colors.red,
    chartTheme.colors.green,
    chartTheme.colors.yellow,
    chartTheme.colors.purple,
    chartTheme.colors.cyan,
    chartTheme.colors.orange,
    '#8884d8',
    '#82ca9d',
    '#ffc658',
];

export function CategoryBreakdownCard({
    widgetId,
    isEditing,
    meta = {},
    onMetaChange,
    onRemove,
}: CategoryBreakdownCardProps) {
    const { t } = useTranslation();
    const format = useFormat();
    const [nameMenuOpen, setNameMenuOpen] = useState(false);
    const [data, setData] = useState<CategoryData[] | null>(null);

    const months = meta?.months || 1;
    const end = monthUtils.currentMonth();
    const start = months === 1 ? end : monthUtils.subMonths(end, months - 1);

    useEffect(() => {
        async function fetchCategoryBreakdown() {
            try {
                // Query spending by category
                const result = await send('query', {
                    query: {
                        select: [
                            'category.id',
                            'category.name',
                            { sum: 'amount' },
                        ],
                        from: 'transactions',
                        filter: {
                            $and: [
                                { date: { $gte: monthUtils.firstDayOfMonth(start) } },
                                { date: { $lte: monthUtils.lastDayOfMonth(end) } },
                                { amount: { $lt: 0 } },
                                { 'account.offbudget': { $eq: 0 } },
                                { 'category.id': { $neq: null } },
                            ],
                        },
                        groupBy: ['category.id', 'category.name'],
                        orderBy: [{ sum: 'desc' }],
                    },
                });

                // Calculate percentages and assign colors
                const total = result.reduce((sum: number, r: { sum: number }) => sum + Math.abs(r.sum || 0), 0);

                const categoryData: CategoryData[] = result
                    .filter((r: { sum: number }) => r.sum !== 0)
                    .slice(0, 10)  // Top 10 categories
                    .map((r: { id: string; name: string; sum: number }, i: number) => ({
                        id: r.id,
                        name: r.name || 'Uncategorized',
                        amount: Math.abs(r.sum),
                        color: COLORS[i % COLORS.length],
                        percentage: total > 0 ? (Math.abs(r.sum) / total) * 100 : 0,
                    }));

                setData(categoryData);
            } catch (err) {
                console.error('Failed to fetch category breakdown:', err);
            }
        }

        fetchCategoryBreakdown();
    }, [start, end]);

    const totalSpending = data?.reduce((sum, d) => sum + d.amount, 0) || 0;
    const topCategory = data?.[0];

    return (
        <ReportCard
            isEditing={isEditing}
            disableClick={nameMenuOpen}
            to={`/reports/category-breakdown/${widgetId}`}
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
                            name={meta?.name || t('Category Breakdown')}
                            isEditing={nameMenuOpen}
                            onChange={newName => {
                                onMetaChange({ ...meta, name: newName });
                                setNameMenuOpen(false);
                            }}
                            onClose={() => setNameMenuOpen(false)}
                        />
                        <DateRange start={start} end={end} />
                    </View>
                    {data && totalSpending > 0 && (
                        <View style={{ textAlign: 'right' }}>
                            <PrivacyFilter>
                                <Text style={{ fontWeight: 600 }}>
                                    {format(totalSpending, 'financial')}
                                </Text>
                            </PrivacyFilter>
                            <Text style={{ fontSize: 11, color: theme.tableTextLight }}>
                                total spending
                            </Text>
                        </View>
                    )}
                </View>

                {data ? (
                    <View style={{ flex: 1, flexDirection: 'row' }}>
                        <Container style={{ height: 'auto', flex: 1, minWidth: 150 }}>
                            {(width, height) => (
                                <ResponsiveContainer width={width} height={height}>
                                    <PieChart>
                                        <Pie
                                            data={data}
                                            dataKey="amount"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={30}
                                            outerRadius={60}
                                            paddingAngle={2}
                                        >
                                            {data.map((entry, index) => (
                                                <Cell key={entry.id} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value: number) => format(value, 'financial')}
                                            contentStyle={{
                                                backgroundColor: theme.cardBackground,
                                                border: `1px solid ${theme.tableBorder}`,
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </Container>

                        {/* Top categories legend */}
                        <View style={{
                            flex: 1,
                            padding: '0 15px 15px 0',
                            maxWidth: 200,
                            overflow: 'hidden',
                        }}>
                            {data.slice(0, 5).map(cat => (
                                <View
                                    key={cat.id}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        marginBottom: 4,
                                    }}
                                >
                                    <View style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: cat.color,
                                        marginRight: 6,
                                    }} />
                                    <Text style={{
                                        fontSize: 11,
                                        flex: 1,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {cat.name}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: theme.tableTextLight }}>
                                        {cat.percentage.toFixed(0)}%
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : (
                    <LoadingIndicator />
                )}
            </View>
        </ReportCard>
    );
}
