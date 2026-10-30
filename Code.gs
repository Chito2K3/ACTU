/**
 * Amang Rodriguez Memorial Medical Center (ARMMC)
 * Pharmacy Chemotherapy Compounding Log - Web App Backend
 * Google Apps Script (Code.gs)
 *
 * Core Architecture:
 * - Direct Patient-Centric CRUD against Master_Patients
 * - Multi-Schedule Chemo Therapy Tracking per Patient
 * - Automatic Last Visit date recording
 * - Comprehensive Clinical Batch Tracking (Lot Number & Expiry Date)
 * - Separated Clinical Dosage, Quantity Required, and Funding Source (CAF, CSPMAP, Outside Purchase)
 * - Unique Medicine Formulary Engine (Deduplicated, pure medicine names without DMR codes)
 * - On-the-Fly Medicine Addition to the Medicine repository
 * - Automated Spreadsheet Tab Cleanup (Retaining ONLY Master_Patients and Medicine)
 */

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================

const CONFIG = {
  INSTITUTION_NAME: 'Amang Rodriguez Memorial Medical Center',
  UNIT_NAME: 'Pharmacy Chemotherapy Compounding Log',
  MASTER_PATIENT_SHEET: 'Master_Patients',
  MEDICINE_SHEET: 'Medicine',
  COLORS: {
    HEADER_BLUE: '#1C3D5A',
    HEADER_ORANGE: '#D97706',
    WHITE: '#FFFFFF',
    LIGHT_GRAY: '#F8FAFC'
  }
};

/**
 * Serves the Web App frontend (index.html)
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Amang Rodriguez Memorial Medical Center - Pharmacy Chemotherapy Compounding Log')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Returns the active spreadsheet instance.
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ==========================================
// INITIALIZATION & DIRECT DATA APIS
// ==========================================

/**
 * Loads all initial application state:
 * - Patient session records from Master_Patients
 * - Unique deduplicated medicines from Medicine
 */
function getInitialData() {
  const ss = getSpreadsheet();
  ensureRequiredSheets(ss);

  const patients = getPatientsList();
  const medData = getUniqueMedicineList();

  return {
    institution: CONFIG.INSTITUTION_NAME,
    unit: CONFIG.UNIT_NAME,
    patients: patients,
    medicines: medData.oncologyMedicines || [], // Curated oncology & chemo medicines (default)
    allHospitalMedicines: medData.allMedicines || [] // Full hospital formulary
  };
}

/**
 * Ensures Master_Patients and Medicine sheets exist with proper headers.
 * Seamlessly adds missing clinical columns without altering or losing existing rows.
 */
