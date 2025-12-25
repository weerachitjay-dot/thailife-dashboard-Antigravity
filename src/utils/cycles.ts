
export type CycleMode = 'calendar' | 'campaign' | 'partner' | 'custom';

export interface CycleInfo {
    start: Date;
    end: Date;
    totalDays: number;
    label: string;
}

export const getCycleDates = (mode: CycleMode, refDate: Date = new Date()): CycleInfo => {
    const year = refDate.getFullYear();
    const month = refDate.getMonth(); // 0-indexed
    const date = refDate.getDate();

    let start: Date;
    let end: Date;

    if (mode === 'campaign') {
        // Cycle: 27th Prev Month -> 26th Current Month
        // Transition: If today >= 27, we are in NEXT cycle (27th Curr -> 26th Next)
        if (date >= 27) {
            start = new Date(year, month, 27);
            end = new Date(year, month + 1, 26);
        } else {
            start = new Date(year, month - 1, 27);
            end = new Date(year, month, 26);
        }
    } else if (mode === 'partner') {
        // Cycle: 1st -> 26th
        // Transition: If today > 26, we are technically past the cycle.
        // User probably wants "Next" cycle or "Completed" cycle?
        // Let's assume strict "Upcoming/Current". So if > 26, show Next Month.
        if (date > 26) {
            start = new Date(year, month + 1, 1);
            end = new Date(year, month + 1, 26);
        } else {
            start = new Date(year, month, 1);
            end = new Date(year, month, 26);
        }
    } else {
        // Calendar (Default fallback)
        start = new Date(year, month, 1);
        end = new Date(year, month + 1, 0); // Last day of current month
    }

    // Calculate Total Days (Inclusive)
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return {
        start,
        end,
        totalDays,
        label: `${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')}`
    };
};

export const formatDateForInput = (d: Date) => {
    // YYYY-MM-DD
    const iso = d.toLocaleString('sv').split(' ')[0]; // Little hack for reliable YYYY-MM-DD
    return iso;
};
