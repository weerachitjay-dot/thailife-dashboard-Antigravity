
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownIcon, ArrowUpIcon, DollarSign, Users, Target } from "lucide-react";

interface KPIProps {
    label: string;
    value: string;
    subValue?: string;
    trend?: 'up' | 'down' | 'neutral';
    icon: any;
}

const KPICard = ({ label, value, subValue, trend, icon: Icon }: KPIProps) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{label}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {subValue && (
                <p className={`text-xs ${trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'} flex items-center mt-1`}>
                    {trend === 'up' ? <ArrowUpIcon className="h-3 w-3 mr-1" /> : trend === 'down' ? <ArrowDownIcon className="h-3 w-3 mr-1" /> : null}
                    {subValue}
                </p>
            )}
        </CardContent>
    </Card>
);

export const ExecutiveSummary = ({ data }: { data: any }) => {
    // Mock calculations - Real data will be passed via props
    const totalSpend = data?.spend || 0;
    const totalLeads = data?.leads || 0;
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const revenue = data?.revenue || 0;
    const profit = revenue - totalSpend;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
                label="Total Spend"
                value={`฿${totalSpend.toLocaleString()}`}
                icon={DollarSign}
                subValue="+12% from last month"
                trend="up"
            />
            <KPICard
                label="Total Leads"
                value={totalLeads.toLocaleString()}
                icon={Users}
                subValue="+180 this week"
                trend="up"
            />
            <KPICard
                label="Average CPL"
                value={`฿${avgCpl.toFixed(0)}`}
                icon={Target}
                subValue="-5% (Improving)"
                trend="down" // Cost going down is good? Usually green if cost down. 
            // Logic for color in KPICard needs to handle 'good' vs 'bad' trend direction context.
            />
            <KPICard
                label="Est. Profit"
                value={`฿${profit.toLocaleString()}`}
                icon={DollarSign}
                subValue="Based on LTV"
                trend="neutral"
            />
        </div>
    );
};