function ensureRequiredSheets(ss) {
  let masterSheet = ss.getSheetByName(CONFIG.MASTER_PATIENT_SHEET);
  if (!masterSheet) {
    masterSheet = ss.insertSheet(CONFIG.MASTER_PATIENT_SHEET);
    masterSheet.appendRow([
      'Patient Name',
      'Diagnosis',
      'Therapy Schedule',
      'Chemo Protocol',
      'Brand Name',
      'Lot Number',
      'Expiry Date',
      'Dosage',
      'Quantity Required',
      'Funding Source',
      'Created Date',
      'Last Visit'
    ]);
    masterSheet.getRange(1, 1, 1, 12).setBackground(CONFIG.COLORS.HEADER_BLUE).setFontColor('#FFFFFF').setFontWeight('bold');
    masterSheet.setFrozenRows(1);
  } else {
    // If sheet exists, ensure all required columns are present
    const lastCol = masterSheet.getLastColumn();
    if (lastCol > 0) {
      const headers = masterSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
        return String(h || '').toUpperCase().trim();
      });
      const missingHeaders = [];

      if (!headers.some(function(h) { return h.includes('SCHEDULE'); })) missingHeaders.push('Therapy Schedule');
      if (!headers.some(function(h) { return h.includes('BRAND'); })) missingHeaders.push('Brand Name');
      if (!headers.some(function(h) { return h.includes('LOT'); })) missingHeaders.push('Lot Number');
      if (!headers.some(function(h) { return h.includes('EXPIR'); })) missingHeaders.push('Expiry Date');
      if (!headers.some(function(h) { return h.includes('QUANTITY') || h === 'QTY'; })) missingHeaders.push('Quantity Required');
      if (!headers.some(function(h) { return h.includes('SOURCE') || h.includes('FUNDING') || h.includes('CAF') || h.includes('CSPMAP'); })) missingHeaders.push('Funding Source');

      if (missingHeaders.length > 0) {
        const currentLast = masterSheet.getLastColumn();
        for (let i = 0; i < missingHeaders.length; i++) {
          const colIdx = currentLast + 1 + i;
          masterSheet.getRange(1, colIdx)
            .setValue(missingHeaders[i])
            .setBackground(CONFIG.COLORS.HEADER_BLUE)
            .setFontColor('#FFFFFF')
            .setFontWeight('bold');
        }
      }
    }
  }

  let medSheet = ss.getSheetByName(CONFIG.MEDICINE_SHEET);
  if (!medSheet) {
    medSheet = ss.insertSheet(CONFIG.MEDICINE_SHEET);
    medSheet.appendRow(['Code', 'Medicine']);
    medSheet.getRange(1, 1, 1, 2).setBackground(CONFIG.COLORS.HEADER_ORANGE).setFontColor('#FFFFFF').setFontWeight('bold');
    medSheet.setFrozenRows(1);
  }
}

// ==========================================
// MASTER PATIENTS CRUD & MULTI-SCHEDULE ENGINE
// ==========================================

/**
 * Dynamically resolves column indices in Master_Patients to accommodate
 * existing sheets whether headers are 'Last Protocol', 'Last Dosage', etc.
 */
function getMasterPatientColumnMap(sheet) {
  const lastCol = sheet.getLastColumn();
  const maxCols = Math.min(Math.max(lastCol, 15), sheet.getMaxColumns());
  const headers = maxCols > 0 ? sheet.getRange(1, 1, 1, maxCols).getValues()[0] : [];
  const map = {
    nameCol: -1,
    diagCol: -1,
    schedCol: -1,
    protoCol: -1,
    brandCol: -1,
    lotCol: -1,
    expiryCol: -1,
    dosageCol: -1,
    qtyCol: -1,
    sourceCol: -1,
    lastVisitCol: -1,
    createdCol: -1,
    hospCol: -1
  };

  for (let c = 0; c < headers.length; c++) {
    const h = String(headers[c] || '').toUpperCase().trim();
    if (h.includes('PATIENT NAME') || h === 'NAME') map.nameCol = c;
    else if (h.includes('DIAGNOSIS')) map.diagCol = c;
    else if (h.includes('SCHEDULE') || h.includes('THERAPY SCHEDULE')) map.schedCol = c;
    else if (h.includes('PROTOCOL')) map.protoCol = c;
    else if (h.includes('BRAND')) map.brandCol = c;
    else if (h.includes('LOT')) map.lotCol = c;
    else if (h.includes('EXPIR') || h.includes('EXPIRY')) map.expiryCol = c;
    else if (h.includes('QUANTITY') || h === 'QTY' || h.includes('QTY')) map.qtyCol = c;
    else if (h.includes('SOURCE') || h.includes('FUNDING') || h.includes('CAF') || h.includes('CSPMAP')) map.sourceCol = c;
    else if (h.includes('DOSAGE')) map.dosageCol = c;
    else if (h.includes('LAST VISIT') || h === 'VISIT') map.lastVisitCol = c;
    else if (h.includes('CREATED')) map.createdCol = c;
    else if (h.includes('HOSPITAL')) map.hospCol = c;
  }

  // Fallbacks if headers were generic or not yet labeled
  if (map.nameCol === -1) map.nameCol = map.hospCol === 0 ? 1 : 0;
  if (map.diagCol === -1) map.diagCol = map.nameCol + 1;
  if (map.protoCol === -1) map.protoCol = map.diagCol + 1;
  if (map.brandCol === -1) map.brandCol = map.protoCol + 1;
  if (map.dosageCol === -1) map.dosageCol = map.brandCol + 1;
  if (map.lastVisitCol === -1) map.lastVisitCol = map.dosageCol + 1;
  if (map.createdCol === -1) map.createdCol = map.lastVisitCol + 1;

  return map;
}

