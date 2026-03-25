import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { ActiveUserData } from '@common/decorators/active-user.decorator';
import { DownloadReportDto, ReportType } from '../dto/download-report.dto';
import * as PDFDocumentModule from 'pdfkit';

const PDFDocument = (PDFDocumentModule as any).default || PDFDocumentModule;

// ============================================================
// Tema & Konstanta Visual
// ============================================================
const theme = {
  primary:     '#072C52',  // Biru Tua — header, aksen
  primaryLight:'#0F4C8A',  // Biru Muda — aksen sekunder
  secondary:   '#475569',  // Slate-600
  text:        '#1E293B',  // Slate-800
  textMuted:   '#64748B',  // Slate-500
  border:      '#E2E8F0',  // Slate-200
  bgStripe:    '#F8FAFC',  // Slate-50  — zebra
  bgBox:       '#F1F5F9',  // Slate-100 — summary card
  bgBoxBorder: '#CBD5E1',  // Slate-300
  credit:      '#059669',  // Emerald-600 — pemasukan
  creditBg:    '#ECFDF5',  // Emerald-50
  debit:       '#DC2626',  // Red-600   — pengeluaran
  debitBg:     '#FEF2F2',  // Red-50
  white:       '#FFFFFF',
  accent:      '#F59E0B',  // Amber-500 — separator strip
};

const PAGE_MARGIN = 40;
const FOOTER_HEIGHT = 55;

// ============================================================
// Helpers
// ============================================================
function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

