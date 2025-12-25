
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSmartRecommendation, CampaignStats } from "@/utils/recommendations";

interface CampaignRow {
    id: string;
    name: string;
    product: string;
    audience: string;
    spend: number;
    leads: number;
    cpl: number;
    daysActive: number;
    targetCpl: number;
}

export const CampaignOptimization = ({ data }: { data: CampaignRow[] }) => {
    return (
        <Card className="col-span-4 mt-6">
            <CardHeader>
                <CardTitle>Campaign Optimization</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Campaign</TableHead>
                            <TableHead>Audience</TableHead>
                            <TableHead className="text-right">Spend</TableHead>
                            <TableHead className="text-right">CPL</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                            <TableHead>Reason</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((camp) => {
                            const stats: CampaignStats = {
                                cost: camp.spend,
                                leads: camp.leads,
                                cpl: camp.cpl,
                                daysActive: camp.daysActive
                            };
                            const rec = getSmartRecommendation(stats, camp.targetCpl);
                            const Icon = rec.icon;

                            return (
                                <TableRow key={camp.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{camp.product}</span>
                                            <span className="text-xs text-muted-foreground">{camp.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{camp.audience}</TableCell>
                                    <TableCell className="text-right">฿{camp.spend.toLocaleString()}</TableCell>
                                    <TableCell className={`text-right ${camp.cpl > camp.targetCpl ? 'text-red-500' : 'text-green-500'}`}>
                                        ฿{camp.cpl.toFixed(0)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${rec.color}`}>
                                            {rec.action}
                                        </span>
                                    </TableCell>
                                    <TableCell className="flex items-center text-sm text-muted-foreground">
                                        <Icon className="w-4 h-4 mr-2" />
                                        {rec.reason}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};