/**
 * Retrieves all patient treatment schedule records from Master_Patients.
 */
function getPatientsList() {
  const ss = getSpreadsheet();
  ensureRequiredSheets(ss);
  const sheet = ss.getSheetByName(CONFIG.MASTER_PATIENT_SHEET);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const colMap = getMasterPatientColumnMap(sheet);
  const numCols = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  const patients = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const name = String(row[colMap.nameCol] || '').trim();
    if (!name) continue;

    const diag = colMap.diagCol >= 0 ? String(row[colMap.diagCol] || '').trim() : '';
    const proto = colMap.protoCol >= 0 ? String(row[colMap.protoCol] || '').trim() : '';
    const brand = colMap.brandCol >= 0 ? String(row[colMap.brandCol] || '').trim() : '';
    const lot = colMap.lotCol >= 0 ? String(row[colMap.lotCol] || '').trim() : '';
    const dosage = colMap.dosageCol >= 0 ? String(row[colMap.dosageCol] || '').trim() : '';
    const qty = colMap.qtyCol >= 0 ? String(row[colMap.qtyCol] || '').trim() : '';
    const source = colMap.sourceCol >= 0 ? String(row[colMap.sourceCol] || '').trim() : '';

    // Format dates cleanly MM/DD/YYYY
    let scheduleStr = '';
    if (colMap.schedCol >= 0) {
      scheduleStr = formatToMMDDYYYY(row[colMap.schedCol]);
    }

    let expiryStr = '';
    if (colMap.expiryCol >= 0) {
      expiryStr = formatToMMDDYYYY(row[colMap.expiryCol]);
    }

    let lastVisitStr = '';
    if (colMap.lastVisitCol >= 0) {
      lastVisitStr = formatToMMDDYYYY(row[colMap.lastVisitCol]);
    }

    patients.push({
      rowIndex: i + 2, // 1-indexed sheet row
      name: name,
      diagnosis: diag,
      scheduleDate: scheduleStr || lastVisitStr, // Fallback to last visit date if schedule date was empty
      protocol: proto,
      brand: brand,
      lotNumber: lot,
      expiryDate: expiryStr,
      dosage: dosage,
      quantity: qty,
      source: source,
      lastVisit: lastVisitStr
    });
  }

  return patients;
}

/**
 * Robustly formats Date objects or date strings into MM/DD/YYYY.
 * Gracefully parses Date objects, YYYY-MM-DD, DD/MM/YYYY, and existing MM/DD/YYYY strings.
 */
function formatToMMDDYYYY(val) {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'MM/dd/yyyy');
  }
  const str = String(val).trim();
  if (!str) return '';

  // Matches YYYY-MM-DD (e.g. 2026-10-24)
  const ymdMatch = str.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ('0' + ymdMatch[2]).slice(-2);
    const d = ('0' + ymdMatch[3]).slice(-2);
    return m + '/' + d + '/' + y;
  }

  // Matches DD/MM/YYYY or MM/DD/YYYY (e.g. 24/10/2026 or 10/24/2026)
  const slashMatch = str.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const y = slashMatch[3];
    // If the first part is > 12, it is definitely DD/MM/YYYY -> convert to MM/DD/YYYY
    if (p1 > 12 && p2 <= 12) {
      return ('0' + p2).slice(-2) + '/' + ('0' + p1).slice(-2) + '/' + y;
    }
    // Otherwise normalize leading zeroes for MM/DD/YYYY
    return ('0' + p1).slice(-2) + '/' + ('0' + p2).slice(-2) + '/' + y;
  }

  // Try parsing with Date constructor as fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'MM/dd/yyyy');
  }

  return str;
}

