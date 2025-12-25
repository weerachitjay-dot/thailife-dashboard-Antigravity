
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ProductStat {
    productCode: string;
    spend: number;
    leads: number;
    revenue: number; // Est.
    cpl: number;
    targetCpl: number;
    profit: number;
    forecastProfit: number;
}

export const ProductPerformance = ({ data }: { data: ProductStat[] }) => {
    return (
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Product Performance</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Spend</TableHead>
                            <TableHead className="text-right">Leads</TableHead>
                            <TableHead className="text-right">CPL</TableHead>
                            <TableHead className="text-right">Revenue (Est)</TableHead>
                            <TableHead className="text-right">Profit</TableHead>
                            <TableHead className="text-right">Forecast Profit</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((product) => (
                            <TableRow key={product.productCode}>
                                <TableCell className="font-medium">{product.productCode}</TableCell>
                                <TableCell className="text-right">฿{product.spend.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{product.leads}</TableCell>
                                <TableCell className={`text-right ${product.cpl > product.targetCpl ? 'text-red-500' : 'text-green-500'}`}>
                                    ฿{product.cpl.toFixed(0)}
                                </TableCell>
                                <TableCell className="text-right">฿{product.revenue.toLocaleString()}</TableCell>
                                <TableCell className={`text-right ${product.profit < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    ฿{product.profit.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                    ฿{product.forecastProfit.toLocaleString()}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};
