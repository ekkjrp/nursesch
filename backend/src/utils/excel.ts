import * as XLSX from 'xlsx';

// 근무표를 Excel로 내보내기 (FR-5.7)
export function exportToExcel(schedule: any, nurses: any[]): Buffer {
  const entries = schedule.entries;
  const yearMonth = schedule.yearMonth;
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // 헤더: 간호사명 + 1일~말일
  const headers = ['간호사'];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    headers.push(`${d}(${dayNames[date.getDay()]})`);
  }
  // 통계 열
  headers.push('D', 'E', 'N', 'O', 'X');

  const rows = nurses.map(nurse => {
    const row: (string | number)[] = [nurse.name];
    const counts: Record<string, number> = { D: 0, E: 0, N: 0, O: 0, X: 0 };

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
      const entry = entries.find((e: any) => e.nurseId === nurse.id && e.date === dateStr);
      const shift = entry?.shiftType || '';
      row.push(shift);
      if (shift && counts[shift] !== undefined) counts[shift]++;
    }

    row.push(counts.D, counts.E, counts.N, counts.O, counts.X);
    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${yearMonth} 근무표`);

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