/**
 * Saves (appends or updates) a patient treatment schedule record in Master_Patients.
 * Supports updating an existing session row or appending a new schedule date entry.
 */
function savePatientRecord(payload) {
  if (!payload || !payload.name || !payload.name.trim()) {
    throw new Error('Patient name is required.');
  }
  if (!payload.brand || !payload.brand.trim()) {
    throw new Error('Brand Name is required.');
  }

  const ss = getSpreadsheet();
  ensureRequiredSheets(ss);
  const sheet = ss.getSheetByName(CONFIG.MASTER_PATIENT_SHEET);
  const colMap = getMasterPatientColumnMap(sheet);
  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM/dd/yyyy');

  const targetName = payload.name.trim();
  const diagnosis = (payload.diagnosis || '').trim();
  const scheduleDate = formatToMMDDYYYY(payload.scheduleDate || todayStr);
  const protocol = (payload.protocol || '').trim();
  const brand = payload.brand.trim();
  const lotNumber = (payload.lotNumber || '').trim();
  const expiryDate = formatToMMDDYYYY(payload.expiryDate || '');
  const dosage = (payload.dosage || '').trim();
  const quantity = (payload.quantity || '').trim();
  const source = (payload.source || '').trim();

  let targetRow = parseInt(payload.rowIndex, 10);

  // If updating an existing session row
  if (targetRow && targetRow >= 2 && !payload.isNewScheduleEntry) {
    if (colMap.nameCol >= 0) sheet.getRange(targetRow, colMap.nameCol + 1).setValue(targetName);
    if (colMap.diagCol >= 0) sheet.getRange(targetRow, colMap.diagCol + 1).setValue(diagnosis);
    if (colMap.schedCol >= 0) sheet.getRange(targetRow, colMap.schedCol + 1).setValue(scheduleDate);
    if (colMap.protoCol >= 0) sheet.getRange(targetRow, colMap.protoCol + 1).setValue(protocol);
    if (colMap.brandCol >= 0) sheet.getRange(targetRow, colMap.brandCol + 1).setValue(brand);
    if (colMap.lotCol >= 0) sheet.getRange(targetRow, colMap.lotCol + 1).setValue(lotNumber);
    if (colMap.expiryCol >= 0) sheet.getRange(targetRow, colMap.expiryCol + 1).setValue(expiryDate);
    if (colMap.dosageCol >= 0) sheet.getRange(targetRow, colMap.dosageCol + 1).setValue(dosage);
    if (colMap.qtyCol >= 0) sheet.getRange(targetRow, colMap.qtyCol + 1).setValue(quantity);
    if (colMap.sourceCol >= 0) sheet.getRange(targetRow, colMap.sourceCol + 1).setValue(source);
    if (colMap.lastVisitCol >= 0) sheet.getRange(targetRow, colMap.lastVisitCol + 1).setValue(todayStr);

    return {
      success: true,
      message: 'Treatment schedule for "' + targetName + '" (' + scheduleDate + ') updated successfully.',
      rowIndex: targetRow
    };
  }

  // Otherwise, append a new row for this therapy schedule session
  const maxCols = Math.max(sheet.getLastColumn(), 12);
  const newRow = new Array(maxCols).fill('');
  if (colMap.nameCol >= 0) newRow[colMap.nameCol] = targetName;
  if (colMap.diagCol >= 0) newRow[colMap.diagCol] = diagnosis;
  if (colMap.schedCol >= 0) newRow[colMap.schedCol] = scheduleDate;
  if (colMap.protoCol >= 0) newRow[colMap.protoCol] = protocol;
  if (colMap.brandCol >= 0) newRow[colMap.brandCol] = brand;
  if (colMap.lotCol >= 0) newRow[colMap.lotCol] = lotNumber;
  if (colMap.expiryCol >= 0) newRow[colMap.expiryCol] = expiryDate;
  if (colMap.dosageCol >= 0) newRow[colMap.dosageCol] = dosage;
  if (colMap.qtyCol >= 0) newRow[colMap.qtyCol] = quantity;
  if (colMap.sourceCol >= 0) newRow[colMap.sourceCol] = source;
  if (colMap.createdCol >= 0) newRow[colMap.createdCol] = todayStr;
  if (colMap.lastVisitCol >= 0) newRow[colMap.lastVisitCol] = todayStr;

  sheet.appendRow(newRow);

  return {
    success: true,
    message: 'New therapy schedule for "' + targetName + '" (' + scheduleDate + ') recorded successfully.',
    rowIndex: sheet.getLastRow()
  };
}

