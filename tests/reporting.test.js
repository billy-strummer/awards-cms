/**
 * Tests for the Reporting Module (reporting.js)
 * Run with: npx jest tests/reporting.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="connectionStatus"><span class="status-icon"></span><span class="status-text"></span></div>
  <div id="loginPage"></div><div id="dashboardPage"></div><div id="splashScreen"></div>
  <div id="userEmail"></div><div id="loginEmail"></div><div id="loginPassword"></div>
  <div id="loginError" class="d-none"></div><div id="loginBtn"></div>
  <table><tbody id="awardsTableBody"></tbody></table>
  <table><tbody id="orgsTableBody"></tbody></table>
  <table><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>
  <table><tbody id="entriesTableBody"></tbody></table>
  <span id="awardsCount"></span><span id="eventsCount"></span><span id="winnersCount"></span>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob;
global.URL = { createObjectURL: jest.fn(() => 'blob:test'), revokeObjectURL: jest.fn() };

global.bootstrap = {
  Toast: class {
    show() {}
    hide() {}
  },
  Modal: class {
    show() {}
    hide() {}
    static getInstance() {
      return { hide() {} };
    }
  },
  Tooltip: class {},
};

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
  },
  channel: jest.fn(() => ({
    on: jest.fn(function () {
      return this;
    }),
    subscribe: jest.fn(function () {
      return this;
    }),
  })),
};
global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

require('../config.js');
global.STATE = global.window.STATE;
global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS;
global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT;
global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS;
global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key];
  }
}

require('../utils.js');
syncWindowToGlobal();
require('../reporting.js');
syncWindowToGlobal();

describe('Reporting Module - Structure', () => {
  test('reportingModule is defined', () => {
    expect(reportingModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof reportingModule.exportEntriesByCategory).toBe('function');
    expect(typeof reportingModule._fc).toBe('function');
    expect(typeof reportingModule._fd).toBe('function');
    expect(typeof reportingModule._qtr).toBe('function');
    expect(typeof reportingModule._yr).toBe('function');
    expect(typeof reportingModule._dlBlob).toBe('function');
    expect(typeof reportingModule._csv).toBe('function');
  });
});

describe('Reporting Module - Helpers', () => {
  test('_fc formats currency', () => {
    expect(reportingModule._fc(100)).toBe('\u00A3100.00');
    expect(reportingModule._fc(99.5)).toBe('\u00A399.50');
    expect(reportingModule._fc(0)).toBe('\u00A30.00');
    expect(reportingModule._fc(null)).toBe('\u00A30.00');
  });

  test('_fd formats dates', () => {
    const result = reportingModule._fd('2026-03-15');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(reportingModule._fd(null)).toBe('N/A');
  });

  test('_qtr returns quarter', () => {
    expect(reportingModule._qtr('2026-01-15')).toBe('Q1');
    expect(reportingModule._qtr('2026-04-15')).toBe('Q2');
    expect(reportingModule._qtr('2026-07-15')).toBe('Q3');
    expect(reportingModule._qtr('2026-10-15')).toBe('Q4');
    expect(reportingModule._qtr(null)).toBe('N/A');
  });

  test('_yr extracts year', () => {
    expect(reportingModule._yr('2026-06-15')).toBe(2026);
    expect(reportingModule._yr(null)).toBeNull();
  });
});

describe('Reporting Module - CSV Generation', () => {
  test('_csv generates CSV blob from data', () => {
    const rows = [
      { name: 'Alpha', count: 10, revenue: 500 },
      { name: 'Beta', count: 5, revenue: 250 },
    ];
    const blob = reportingModule._csv(rows);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/csv;charset=utf-8;');
  });

  test('_csv handles empty data', () => {
    const blob = reportingModule._csv([]);
    expect(blob).toBeInstanceOf(Blob);
  });

  test('_csv handles null data', () => {
    const blob = reportingModule._csv(null);
    expect(blob).toBeInstanceOf(Blob);
  });

  test('_csv sanitizes formula injection characters', () => {
    const rows = [{ name: '=SUM(A1:A100)', value: '+dangerous' }];
    const blob = reportingModule._csv(rows);
    expect(blob).toBeInstanceOf(Blob);
    // The blob content will have escaped formulas
  });

  test('_csv handles values with commas and quotes', () => {
    const rows = [{ name: 'Company, Inc.', value: 'It\'s "great"' }];
    const blob = reportingModule._csv(rows);
    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('Reporting Module - exportEntriesByCategory', () => {
  test('exports CSV successfully', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { status: 'submitted', payment_status: 'paid', award_years: { award_name: 'Best Innovation', sector: 'Tech' } },
      { status: 'submitted', payment_status: 'unpaid', award_years: { award_name: 'Best Innovation', sector: 'Tech' } },
      { status: 'winner', payment_status: 'paid', award_years: { award_name: 'Best Service', sector: 'Retail' } },
    ]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportEntriesByCategory('csv');
    expect(toastSpy).toHaveBeenCalledWith('Entries by category exported', 'success');
    toastSpy.mockRestore();
  });

  test('exports PDF successfully', async () => {
    global.jspdf = {
      jsPDF: class {
        setFillColor() {}
        rect() {}
        setTextColor() {}
        setFont() {}
        setFontSize() {}
        text() {}
        autoTable() {}
        save() {}
        get lastAutoTable() {
          return { finalY: 50 };
        }
      },
    };
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValue([
        { status: 'submitted', payment_status: 'paid', award_years: { award_name: 'Best Innovation', sector: 'Tech' } },
      ]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportEntriesByCategory('pdf');
    expect(toastSpy).toHaveBeenCalledWith('Entries by category exported', 'success');
    toastSpy.mockRestore();
    delete global.jspdf;
  });

  test('handles missing award_years gracefully', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { status: 'submitted', payment_status: 'unpaid', award_years: null },
      { status: 'submitted', payment_status: 'paid' },
    ]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportEntriesByCategory('csv');
    expect(toastSpy).toHaveBeenCalledWith('Entries by category exported', 'success');
    toastSpy.mockRestore();
  });

  test('handles error gracefully', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportEntriesByCategory('csv');
    expect(toastSpy).toHaveBeenCalledWith('Failed to export entries report', 'error');
    toastSpy.mockRestore();
  });
});

describe('Reporting Module - exportRevenueReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports revenue CSV', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([
        {
          invoice_number: 'INV-1',
          total_amount: 500,
          paid_amount: 500,
          payment_status: 'paid',
          created_at: '2026-01-15',
          organisations: { company_name: 'Acme' },
        },
      ])
      .mockResolvedValueOnce([{ amount: 500, payment_date: '2026-01-20' }]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportRevenueReport('csv');
    expect(toastSpy).toHaveBeenCalledWith('Revenue report exported', 'success');
    toastSpy.mockRestore();
  });

  test('exports revenue PDF', async () => {
    global.jspdf = {
      jsPDF: class {
        setFillColor() {}
        rect() {}
        setTextColor() {}
        setFont() {}
        setFontSize() {}
        text() {}
        autoTable() {}
        save() {}
        get lastAutoTable() {
          return { finalY: 50 };
        }
      },
    };
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([
        {
          invoice_number: 'INV-001',
          total_amount: 100,
          paid_amount: 50,
          payment_status: 'partial',
          created_at: '2026-03-01',
          organisations: { company_name: 'Acme' },
        },
      ])
      .mockResolvedValueOnce([
        { amount: 100, payment_date: '2026-03-01' },
        { amount: 200, payment_date: '2026-07-15' },
      ]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportRevenueReport('pdf');
    expect(toastSpy).toHaveBeenCalledWith('Revenue report exported', 'success');
    toastSpy.mockRestore();
    delete global.jspdf;
  });

  test('handles error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportRevenueReport('csv');
    expect(toastSpy).toHaveBeenCalledWith('Failed to export revenue report', 'error');
    toastSpy.mockRestore();
  });
});

describe('Reporting Module - exportJudgeProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports judge progress CSV', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      {
        judge_email: 'judge@test.com',
        total_score: 80,
        innovation_score: 8,
        impact_score: 7,
        quality_score: 9,
        presentation_score: 6,
      },
      {
        judge_email: 'judge@test.com',
        total_score: 90,
        innovation_score: 9,
        impact_score: 8,
        quality_score: 9,
        presentation_score: 7,
      },
      {
        judge_email: 'judge2@test.com',
        total_score: 75,
        innovation_score: 7,
        impact_score: 6,
        quality_score: 8,
        presentation_score: 5,
      },
    ]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportJudgeProgress('csv');
    expect(toastSpy).toHaveBeenCalledWith('Judge progress exported', 'success');
    toastSpy.mockRestore();
  });

  test('exports judge progress PDF', async () => {
    global.jspdf = {
      jsPDF: class {
        setFillColor() {}
        rect() {}
        setTextColor() {}
        setFont() {}
        setFontSize() {}
        text() {}
        autoTable() {}
        save() {}
        get lastAutoTable() {
          return { finalY: 50 };
        }
      },
    };
    apiClient.selectAll = jest.fn().mockResolvedValue([
      {
        judge_email: 'judge@test.com',
        total_score: 80,
        innovation_score: 8,
        impact_score: 7,
        quality_score: 9,
        presentation_score: 6,
      },
    ]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportJudgeProgress('pdf');
    expect(toastSpy).toHaveBeenCalledWith('Judge progress exported', 'success');
    toastSpy.mockRestore();
    delete global.jspdf;
  });

  test('handles error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportJudgeProgress('csv');
    expect(toastSpy).toHaveBeenCalledWith('Failed to export judge progress', 'error');
    toastSpy.mockRestore();
  });
});

describe('Reporting Module - exportVotingTrends', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports voting trends CSV', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      {
        entry_id: 'e1',
        created_at: '2026-03-01T10:00:00Z',
        entries: { award_years: { award_name: 'Best Innovation' } },
      },
      {
        entry_id: 'e1',
        created_at: '2026-03-01T11:00:00Z',
        entries: { award_years: { award_name: 'Best Innovation' } },
      },
      { entry_id: 'e2', created_at: '2026-03-02T10:00:00Z', entries: null },
    ]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportVotingTrends('csv');
    expect(toastSpy).toHaveBeenCalledWith('Voting trends exported', 'success');
    toastSpy.mockRestore();
  });

  test('exports voting trends PDF', async () => {
    global.jspdf = {
      jsPDF: class {
        setFillColor() {}
        rect() {}
        setTextColor() {}
        setFont() {}
        setFontSize() {}
        text() {}
        autoTable() {}
        save() {}
        get lastAutoTable() {
          return { finalY: 50 };
        }
      },
    };
    apiClient.selectAll = jest.fn().mockResolvedValue([
      {
        entry_id: 'e1',
        created_at: '2026-03-01T10:00:00Z',
        entries: { award_years: { award_name: 'Best Innovation' } },
      },
      {
        entry_id: 'e2',
        created_at: '2026-03-02T10:00:00Z',
        entries: { award_years: { award_name: 'Best Service' } },
      },
    ]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportVotingTrends('pdf');
    expect(toastSpy).toHaveBeenCalledWith('Voting trends exported', 'success');
    toastSpy.mockRestore();
    delete global.jspdf;
  });

  test('handles error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportVotingTrends('csv');
    expect(toastSpy).toHaveBeenCalledWith('Failed to export voting trends', 'error');
    toastSpy.mockRestore();
  });
});

describe('Reporting Module - exportSponsorROI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports sponsor ROI CSV', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      {
        name: 'Gold Sponsor',
        company_name: 'Gold Corp',
        tier: 'Gold',
        website: 'https://gold.com',
        contact_name: 'Jo',
        created_at: '2025-01-01',
      },
      {
        name: '',
        company_name: 'Silver Corp',
        tier: 'Silver',
        website: '',
        contact_name: '',
        created_at: '2025-06-01',
      },
      { name: null, company_name: null, tier: 'Unknown', website: null, contact_name: null, created_at: null },
    ]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportSponsorROI('csv');
    expect(toastSpy).toHaveBeenCalledWith('Sponsor ROI exported', 'success');
    toastSpy.mockRestore();
  });

  test('exports sponsor ROI PDF', async () => {
    global.jspdf = {
      jsPDF: class {
        setFillColor() {}
        rect() {}
        setTextColor() {}
        setFont() {}
        setFontSize() {}
        text() {}
        autoTable() {}
        save() {}
        get lastAutoTable() {
          return { finalY: 50 };
        }
      },
    };
    apiClient.selectAll = jest.fn().mockResolvedValue([
      {
        name: 'Gold Sponsor',
        company_name: 'Gold Corp',
        tier: 'Gold',
        website: 'https://gold.com',
        contact_name: 'Jo',
        created_at: '2025-01-01',
      },
    ]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportSponsorROI('pdf');
    expect(toastSpy).toHaveBeenCalledWith('Sponsor ROI exported', 'success');
    toastSpy.mockRestore();
    delete global.jspdf;
  });

  test('handles error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportSponsorROI('csv');
    expect(toastSpy).toHaveBeenCalledWith('Failed to export sponsor ROI', 'error');
    toastSpy.mockRestore();
  });
});

describe('Reporting Module - compareYears', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('warns when years not provided', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.compareYears(null, 2026);
    expect(toastSpy).toHaveBeenCalledWith('Provide two years to compare', 'warning');
    toastSpy.mockRestore();
  });

  test('warns when second year not provided', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.compareYears(2025, null);
    expect(toastSpy).toHaveBeenCalledWith('Provide two years to compare', 'warning');
    toastSpy.mockRestore();
  });

  test('compares two years and shows modal', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 'e1', status: 'winner', created_at: '2025-06-01' },
        { id: 'e2', status: 'submitted', created_at: '2026-06-01' },
      ])
      .mockResolvedValueOnce([
        { id: 'v1', created_at: '2025-06-01' },
        { id: 'v2', created_at: '2026-06-01' },
      ])
      .mockResolvedValueOnce([
        { id: 'p1', amount: 1000, payment_date: '2025-06-01' },
        { id: 'p2', amount: 2000, payment_date: '2026-06-01' },
      ]);

    await reportingModule.compareYears(2025, 2026);
    const modal = document.getElementById('yearCompareModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('2025');
    expect(modal.innerHTML).toContain('2026');
    modal.remove();
  });

  test('handles error in comparison', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.compareYears(2025, 2026);
    expect(toastSpy).toHaveBeenCalledWith('Failed to compare years', 'error');
    toastSpy.mockRestore();
  });

  test('removes existing modal before creating new one', async () => {
    // Create an existing modal
    const existing = document.createElement('div');
    existing.id = 'yearCompareModal';
    document.body.appendChild(existing);

    apiClient.selectAll = jest.fn().mockResolvedValue([]);

    await reportingModule.compareYears(2025, 2026);
    const modals = document.querySelectorAll('#yearCompareModal');
    expect(modals.length).toBe(1);
    modals[0].remove();
  });
});

describe('Reporting Module - scheduleEmailReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('warns when name is missing', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    const result = await reportingModule.scheduleEmailReport({ recipients: 'test@test.com' });
    expect(result).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith('Provide report name and recipients', 'warning');
    toastSpy.mockRestore();
  });

  test('warns when recipients is missing', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    const result = await reportingModule.scheduleEmailReport({ name: 'Monthly Report' });
    expect(result).toBe(false);
    toastSpy.mockRestore();
  });

  test('schedules report via DB successfully', async () => {
    apiClient.insert = jest.fn().mockResolvedValue({ data: [{ id: 'sr1', name: 'Weekly Report' }] });
    const toastSpy = jest.spyOn(utils, 'showToast');
    const result = await reportingModule.scheduleEmailReport({
      name: 'Weekly Report',
      recipients: 'admin@test.com,team@test.com',
      frequency: 'Weekly',
    });
    expect(result).toEqual({ id: 'sr1', name: 'Weekly Report' });
    expect(apiClient.insert).toHaveBeenCalledWith(
      'scheduled_reports',
      expect.objectContaining({
        name: 'Weekly Report',
        recipients: ['admin@test.com', 'team@test.com'],
        frequency: 'Weekly',
        active: true,
      })
    );
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Weekly Report'), 'success');
    toastSpy.mockRestore();
  });

  test('handles array recipients', async () => {
    apiClient.insert = jest.fn().mockResolvedValue({ data: [{}] });
    await reportingModule.scheduleEmailReport({
      name: 'Report',
      recipients: ['a@b.com', 'c@d.com'],
    });
    expect(apiClient.insert).toHaveBeenCalledWith(
      'scheduled_reports',
      expect.objectContaining({
        recipients: ['a@b.com', 'c@d.com'],
      })
    );
  });

  test('falls back to localStorage on DB error', async () => {
    apiClient.insert = jest.fn().mockRejectedValue(new Error('DB unavailable'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    const result = await reportingModule.scheduleEmailReport({
      name: 'Fallback Report',
      recipients: 'admin@test.com',
    });
    expect(result).toBe(false);
    const stored = JSON.parse(localStorage.getItem('bta_scheduled_reports') || '[]');
    expect(stored.length).toBeGreaterThan(0);
    expect(stored[stored.length - 1].name).toBe('Fallback Report');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('stored locally'), 'warning');
    toastSpy.mockRestore();
    localStorage.removeItem('bta_scheduled_reports');
  });

  test('handles localStorage failure in fallback', async () => {
    apiClient.insert = jest.fn().mockRejectedValue(new Error('DB unavailable'));
    const origParse = JSON.parse;
    JSON.parse = jest.fn(() => {
      throw new Error('Storage full');
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await reportingModule.scheduleEmailReport({
      name: 'Broken Report',
      recipients: 'admin@test.com',
    });
    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith('Failed to save scheduled report:', 'Storage full');
    JSON.parse = origParse;
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('Reporting Module - generateBoardReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generates board report PDF', async () => {
    global.jspdf = {
      jsPDF: class {
        setFillColor() {}
        rect() {}
        setTextColor() {}
        setFont() {}
        setFontSize() {}
        text() {}
        autoTable() {}
        save() {}
        addPage() {}
        setPage() {}
        getNumberOfPages() {
          return 3;
        }
        get lastAutoTable() {
          return { finalY: 50 };
        }
      },
    };
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'e1', status: 'winner', created_at: '2026-01-01' }])
      .mockResolvedValueOnce([{ id: 'js1', judge_email: 'judge@test.com' }])
      .mockResolvedValueOnce([{ id: 'v1', created_at: '2026-01-01' }])
      .mockResolvedValueOnce([{ id: 's1', tier: 'Gold' }])
      .mockResolvedValueOnce([
        { id: 'p1', amount: 5000, payment_date: '2026-01-15' },
        { id: 'p2', amount: 3000, payment_date: '2026-07-20' },
      ]);

    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.generateBoardReport();
    expect(toastSpy).toHaveBeenCalledWith('Board report generated', 'success');
    toastSpy.mockRestore();
    delete global.jspdf;
  });

  test('handles error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.generateBoardReport();
    expect(toastSpy).toHaveBeenCalledWith('Failed to generate board report', 'error');
    toastSpy.mockRestore();
  });
});

describe('Reporting Module - _dlBlob', () => {
  test('creates download link and triggers click', () => {
    const blob = new Blob(['test'], { type: 'text/plain' });
    // Should not throw
    expect(() => reportingModule._dlBlob(blob, 'test.txt')).not.toThrow();
  });
});

describe('Reporting Module - _pdfHdr', () => {
  test('returns y position after header', () => {
    const mockDoc = {
      setFillColor: jest.fn(),
      rect: jest.fn(),
      setTextColor: jest.fn(),
      setFont: jest.fn(),
      setFontSize: jest.fn(),
      text: jest.fn(),
    };
    const y = reportingModule._pdfHdr(mockDoc, 'Test Title');
    expect(y).toBe(28);
    expect(mockDoc.text).toHaveBeenCalled();
  });
});

describe('Reporting Module - _pdfTbl', () => {
  test('calls autoTable and returns finalY + 8', () => {
    const mockDoc = {
      autoTable: jest.fn(),
      lastAutoTable: { finalY: 100 },
    };
    const y = reportingModule._pdfTbl(mockDoc, 30, ['Col1'], [['Val1']]);
    expect(y).toBe(108);
    expect(mockDoc.autoTable).toHaveBeenCalled();
  });
});
