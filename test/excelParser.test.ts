import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseExcelBuffer } from '../src/utils/excelParser';

describe('parseExcelBuffer', () => {
    it('parses a simple sheet to array of objects', async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Sheet1');
        sheet.addRow(['WSN', 'INBOUND_DATE', 'RACK_NO']);
        sheet.addRow(['WSN001', '2025-12-31', 'R1']);
        sheet.addRow(['WSN002', '01/01/2025', 'R2']);

        const buf = await workbook.xlsx.writeBuffer();
        const data = await parseExcelBuffer(Buffer.from(buf as any));

        expect(data.length).toBe(2);
        expect(data[0].WSN).toBe('WSN001');
        expect(data[0].INBOUND_DATE).toBe('2025-12-31');
        expect(data[1].WSN).toBe('WSN002');
    });
});