/**
 * Deletes a patient treatment schedule row from Master_Patients.
 */
function deletePatientRecord(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.MASTER_PATIENT_SHEET);
  if (!sheet) throw new Error('Patient registry sheet not found.');

  const targetRow = parseInt(payload.rowIndex, 10);
  if (!targetRow || targetRow < 2 || targetRow > sheet.getLastRow()) {
    throw new Error('Invalid record selected for deletion.');
  }

  sheet.deleteRow(targetRow);
  return { success: true, message: 'Treatment schedule record removed from clinical registry.' };
}

// ==========================================
// MEDICINE REPOSITORY & ONCOLOGY FILTERING
// (Philippine National Formulary Section 9.0)
// ==========================================

const ONCOLOGY_GENERIC_PATTERNS = [
  // Platinum Coordination Complexes
  /\bcarboplatin\b/i, /\bcisplatin\b/i, /\boxaliplatin\b/i,
  // Taxanes, Plant Alkaloids & Topoisomerase Inhibitors
  /\bpaclitaxel\b/i, /\bdocetaxel\b/i, /\bcabazitaxel\b/i,
  /\bvincristine\b/i, /\bvinblastine\b/i, /\bvinorelbine\b/i,
  /\betoposide\b/i, /\birinotecan\b/i, /\btopotecan\b/i,
  // Antimetabolites
  /\bfluorouracil\b/i, /\b5-fu\b/i, /\bcapecitabine\b/i, /\bgemcitabine\b/i,
  /\bcytarabine\b/i, /\bmethotrexate\b/i, /\bazacitidine\b/i, /\bdecitabine\b/i,
  /\bmercaptopurine\b/i, /\b6-mp\b/i, /\bpemetrexed\b/i, /\bfludarabine\b/i,
  /\bhydroxyurea\b/i, /\bhydroxycarbamide\b/i, /\bcladribine\b/i, /\btioguanine\b/i,
  // Anthracyclines & Cytotoxic Antibiotics
  /\bdoxorubicin\b/i, /\bepirubicin\b/i, /\bdaunorubicin\b/i, /\bidarubicin\b/i,
  /\bbleomycin\b/i, /\bmitomycin\b/i, /\bdactinomycin\b/i,
  // Alkylating Agents
  /\bcyclophosphamide\b/i, /\bifosfamide\b/i, /\bmelphalan\b/i, /\bchlorambucil\b/i,
  /\bdacarbazine\b/i, /\btemozolomide\b/i, /\bbendamustine\b/i, /\bbusulfan\b/i,
  /\blomustine\b/i, /\bcarmustine\b/i, /\bthiotepa\b/i,
  // Targeted Therapies, Monoclonal Antibodies & Immunotherapies
  /\btrastuzumab\b/i, /\brituximab\b/i, /\bbevacizumab\b/i, /\bcetuximab\b/i,
  /\bpertuzumab\b/i, /\bpanitumumab\b/i, /\bpembrolizumab\b/i, /\bnivolumab\b/i,
  /\batezolizumab\b/i, /\bdurvalumab\b/i, /\bavelumab\b/i, /\bipilimumab\b/i,
  /\bbortezomib\b/i, /\bimatinib\b/i, /\berlotinib\b/i, /\bgefitinib\b/i,
  /\bosimertinib\b/i, /\bsorafenib\b/i, /\bsunitinib\b/i, /\bnilotinib\b/i,
  /\bdasatinib\b/i, /\blenvatinib\b/i, /\bcabozantinib\b/i, /\bregorafenib\b/i,
  /\bolaparib\b/i, /\bpalbociclib\b/i, /\bribociclib\b/i, /\babemaciclib\b/i,
  /\balectinib\b/i, /\bbrigatinib\b/i, /\bcrizotinib\b/i, /\bruxolitinib\b/i,
  /\blenalidomide\b/i, /\bthalidomide\b/i, /\bpomalidomide\b/i,
  // Hormonal & Endocrine Oncology
  /\btamoxifen\b/i, /\bletrozole\b/i, /\banastrozole\b/i, /\bexemestane\b/i,
  /\bfulvestrant\b/i, /\bbicalutamide\b/i, /\bflutamide\b/i, /\bgoserelin\b/i,
  /\bleuprorelin\b/i, /\bleuprolide\b/i, /\btriptorelin\b/i, /\babiraterone\b/i,
  /\benzalutamide\b/i, /\bdegarelix\b/i,
  // Cancer-Specific Rescue Agents (Direct Chemo Antidotes Only)
  /\bmesna\b/i, /\bleucovorin\b/i, /\bfolinate\b/i, /\bfilgrastim\b/i, /\bpegfilgrastim\b/i
];