function formatTanggal(date: Date): string {
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTanggalSingkat(date: Date): string {
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Konversi hex → [r, g, b] — untuk fillColor RGB API PDFKit
function hex(color: string): [number, number, number] {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return [r, g, b];
}

interface GroupTransactionsData {
  groupName: string;
  groupType: string;
  balance: number;
  totalCredit: number;
  totalDebit: number;
  transactions: {
    date: Date;
    description: string;
    type: string;
    amount: number;
    createdBy: string;
  }[];
}

// ============================================================
// Service
// ============================================================
@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async generateReport(dto: DownloadReportDto, user: ActiveUserData): Promise<Buffer> {
    if (user.roleType === 'RESIDENT') {
      dto.reportType = ReportType.SUMMARY;
      dto.groupId = undefined;
    }

    if (user.roleType === 'ADMIN') {
      if (dto.groupId && dto.groupId !== user.communityGroupId) {
        throw new ForbiddenException('Anda hanya dapat mengunduh laporan untuk lingkungan Anda sendiri.');
      }
      dto.reportType = ReportType.DETAIL;
      dto.groupId = user.communityGroupId;
    }

    const start = new Date(dto.startDate);
    const end   = new Date(dto.endDate);

    if (dto.reportType === ReportType.SUMMARY) {
      return this.generateSummaryReport(user, start, end);
    } else {
      const groupId = dto.groupId ?? user.communityGroupId;
      return this.generateDetailReport(groupId, user, start, end);
    }
  }

  // ============================================================
  // SUMMARY — Ringkasan seluruh RW + semua RT
  // ============================================================
  private async generateSummaryReport(
    user: ActiveUserData,
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    if (user.roleType === 'RESIDENT') {
      const ownGroup = await this.prisma.communityGroup.findUnique({
        where: { id: user.communityGroupId },
        include: {
          wallet: true,
          parent: {
            include: {
              wallet: true,
            },
          },
        },
      });

      if (!ownGroup) throw new NotFoundException('Data lingkungan warga tidak ditemukan');

      const relatedGroups = ownGroup.parent ? [ownGroup.parent, ownGroup] : [ownGroup];
      const allGroupIds = relatedGroups.map((group) => group.id);

      const transactions = await this.prisma.transaction.findMany({
        where: {
          wallet: { communityGroupId: { in: allGroupIds } },
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          wallet: { include: { communityGroup: { select: { name: true, type: true } } } },
          createdBy: { select: { fullName: true } },
        },
      });

      const groupMap = new Map<number, GroupTransactionsData>();
      for (const group of relatedGroups) {
        groupMap.set(group.id, {
          groupName: group.name,
          groupType: group.type,
          balance: group.wallet ? Number(group.wallet.balance) : 0,
          totalCredit: 0,
          totalDebit: 0,
          transactions: [],
        });
      }

      for (const tx of transactions) {
        const entry = groupMap.get(tx.wallet.communityGroupId);
        if (!entry) continue;
        const amount = Number(tx.amount);
        if (tx.type === 'CREDIT') entry.totalCredit += amount;
        else entry.totalDebit += amount;
        entry.transactions.push({
          date: tx.createdAt,
          description: tx.description,
          type: tx.type,
          amount,
          createdBy: tx.createdBy?.fullName || 'Sistem',
        });
      }

      const summaryTitle = ownGroup.parent?.name ?? ownGroup.name;
      return this.buildSummaryPdf(summaryTitle, startDate, endDate, groupMap);
    }

    const rwGroup = await this.prisma.communityGroup.findUnique({
      where: { id: user.communityGroupId },
      include: {
        wallet: true,
        children: { orderBy: { name: 'asc' }, include: { wallet: true } },
      },
    });

    if (!rwGroup) throw new NotFoundException('Data RW tidak ditemukan');

    const allGroupIds = [rwGroup.id, ...rwGroup.children.map((c) => c.id)];

    const transactions = await this.prisma.transaction.findMany({
      where: {
        wallet: { communityGroupId: { in: allGroupIds } },
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        wallet: { include: { communityGroup: { select: { name: true, type: true } } } },
        createdBy: { select: { fullName: true } },
      },
    });

    const groupMap = new Map<number, GroupTransactionsData>();

    groupMap.set(rwGroup.id, {
      groupName: rwGroup.name, groupType: rwGroup.type,
      balance: rwGroup.wallet ? Number(rwGroup.wallet.balance) : 0,
      totalCredit: 0, totalDebit: 0, transactions: [],
    });

    for (const child of rwGroup.children) {
      groupMap.set(child.id, {
        groupName: child.name, groupType: child.type,
        balance: child.wallet ? Number(child.wallet.balance) : 0,
        totalCredit: 0, totalDebit: 0, transactions: [],
      });
    }

    for (const tx of transactions) {
      const entry = groupMap.get(tx.wallet.communityGroupId);
      if (!entry) continue;
      const amount = Number(tx.amount);
      if (tx.type === 'CREDIT') entry.totalCredit += amount;
      else entry.totalDebit += amount;
      entry.transactions.push({
        date: tx.createdAt, description: tx.description,
        type: tx.type, amount, createdBy: tx.createdBy?.fullName || 'Sistem',
      });
    }

    return this.buildSummaryPdf(rwGroup.name, startDate, endDate, groupMap);
  }

  // ============================================================
  // DETAIL — Laporan untuk 1 group saja
  // ============================================================
  private async generateDetailReport(
    groupId: number,
    user: ActiveUserData,
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const group = await this.prisma.communityGroup.findUnique({
      where: { id: groupId },
      include: { wallet: true, parent: { select: { id: true, name: true } } },
    });

    if (!group) throw new NotFoundException('Data lingkungan tidak ditemukan');

    if (user.roleType === 'LEADER') {
      const isOwn   = group.id === user.communityGroupId;
      const isChild = group.parentId === user.communityGroupId;
      if (!isOwn && !isChild)
        throw new ForbiddenException('Anda tidak memiliki akses ke lingkungan ini.');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        wallet: { communityGroupId: groupId },
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        createdBy: { select: { fullName: true } },
        event:     { select: { title: true } },
      },
    });

    const mapped = transactions.map((tx) => ({
      date:        tx.createdAt,
      description: tx.description,
      type:        tx.type,
      amount:      Number(tx.amount),
      createdBy:   tx.createdBy?.fullName || 'Sistem',
      event:       tx.event?.title || null,
    }));

    const totalCredit = mapped.filter((t) => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0);
    const totalDebit  = mapped.filter((t) => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0);

    return this.buildDetailPdf(
      group.name, group.type,
      group.wallet ? Number(group.wallet.balance) : 0,
      startDate, endDate,
      totalCredit, totalDebit,
      mapped,
    );
  }

  // ============================================================
  // PDF Builder — SUMMARY
  // ============================================================
  private buildSummaryPdf(
    rwName: string,
    startDate: Date,
    endDate: Date,
    groupMap: Map<number, GroupTransactionsData>,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - PAGE_MARGIN * 2;
      const startX    = PAGE_MARGIN;

      this.drawDocumentHeader(doc, 'Ringkasan Eksekutif Keuangan', rwName, startDate, endDate);

      // ---- Hitung grand total ----
      let grandCredit = 0, grandDebit = 0, grandBalance = 0;
      for (const [, d] of groupMap) {
        grandCredit  += d.totalCredit;
        grandDebit   += d.totalDebit;
        grandBalance += d.balance;
      }

      // ---- KPI Cards (3 box) ----
      this.drawKpiCards(doc, startX, pageWidth, [
        { label: 'Total Pemasukan',  value: grandCredit,  color: theme.credit,    bg: theme.creditBg },
        { label: 'Total Pengeluaran',value: grandDebit,   color: theme.debit,     bg: theme.debitBg  },
        { label: 'Total Saldo Aktif',value: grandBalance, color: theme.primary,   bg: theme.bgBox    },
      ]);

      doc.moveDown(1.5);

      // ---- Section title ----
      this.drawSectionTitle(doc, startX, 'Ringkasan per Lingkungan');

      // ---- Summary Table ----
      const colW = [pageWidth * 0.35, pageWidth * 0.20, pageWidth * 0.20, pageWidth * 0.25];
      let y = doc.y;

      // Header baris
      doc.fillColor(theme.primary).rect(startX, y, pageWidth, 22).fill();
      const hY = y + 7;
      doc.fontSize(9).font('Helvetica-Bold').fillColor(theme.white);
      doc.text('Lingkungan',   startX + 6,                            hY, { width: colW[0] - 6 });
      doc.text('Pemasukan',    startX + colW[0],                      hY, { width: colW[1] - 6, align: 'right' });
      doc.text('Pengeluaran',  startX + colW[0] + colW[1],            hY, { width: colW[2] - 6, align: 'right' });
      doc.text('Saldo Akhir',  startX + colW[0] + colW[1] + colW[2], hY, { width: colW[3] - 6, align: 'right' });
      y += 22;

      let idx = 0;
      for (const [, data] of groupMap) {
        if (y > doc.page.height - FOOTER_HEIGHT - 30) { doc.addPage(); y = PAGE_MARGIN; }

        if (idx % 2 === 0) doc.fillColor(theme.bgStripe).rect(startX, y, pageWidth, 22).fill();

        const rY = y + 7;
        doc.fontSize(9).font('Helvetica').fillColor(theme.text);
        doc.text(data.groupName,              startX + 6,                            rY, { width: colW[0] - 6 });
        doc.fillColor(theme.credit).text(formatRupiah(data.totalCredit),  startX + colW[0],                      rY, { width: colW[1] - 6, align: 'right' });
        doc.fillColor(theme.debit ).text(formatRupiah(data.totalDebit),   startX + colW[0] + colW[1],            rY, { width: colW[2] - 6, align: 'right' });
        doc.fillColor(theme.text  ).font('Helvetica-Bold').text(formatRupiah(data.balance), startX + colW[0] + colW[1] + colW[2], rY, { width: colW[3] - 6, align: 'right' });

        y += 22; idx++;
      }

      // Baris total
      doc.fillColor(theme.primaryLight).rect(startX, y, pageWidth, 24).fill();
      const tY = y + 7;
      doc.fontSize(9).font('Helvetica-Bold').fillColor(theme.white);
      doc.text('TOTAL KESELURUHAN',    startX + 6,                            tY, { width: colW[0] - 6 });
      doc.text(formatRupiah(grandCredit),  startX + colW[0],                      tY, { width: colW[1] - 6, align: 'right' });
      doc.text(formatRupiah(grandDebit),   startX + colW[0] + colW[1],            tY, { width: colW[2] - 6, align: 'right' });
      doc.text(formatRupiah(grandBalance), startX + colW[0] + colW[1] + colW[2], tY, { width: colW[3] - 6, align: 'right' });
      y += 24;

      doc.y = y;
      doc.moveDown(2);

      // ---- Detail transaksi per grup ----
      let hasAnyTransaction = false;
      for (const [, data] of groupMap) {
        if (data.transactions.length === 0) continue;
        hasAnyTransaction = true;

        if (doc.y > doc.page.height - FOOTER_HEIGHT - 150) doc.addPage();

        this.drawSectionTitle(doc, startX, `Rincian Transaksi: ${data.groupName}`);
        this.drawTransactionTable(doc, data.transactions, pageWidth, startX);
        doc.moveDown(2);
      }

      if (!hasAnyTransaction) {
        this.drawEmptyState(doc, startX, pageWidth, 'Tidak ada transaksi dalam periode yang dipilih.');
      }

      this.addFooter(doc);
      doc.end();
    });
  }

  // ============================================================
  // PDF Builder — DETAIL (1 grup)
  // ============================================================
  private buildDetailPdf(
    groupName: string,
    groupType: string,
    balance: number,
    startDate: Date,
    endDate: Date,
    totalCredit: number,
    totalDebit: number,
    transactions: {
      date: Date; description: string; type: string;
      amount: number; createdBy: string; event: string | null;
    }[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - PAGE_MARGIN * 2;
      const startX    = PAGE_MARGIN;
      const nett      = totalCredit - totalDebit;

      this.drawDocumentHeader(doc, 'Laporan Rincian Keuangan', `${groupName} (${groupType})`, startDate, endDate);

      // ---- KPI Cards (4 box) ----
      this.drawKpiCards(doc, startX, pageWidth, [
        { label: 'Total Pemasukan',   value: totalCredit, color: theme.credit,  bg: theme.creditBg },
        { label: 'Total Pengeluaran', value: totalDebit,  color: theme.debit,   bg: theme.debitBg  },
        { label: 'Selisih Bersih',    value: nett,        color: nett >= 0 ? theme.credit : theme.debit, bg: nett >= 0 ? theme.creditBg : theme.debitBg },
        { label: 'Saldo Akhir',       value: balance,     color: theme.primary, bg: theme.bgBox    },
      ]);

      doc.moveDown(1.5);

      // ---- Tabel transaksi ----
      this.drawSectionTitle(doc, startX, 'Rincian Transaksi');

      if (transactions.length > 0) {
        this.drawTransactionTable(
          doc,
          transactions.map((t) => ({
            date:        t.date,
            description: t.event ? `${t.description}\n[Kegiatan: ${t.event}]` : t.description,
            type:        t.type,
            amount:      t.amount,
            createdBy:   t.createdBy,
          })),
          pageWidth,
          startX,
        );
      } else {
        this.drawEmptyState(doc, startX, pageWidth, 'Tidak ada transaksi pada periode yang dipilih.');
      }

      this.addFooter(doc);
      doc.end();
    });
  }

  // ============================================================
  // SHARED UI COMPONENTS
  // ============================================================

  /**
   * Header dokumen — bar biru + judul + subjudul + periode
   */
  private drawDocumentHeader(
    doc: PDFKit.PDFDocument,
    title: string,
    subtitle: string,
    startDate: Date,
    endDate: Date,
  ) {
    // Bar biru penuh di atas (lebih tebal → 8px)
    doc.fillColor(theme.primary).rect(0, 0, doc.page.width, 8).fill();

    // Aksen baris emas tipis di bawah bar biru
    doc.fillColor(theme.accent).rect(0, 8, doc.page.width, 3).fill();

    doc.y = PAGE_MARGIN + 10;

    // Judul
    doc.fillColor(theme.primary).fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });

    // Subjudul
    doc.fillColor(theme.text).fontSize(12).font('Helvetica').text(subtitle, { align: 'center' });
    doc.moveDown(0.25);

    // Periode — dengan background pill
    const periodeText = `Periode: ${formatTanggal(startDate)} — ${formatTanggal(endDate)}`;
    const pillW  = 310;
    const pillH  = 20;
    const pillX  = (doc.page.width - pillW) / 2;
    const pillY  = doc.y;

    doc.roundedRect(pillX, pillY, pillW, pillH, 10).fill(theme.bgBox);
    doc.fillColor(theme.textMuted).fontSize(9.5).font('Helvetica')
       .text(periodeText, pillX, pillY + 5, { width: pillW, align: 'center' });

    doc.y = pillY + pillH + 14;

    // Garis pemisah
    doc.strokeColor(theme.border).lineWidth(1)
       .moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).stroke();

    doc.moveDown(1.2);
  }

  /**
   * KPI Cards — 3 atau 4 kartu sejajar dengan warna aksen masing-masing
   */
  private drawKpiCards(
    doc: PDFKit.PDFDocument,
    startX: number,
    pageWidth: number,
    cards: { label: string; value: number; color: string; bg: string }[],
  ) {
    const GAP   = 8;
    const count = cards.length;
    const cardW = (pageWidth - GAP * (count - 1)) / count;
    const cardH = 64;
    const y     = doc.y;

    for (let i = 0; i < count; i++) {
      const { label, value, color, bg } = cards[i];
      const x = startX + i * (cardW + GAP);

      // Background card
      doc.rect(x, y, cardW, cardH).fillAndStroke(bg, theme.bgBoxBorder);

      // Aksen warna kiri (bar vertikal 4px)
      doc.fillColor(color).rect(x, y + 0, 4, cardH - 0).fill();

      // Label
      doc.fillColor(theme.textMuted).fontSize(8).font('Helvetica')
         .text(label, x + 12, y + 13, { width: cardW - 16 });

      // Nilai
      doc.fillColor(color).fontSize(11.5).font('Helvetica-Bold')
         .text(formatRupiah(value), x + 12, y + 30, { width: cardW - 16 });
    }

    doc.y = y + cardH;
  }

  /**
   * Section Title — garis aksen + teks bold
   */
  private drawSectionTitle(doc: PDFKit.PDFDocument, startX: number, text: string) {
    const y = doc.y;

    // Blok aksen kiri
    doc.fillColor(theme.primary).rect(startX, y, 4, 16).fill();

    doc.fillColor(theme.primary).fontSize(11).font('Helvetica-Bold')
       .text(text, startX + 10, y + 2, { align: 'left' });

    doc.moveDown(0.6);
  }

  /**
   * Empty State — kotak abu-abu dengan pesan
   */
  private drawEmptyState(doc: PDFKit.PDFDocument, startX: number, pageWidth: number, message: string) {
    const y = doc.y;
    doc.roundedRect(startX, y, pageWidth, 44, 6)
       .fillAndStroke(theme.bgStripe, theme.border);

    doc.fillColor(theme.textMuted).fontSize(10).font('Helvetica-Oblique')
       .text(message, startX, y + 15, { width: pageWidth, align: 'center' });

    doc.y = y + 60;
  }

  /**
   * Tabel transaksi — dengan dynamic row height & label pill
   */
  private drawTransactionTable(
    doc: PDFKit.PDFDocument,
    transactions: { date: Date; description: string; type: string; amount: number; createdBy: string }[],
    pageWidth: number,
    startX: number,
  ) {
    const cols = [
      pageWidth * 0.12, // Tanggal
      pageWidth * 0.37, // Keterangan
      pageWidth * 0.14, // Tipe
      pageWidth * 0.19, // Nominal
      pageWidth * 0.18, // Oleh
    ];

    const HEADERS = ['Tanggal', 'Keterangan', 'Tipe', 'Nominal', 'Dicatat Oleh'];
    const PADDING = { v: 7, h: 6 };

    const drawHeader = (yPos: number) => {
      doc.fillColor(theme.primary).rect(startX, yPos, pageWidth, 22).fill();
      let cx = startX + PADDING.h;
      doc.fontSize(9).font('Helvetica-Bold').fillColor(theme.white);
      for (let i = 0; i < HEADERS.length; i++) {
        const align = (i === 3) ? 'right' : (i === 2 ? 'center' : 'left');
        doc.text(HEADERS[i], cx, yPos + PADDING.v, { width: cols[i] - PADDING.h, align });
        cx += cols[i];
      }
    };

    let y = doc.y;
    drawHeader(y);
    y += 22;

    for (let idx = 0; idx < transactions.length; idx++) {
      const tx       = transactions[idx];
      doc.fontSize(9);
      const descH    = doc.heightOfString(tx.description, { width: cols[1] - PADDING.h * 2 });
      const rowH     = Math.max(descH + PADDING.v * 2, 24);
      const isCredit = tx.type === 'CREDIT';

      // Page break
      if (y + rowH > doc.page.height - FOOTER_HEIGHT - 10) {
        doc.addPage();
        y = PAGE_MARGIN;
        drawHeader(y);
        y += 22;
      }

      // Zebra stripe
      if (idx % 2 === 0) {
        doc.fillColor(theme.bgStripe).rect(startX, y, pageWidth, rowH).fill();
      }

      // Vertical separator lines (sutbile)
      doc.strokeColor(theme.border).lineWidth(0.5);
      let lx = startX;
      for (let i = 0; i < cols.length - 1; i++) {
        lx += cols[i];
        doc.moveTo(lx, y + 4).lineTo(lx, y + rowH - 4).stroke();
      }

      const textY = y + PADDING.v;
      let cx = startX + PADDING.h;

      // Tanggal
      doc.fillColor(theme.textMuted).font('Helvetica').fontSize(8.5)
         .text(formatTanggalSingkat(tx.date), cx, textY, { width: cols[0] - PADDING.h });
      cx += cols[0];

      // Keterangan
      doc.fillColor(theme.text).fontSize(9)
         .text(tx.description, cx, textY, { width: cols[1] - PADDING.h * 2 });
      cx += cols[1];

      // Tipe — label pill berwarna
      const pillColor = isCredit ? theme.credit : theme.debit;
      const pillBg    = isCredit ? theme.creditBg : theme.debitBg;
      const label     = isCredit ? 'Masuk' : 'Keluar';
      const pillW     = cols[2] - PADDING.h * 2;
      const pillX     = cx + PADDING.h;
      const pillTY    = textY - 1;

      doc.roundedRect(pillX, pillTY, pillW, 14, 4).fill(pillBg);
      doc.fillColor(pillColor).font('Helvetica-Bold').fontSize(8)
         .text(label, pillX, pillTY + 3, { width: pillW, align: 'center' });
      cx += cols[2];

      // Nominal — warna sesuai tipe
      doc.fillColor(isCredit ? theme.credit : theme.debit).font('Helvetica-Bold').fontSize(9)
         .text(formatRupiah(tx.amount), cx, textY, { width: cols[3] - PADDING.h, align: 'right' });
      cx += cols[3];

      // Dicatat Oleh
      doc.fillColor(theme.textMuted).font('Helvetica').fontSize(8.5)
         .text(tx.createdBy, cx, textY, { width: cols[4] - PADDING.h });

      y += rowH;
    }

    // ---- Baris Total ----
    const totalCredit = transactions.filter((t) => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0);
    const totalDebit  = transactions.filter((t) => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0);
    const totalRowH   = 26;

    // Page break check untuk baris total
    if (y + totalRowH > doc.page.height - FOOTER_HEIGHT - 10) {
      doc.addPage();
      y = PAGE_MARGIN;
    }

    doc.fillColor(theme.primaryLight).rect(startX, y, pageWidth, totalRowH).fill();

    const tY = y + 8;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(theme.white);

    // Label "Total Transaksi"
    doc.text(
      `Total Transaksi: ${transactions.length}`,
      startX + PADDING.h,
      tY,
      { width: cols[0] + cols[1] + cols[2] - PADDING.h },
    );

    // Nominal kredit
    const nominalX = startX + cols[0] + cols[1] + cols[2];
    const nominalW = cols[3] - PADDING.h;
    if (totalCredit > 0 && totalDebit > 0) {
      // Tampilkan kredit & debit dalam 2 baris ringkas jika keduanya ada
      doc.fontSize(7.5).text(
        `+${formatRupiah(totalCredit)}`,
        nominalX, tY - 3,
        { width: nominalW, align: 'right' },
      );
      doc.text(
        `-${formatRupiah(totalDebit)}`,
        nominalX, tY + 7,
        { width: nominalW, align: 'right' },
      );
    } else if (totalCredit > 0) {
      doc.fontSize(9).text(formatRupiah(totalCredit), nominalX, tY, { width: nominalW, align: 'right' });
    } else {
      doc.fontSize(9).text(formatRupiah(totalDebit), nominalX, tY, { width: nominalW, align: 'right' });
    }

    y += totalRowH;

    doc.y = y + 6;
  }

  /**
   * Footer — halaman x dari n + timestamp cetak
   */
  private addFooter(doc: PDFKit.PDFDocument) {
    const pages     = doc.bufferedPageRange();
    const printDate = formatTanggalSingkat(new Date());
    const fY        = doc.page.height - 38;

    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      // Garis atas footer
      doc.strokeColor(theme.border).lineWidth(1)
         .moveTo(PAGE_MARGIN, fY - 8)
         .lineTo(doc.page.width - PAGE_MARGIN, fY - 8).stroke();

      // Bar biru bawah tipis
      doc.fillColor(theme.primary).rect(0, doc.page.height - 8, doc.page.width, 8).fill();

      doc.fontSize(8).font('Helvetica').fillColor(theme.textMuted);

      // Kiri — timestamp
      doc.text(`Dicetak pada: ${printDate}`, PAGE_MARGIN, fY, { align: 'left' });

      // Kanan — nomor halaman
      doc.text(
        `Halaman ${i + 1} dari ${pages.count}`,
        PAGE_MARGIN,
        fY,
        { align: 'right', width: doc.page.width - PAGE_MARGIN * 2 },
      );
    }
  }
}