/**
 * Checks if a drug description contains a recognized oncology or chemotherapy generic name.
 */
function isRecognizedOncologyMedicine(name) {
  if (!name) return false;
  const str = String(name).trim();
  for (let i = 0; i < ONCOLOGY_GENERIC_PATTERNS.length; i++) {
    if (ONCOLOGY_GENERIC_PATTERNS[i].test(str)) {
      return true;
    }
  }
  return false;
}

/**
 * Retrieves deduplicated medicines from Column B of the Medicine tab.
 * Segregates into:
 *  - oncologyMedicines: Verified PNF Section 9.0 antineoplastics & cancer-specific drugs
 *  - allMedicines: Full hospital catalog (all 2,700+ formulary drugs)
 */
function getUniqueMedicineList() {
  const ss = getSpreadsheet();
  const medSheet = ss.getSheetByName(CONFIG.MEDICINE_SHEET);
  const seenAll = new Set();
  const allMeds = [];
  const oncologyMeds = [];

  // 1. Process hospital medicine formulary
  if (medSheet) {
    const lastRow = medSheet.getLastRow();
    if (lastRow >= 2) {
      const values = medSheet.getRange(2, 2, lastRow - 1, 1).getValues();
      for (let i = 0; i < values.length; i++) {
        const rawName = String(values[i][0] || '').trim();
        if (!rawName) continue;

        const key = rawName.toUpperCase();
        if (!seenAll.has(key)) {
          seenAll.add(key);
          allMeds.push(rawName);
          if (isRecognizedOncologyMedicine(rawName)) {
            oncologyMeds.push(rawName);
          }
        }
      }
    }
  }

  // 2. Retain any protocols recorded in Master_Patients so active regimens are always in the dropdown
  const masterSheet = ss.getSheetByName(CONFIG.MASTER_PATIENT_SHEET);
  if (masterSheet) {
    const lastRow = masterSheet.getLastRow();
    if (lastRow >= 2) {
      const colMap = getMasterPatientColumnMap(masterSheet);
      const protoColIdx = colMap.protoCol >= 0 ? colMap.protoCol + 1 : 4;
      const protocols = masterSheet.getRange(2, protoColIdx, lastRow - 1, 1).getValues();
      const seenOnco = new Set(oncologyMeds.map(function(m) { return m.toUpperCase(); }));
      for (let i = 0; i < protocols.length; i++) {
        const proto = String(protocols[i][0] || '').trim();
        if (!proto) continue;
        const key = proto.toUpperCase();
        if (!seenAll.has(key)) {
          seenAll.add(key);
          allMeds.push(proto);
        }
        if (!seenOnco.has(key)) {
          seenOnco.add(key);
          oncologyMeds.push(proto);
        }
      }
    }
  }

  allMeds.sort(function(a, b) {
    return a.localeCompare(b);
  });

  oncologyMeds.sort(function(a, b) {
    return a.localeCompare(b);
  });

  return {
    oncologyMedicines: oncologyMeds,
    allMedicines: allMeds
  };
}

/**
 * Adds a new medicine on the fly to the Medicine tab in Google Sheets.
 * Generates the next DMR code and appends the row.
 */
function addNewMedicine(medicineName) {
  if (!medicineName || !medicineName.trim()) {
    throw new Error('Medicine name cannot be empty.');
  }

  const cleanName = medicineName.trim();
  const ss = getSpreadsheet();
  ensureRequiredSheets(ss);
  const sheet = ss.getSheetByName(CONFIG.MEDICINE_SHEET);

  // Check if it already exists (case-insensitive)
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const existing = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (let i = 0; i < existing.length; i++) {
      if (String(existing[i][0] || '').trim().toLowerCase() === cleanName.toLowerCase()) {
        return {
          success: true,
          medicineName: String(existing[i][0]).trim(),
          alreadyExisted: true,
          message: 'Medicine already exists in the hospital formulary.'
        };
      }
    }
  }

  // Generate a new code: DMR + (lastRow)
  const nextNum = Math.max(lastRow, 1);
  const padded = ('000000' + nextNum).slice(-6);
  const newCode = 'DMR' + padded;

  sheet.appendRow([newCode, cleanName]);

  return {
    success: true,
    medicineName: cleanName,
    newCode: newCode,
    alreadyExisted: false,
    message: 'Medicine "' + cleanName + '" added to hospital formulary successfully.'
  };
}

// ==========================================
// SPREADSHEET TAB & COLUMN CLEANUP UTILITY
// ==========================================

/**
 * Safely cleans columns inside Master_Patients without touching ANY other tabs.
 * Preserves all existing tabs in the spreadsheet completely untouched.
 */
function cleanupSpreadsheetTabs() {
  const ss = getSpreadsheet();
  ensureRequiredSheets(ss);

  // NOTE: Strictly non-destructive. We do NOT delete any sheets to protect existing tabs!
  const deletedTabs = [];

  // Remove 'Hospital Number' column(s) from Master_Patients only and format headers
  let hospColRemoved = false;
  const masterSheet = ss.getSheetByName(CONFIG.MASTER_PATIENT_SHEET);
  if (masterSheet && masterSheet.getLastColumn() > 0) {
    const lastCol = masterSheet.getLastColumn();
    const headers = masterSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    for (let c = headers.length - 1; c >= 0; c--) {
      const h = String(headers[c] || '').toUpperCase().trim();
      if (h.includes('HOSPITAL')) {
        masterSheet.deleteColumn(c + 1);
        hospColRemoved = true;
      }
    }

    const updatedLastCol = masterSheet.getLastColumn();
    if (updatedLastCol > 0) {
      masterSheet.getRange(1, 1, 1, updatedLastCol)
        .setBackground(CONFIG.COLORS.HEADER_BLUE)
        .setFontColor(CONFIG.COLORS.WHITE)
        .setFontWeight('bold');
      masterSheet.setFrozenRows(1);
    }
  }

  let message = 'Master_Patients registry columns verified. All existing spreadsheet tabs preserved safely.';
  if (hospColRemoved) {
    message = 'Cleanup complete! Hospital Number column removed from Master_Patients. All existing tabs preserved.';
  }

  return {
    success: true,
    deletedCount: 0,
    deletedTabs: [],
    hospitalColumnRemoved: hospColRemoved,
    message: message
  };
}
